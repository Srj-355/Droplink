import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChunkSize,
  generateRoomCode,
  formatBytes,
  ICE_SERVERS,
  CHUNK_RETRY_LIMIT,
  CHUNK_ACK_TIMEOUT,
  SPEED_UPDATE_MS,
  PEERJS_CDN,
  QRCODE_CDN,
  loadScript,
} from "../constants";

// ─── Feature detection ────────────────────────────────────────────────────────
// File System Access API — Chrome/Edge 86+. Not in Firefox or Safari.
const STREAM_SUPPORTED = typeof window !== "undefined" && "showSaveFilePicker" in window;

// Files below this size always use buffer mode (no benefit opening a Save dialog)
const STREAM_MIN_BYTES = 1 * 1024 * 1024; // 1 MB

// Warn user about RAM usage above this threshold in buffer mode
const BUFFER_WARN_BYTES = 200 * 1024 * 1024; // 200 MB

// ─── usePeer ──────────────────────────────────────────────────────────────────
// All PeerJS + WebRTC logic. Returns stable state and action callbacks.
// ─────────────────────────────────────────────────────────────────────────────
export function usePeer() {
  const [screen,    setScreen]    = useState("home");
  const [roomCode,  setRoomCode]  = useState("");
  const [joinCode,  setJoinCode]  = useState("");
  const [peer,      setPeer]      = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [shareUrl,  setShareUrl]  = useState("");
  const [peerError, setPeerError] = useState("");
  const [libsReady, setLibsReady] = useState(false);

  // ── Stable refs (avoid stale closures in async PeerJS callbacks) ─────────────
  const connRef        = useRef(null);
  const connectedRef   = useRef(false);
  const sendStates     = useRef({});    // { fileId: SendState }
  const speedTrackers  = useRef({});    // { fileId: SpeedTracker }

  // receiveBuffers: two possible shapes per fileId ──────────────────────────────
  //
  // Stream mode (STREAM_SUPPORTED && size >= STREAM_MIN_BYTES):
  //   { mode:"stream", writable:FileSystemWritableFileStream|null,
  //     writablePromise:Promise, ready:boolean, fallback:boolean,
  //     pendingChunks:Map<index,ArrayBuffer>, nextExpected:number,
  //     received:number, chunks:Array|null,
  //     meta:{ name, size, totalChunks, chunkSize } }
  //
  // Buffer mode (fallback or small files):
  //   { mode:"buffer", chunks:Array<ArrayBuffer>, received:number,
  //     meta:{ name, size, totalChunks, chunkSize } }
  const receiveBuffers = useRef({});

  useEffect(() => { connectedRef.current = connected; }, [connected]);

  // ── Load CDN libraries ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadScript(PEERJS_CDN), loadScript(QRCODE_CDN)])
      .then(() => setLibsReady(true))
      .catch(() =>
        setPeerError("Failed to load required libraries. Check your internet connection.")
      );
  }, []);

  // ── Parse room code from URL ──────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setJoinCode(roomParam.toUpperCase());
      setScreen("join");
    }
  }, []);

  // ── Stable state helpers ──────────────────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const updateTransfer = useCallback((fileId, patch) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === fileId ? { ...t, ...patch } : t))
    );
  }, []);

  // ── Speed / ETA calculation ───────────────────────────────────────────────────
  const tickSpeedTracker = useCallback((fileId, bytesDone, totalBytes) => {
    const tracker = speedTrackers.current[fileId];
    if (!tracker) return {};
    const now     = Date.now();
    const elapsed = (now - tracker.startTime) / 1000;
    if (elapsed <= 0) return {};
    // Throttle updates to avoid UI jitter
    if (now - tracker.lastUpdate < SPEED_UPDATE_MS && tracker.speed !== undefined) {
      return { speed: tracker.speed, eta: tracker.eta };
    }
    const speed     = bytesDone / elapsed;
    const remaining = totalBytes - bytesDone;
    const eta       = speed > 0 ? remaining / speed : null;
    speedTrackers.current[fileId] = { ...tracker, lastUpdate: now, speed, eta };
    return { speed, eta };
  }, []);

  // ── Stream helper: flush consecutive pending chunks to WritableStream ─────────
  // WebRTC DataChannel (reliable:true) delivers in order, so pendingChunks rarely
  // has gaps. The Map is a safety net for any edge-case reordering.
  const flushPending = useCallback(
    async (fileId) => {
      const buf = receiveBuffers.current[fileId];
      if (!buf || buf.mode !== "stream" || !buf.writable) return;

      while (buf.pendingChunks.has(buf.nextExpected)) {
        const chunk = buf.pendingChunks.get(buf.nextExpected);
        buf.pendingChunks.delete(buf.nextExpected);
        try {
          await buf.writable.write(new Uint8Array(chunk));
        } catch (err) {
          // Disk full, stream closed by user, etc.
          console.error("WritableStream write error:", err);
          updateTransfer(fileId, { status: "error" });
          addMessage({
            type: "system",
            text: `❌ Stream write failed for "${buf.meta.name}". Disk full or save cancelled?`,
          });
          delete receiveBuffers.current[fileId];
          delete speedTrackers.current[fileId];
          return;
        }
        buf.nextExpected++;
      }
    },
    [addMessage, updateTransfer]
  );

  // ── Helper: switch a stream-mode buffer to buffer fallback ────────────────────
  // Called when showSaveFilePicker is cancelled or fails after chunks already arrived.
  const activateFallback = useCallback(
    (fileId, buf) => {
      buf.mode     = "buffer";
      buf.fallback = true;
      buf.chunks   = new Array(buf.meta.totalChunks);
      // Drain any already-queued pending chunks into the chunks array
      buf.pendingChunks.forEach((chunk, idx) => {
        buf.chunks[idx] = chunk;
      });
      buf.pendingChunks.clear();
      if (buf.meta.size > BUFFER_WARN_BYTES) {
        addMessage({
          type: "system",
          text: `⚠️ Streaming cancelled — buffering "${buf.meta.name}" in RAM. Large files may slow your browser.`,
        });
      }
    },
    [addMessage]
  );

  // ── Incoming data handler ─────────────────────────────────────────────────────
  // Stored in a ref so PeerJS event listeners always call the latest version
  // without needing to re-register (which would break the connection).
  const handleIncomingDataRef = useRef(null);
  handleIncomingDataRef.current = (data) => {
    if (!data?.type) return;

    // ── Chat ──────────────────────────────────────────────────────────────────
    if (data.type === "chat") {
      addMessage({ type: "chat", text: data.text, sender: "them", time: data.time });
      return;
    }

    // ── File metadata ─────────────────────────────────────────────────────────
    if (data.type === "file-meta") {
      const { fileId, name, size, totalChunks, chunkSize } = data;
      const useStream = STREAM_SUPPORTED && size >= STREAM_MIN_BYTES;

      if (useStream) {
        // Open save dialog immediately — user picks save location before chunks arrive.
        // We keep a reference to the promise so the chunk handler can wait on it.
        const writablePromise = window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "File", accept: { "application/octet-stream": ["*"] } }],
        })
          .then((fileHandle) => fileHandle.createWritable())
          .catch((err) => {
            // User dismissed the dialog → will activate fallback when promise resolves
            console.warn("Save dialog cancelled:", err.message);
            return null;
          });

        const buf = {
          mode: "stream",
          writablePromise,
          writable: null,
          ready: false,
          fallback: false,
          pendingChunks: new Map(),
          nextExpected: 0,
          received: 0,
          chunks: null,
          meta: { name, size, totalChunks, chunkSize },
        };
        receiveBuffers.current[fileId] = buf;

        // Resolve promise: either get writable or activate RAM fallback
        writablePromise.then((writable) => {
          const b = receiveBuffers.current[fileId];
          if (!b) return; // transfer finished while dialog was open — nothing to do

          if (writable) {
            b.writable = writable;
            b.ready    = true;
            // Drain any chunks that arrived while dialog was open
            flushPending(fileId);
          } else {
            // Dialog cancelled — switch to buffer mode
            activateFallback(fileId, b);
          }
        });
      } else {
        // Buffer mode: small file or unsupported browser
        receiveBuffers.current[fileId] = {
          mode: "buffer",
          chunks: new Array(totalChunks),
          received: 0,
          meta: { name, size, totalChunks, chunkSize },
        };
        if (!STREAM_SUPPORTED && size > BUFFER_WARN_BYTES) {
          addMessage({
            type: "system",
            text: `⚠️ Your browser doesn't support streaming saves. "${name}" (${formatBytes(size)}) will be buffered in RAM.`,
          });
        }
      }

      speedTrackers.current[fileId] = {
        startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null,
      };

      setTransfers((prev) => [
        ...prev,
        {
          id: fileId, name, size,
          progress: 0, direction: "in", status: "receiving",
          speed: 0, eta: null, chunkSize, received: 0, totalChunks,
          streamMode: useStream,
        },
      ]);
      return;
    }

    // ── File chunk ────────────────────────────────────────────────────────────
    if (data.type === "file-chunk") {
      const { fileId, chunk, index } = data;
      const buf = receiveBuffers.current[fileId];
      if (!buf) return;

      // Always ACK immediately so sender can clear its retry timer
      connRef.current?.send({ type: "chunk-ack", fileId, index });

      // ── STREAM MODE ──────────────────────────────────────────────────────────
      if (buf.mode === "stream") {
        // Queue chunk (deduplication: skip if already seen)
        if (!buf.pendingChunks.has(index)) {
          buf.pendingChunks.set(index, chunk);
          buf.received++;
        }

        const bytesDone = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
        const progress  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
        const { speed, eta } = tickSpeedTracker(fileId, bytesDone, buf.meta.size);
        updateTransfer(fileId, { progress, speed, eta, received: buf.received });

        // Flush if writable is ready; otherwise chunks stay in pendingChunks
        // until writablePromise resolves and flushPending is called there.
        if (buf.ready && buf.writable) {
          flushPending(fileId); // async — non-blocking
        }

        // All chunks received
        if (buf.received === buf.meta.totalChunks) {
          // Wait for pending flushes, then close the stream
          const finishStream = async () => {
            const b = receiveBuffers.current[fileId];
            if (!b) return;

            // If writable isn't ready yet (user still has dialog open), wait for it
            if (!b.ready) {
              await b.writablePromise;
              // After promise resolves, re-check — might have fallen back to buffer
              const b2 = receiveBuffers.current[fileId];
              if (!b2) return;
              if (b2.mode === "buffer") {
                finishBuffer(fileId, b2);
                return;
              }
            }

            await flushPending(fileId);
            const b3 = receiveBuffers.current[fileId];
            if (!b3 || !b3.writable) return;
            try {
              await b3.writable.close();
            } catch (err) {
              console.error("WritableStream close error:", err);
            }
            delete receiveBuffers.current[fileId];
            delete speedTrackers.current[fileId];
            updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
            addMessage({
              type: "system",
              text: `✅ Saved "${buf.meta.name}" (${formatBytes(buf.meta.size)}) directly to disk 💾`,
            });
          };
          finishStream();
        }
        return;
      }

      // ── BUFFER MODE ──────────────────────────────────────────────────────────
      if (buf.mode === "buffer") {
        // Idempotent store — ignore duplicate chunks from retries
        if (!buf.chunks[index]) {
          buf.chunks[index] = chunk;
          buf.received++;
        }

        const bytesDone = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
        const progress  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
        const { speed, eta } = tickSpeedTracker(fileId, bytesDone, buf.meta.size);
        updateTransfer(fileId, { progress, speed, eta, received: buf.received });

        if (buf.received === buf.meta.totalChunks) {
          finishBuffer(fileId, buf);
        }
        return;
      }
    }

    // ── ACK received by sender ────────────────────────────────────────────────
    if (data.type === "chunk-ack") {
      const { fileId, index } = data;
      const state = sendStates.current[fileId];
      if (!state) return;
      if (state.ackTimers[index]) {
        clearTimeout(state.ackTimers[index]);
        delete state.ackTimers[index];
      }
    }
  };

  // ── Buffer finisher (shared by buffer mode and stream→buffer fallback) ────────
  // Extracted as a plain function (not useCallback) since it's called from within
  // the data handler which already captures addMessage/updateTransfer via closure.
  const finishBuffer = useCallback((fileId, buf) => {
    const blob = new Blob(buf.chunks.map((c) => new Uint8Array(c)));
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = buf.meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    delete receiveBuffers.current[fileId];
    delete speedTrackers.current[fileId];
    updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
    addMessage({
      type: "system",
      text: `✅ Received "${buf.meta.name}" (${formatBytes(buf.meta.size)})`,
    });
  }, [addMessage, updateTransfer]);

  // ── Connection setup ──────────────────────────────────────────────────────────
  const setupConnectionRef = useRef(null);
  setupConnectionRef.current = (connection) => {
    connection.on("open", () => {
      connRef.current      = connection;
      connectedRef.current = true;
      setConnected(true);
      setScreen("room");
      addMessage({ type: "system", text: "🔗 Peer connected — channel is encrypted & direct." });
      if (STREAM_SUPPORTED) {
        addMessage({
          type: "system",
          text: "💾 Stream mode active — large files write directly to disk, no RAM limit.",
        });
      }
    });

    connection.on("data", (data) => {
      handleIncomingDataRef.current?.(data);
    });

    connection.on("close", () => {
      // Abort any open WritableStreams to release file locks
      Object.values(receiveBuffers.current).forEach(async (buf) => {
        if (buf.mode === "stream" && buf.writable) {
          try { await buf.writable.abort(); } catch {}
        }
      });
      connRef.current      = null;
      connectedRef.current = false;
      setConnected(false);
      receiveBuffers.current = {};
      Object.values(sendStates.current).forEach((s) => { s.aborted = true; });
      sendStates.current    = {};
      speedTrackers.current = {};
      addMessage({ type: "system", text: "⚠️ Peer disconnected." });
      setTransfers((prev) =>
        prev.map((t) => (t.status !== "done" ? { ...t, status: "error" } : t))
      );
    });

    connection.on("error", (err) => {
      console.error("DataConnection error:", err);
      setPeerError("Connection error. Try reconnecting.");
    });
  };

  // ── Create room (Host) ────────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    if (!libsReady || !window.Peer) {
      setPeerError("Libraries still loading — please wait.");
      return;
    }
    setPeerError("");

    const attemptCreate = (retries = 3) => {
      const code = generateRoomCode();
      const p    = new window.Peer(code, { debug: 0, config: { iceServers: ICE_SERVERS } });

      p.on("open", (id) => {
        const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
        setRoomCode(id);
        setShareUrl(url);
        setPeer(p);
        setScreen("host");
      });

      p.on("connection", (connection) => {
        setupConnectionRef.current(connection);
      });

      p.on("error", (err) => {
        if (err.type === "unavailable-id" && retries > 0) {
          p.destroy();
          attemptCreate(retries - 1);
        } else {
          setPeerError(`Could not create room (${err.type}). Please try again.`);
        }
      });
    };

    attemptCreate();
  }, [libsReady]);

  // ── Join room ─────────────────────────────────────────────────────────────────
  const joinRoom = useCallback(() => {
    const targetCode = joinCode.trim().toUpperCase();
    if (!targetCode) return;
    if (!libsReady || !window.Peer) {
      setPeerError("Libraries still loading — please wait.");
      return;
    }
    setPeerError("");
    setScreen("room");

    const p = new window.Peer(undefined, { debug: 0, config: { iceServers: ICE_SERVERS } });

    p.on("open", () => {
      const connection = p.connect(targetCode, { reliable: true, serialization: "binary" });
      setupConnectionRef.current(connection);
      setPeer(p);
    });

    p.on("error", (err) => {
      const msg =
        err.type === "peer-unavailable"
          ? "Room not found. Check the code and try again."
          : `Connection failed (${err.type}). Try again.`;
      setPeerError(msg);
      setScreen("join");
    });
  }, [joinCode, libsReady]);

  // ── Send file (adaptive chunking + ACK retry + speed/ETA) ────────────────────
  const sendFile = useCallback(
    (file) => {
      const c = connRef.current;
      if (!c || !connectedRef.current) return;

      const fileId      = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const chunkSize   = getChunkSize(file.size);
      const totalChunks = Math.ceil(file.size / chunkSize);

      sendStates.current[fileId] = {
        aborted: false, chunkSize, totalChunks,
        ackTimers: {}, retryCounts: {},
      };
      speedTrackers.current[fileId] = {
        startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null,
      };

      setTransfers((prev) => [
        ...prev,
        {
          id: fileId, name: file.name, size: file.size,
          progress: 0, direction: "out", status: "sending",
          speed: 0, eta: null, chunkSize, sent: 0, totalChunks,
          streamMode: false,
        },
      ]);

      c.send({ type: "file-meta", fileId, name: file.name, size: file.size, totalChunks, chunkSize });

      let chunkIndex = 0;

      // ── Send one chunk with ACK + retry ─────────────────────────────────────
      const sendChunk = (index) => {
        const state = sendStates.current[fileId];
        if (!state || state.aborted) return;

        const currentConn = connRef.current;
        if (!currentConn || !connectedRef.current) {
          if (state) state.aborted = true;
          updateTransfer(fileId, { status: "error" });
          return;
        }

        const start       = index * chunkSize;
        const end         = Math.min(start + chunkSize, file.size);
        const chunkReader = new FileReader();

        chunkReader.onload = (e) => {
          const st = sendStates.current[fileId];
          if (!st || st.aborted) return;

          try {
            currentConn.send({ type: "file-chunk", fileId, chunk: e.target.result, index });
          } catch {
            st.aborted = true;
            updateTransfer(fileId, { status: "error" });
            return;
          }

          // ACK watchdog timer
          const timer = setTimeout(() => {
            const st2 = sendStates.current[fileId];
            if (!st2 || st2.aborted) return;
            st2.retryCounts[index] = (st2.retryCounts[index] || 0) + 1;
            if (st2.retryCounts[index] >= CHUNK_RETRY_LIMIT) {
              st2.aborted = true;
              updateTransfer(fileId, { status: "error" });
              addMessage({
                type: "system",
                text: `❌ "${file.name}" failed — chunk ${index} timed out after ${CHUNK_RETRY_LIMIT} retries.`,
              });
            } else {
              sendChunk(index); // retry
            }
          }, CHUNK_ACK_TIMEOUT);

          sendStates.current[fileId].ackTimers[index] = timer;
        };

        chunkReader.onerror = () => {
          const st = sendStates.current[fileId];
          if (st) st.aborted = true;
          updateTransfer(fileId, { status: "error" });
        };

        chunkReader.readAsArrayBuffer(file.slice(start, end));
      };

      // ── Advance sender ───────────────────────────────────────────────────────
      const advanceSender = () => {
        const state = sendStates.current[fileId];
        if (!state || state.aborted || chunkIndex >= totalChunks) return;

        const index     = chunkIndex++;
        sendChunk(index);

        const bytesDone = Math.min(chunkIndex * chunkSize, file.size);
        const progress  = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));
        const { speed, eta } = tickSpeedTracker(fileId, bytesDone, file.size);
        updateTransfer(fileId, { progress, speed, eta, sent: chunkIndex });

        if (chunkIndex < totalChunks) {
          // Adaptive throttle: smaller chunks need more pacing to avoid buffer overflow
          const delay = chunkSize <= 16 * 1024 ? 12 : chunkSize <= 64 * 1024 ? 8 : 4;
          setTimeout(advanceSender, delay);
        } else {
          // All chunks dispatched — mark done
          updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
          delete speedTrackers.current[fileId];
          const chunkLabel = chunkSize >= 1024 * 1024
            ? `${chunkSize / (1024 * 1024)}MB`
            : `${chunkSize / 1024}KB`;
          addMessage({
            type: "system",
            text: `📤 Sent "${file.name}" (${formatBytes(file.size)}) — ${chunkLabel} chunks`,
          });
          const st = sendStates.current[fileId];
          if (st) {
            Object.values(st.ackTimers).forEach(clearTimeout);
            delete sendStates.current[fileId];
          }
        }
      };

      advanceSender();
    },
    [addMessage, updateTransfer, tickSpeedTracker]
  );

  // ── Send chat ─────────────────────────────────────────────────────────────────
  const sendChat = useCallback(
    (text) => {
      const c = connRef.current;
      if (!c || !connectedRef.current || !text.trim()) return false;
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      try {
        c.send({ type: "chat", text: text.trim(), time });
      } catch {
        addMessage({ type: "system", text: "⚠️ Message failed to send." });
        return false;
      }
      addMessage({ type: "chat", text: text.trim(), sender: "me", time });
      return true;
    },
    [addMessage]
  );

  // ── Leave / full reset ────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    // Close/abort any open WritableStreams
    Object.values(receiveBuffers.current).forEach(async (buf) => {
      if (buf.mode === "stream" && buf.writable) {
        try { await buf.writable.abort(); } catch {}
      }
    });
    // Clear all send timers
    Object.values(sendStates.current).forEach((s) => {
      s.aborted = true;
      Object.values(s.ackTimers || {}).forEach(clearTimeout);
    });
    sendStates.current     = {};
    speedTrackers.current  = {};
    receiveBuffers.current = {};
    connRef.current        = null;
    connectedRef.current   = false;

    try { peer?.destroy(); } catch {}

    setPeer(null);
    setConnected(false);
    setMessages([]);
    setTransfers([]);
    setRoomCode("");
    setShareUrl("");
    setPeerError("");
    setJoinCode("");
    setScreen("home");
  }, [peer]);

  return {
    screen, setScreen,
    roomCode, shareUrl,
    joinCode, setJoinCode,
    connected,
    messages,
    transfers, setTransfers,
    peerError, setPeerError,
    libsReady,
    streamSupported: STREAM_SUPPORTED,
    createRoom, joinRoom, sendFile, sendChat, leaveRoom,
  };
}