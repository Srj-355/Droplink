import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChunkSize, generateRoomCode, formatBytes,
  ICE_SERVERS, CHUNK_RETRY_LIMIT, CHUNK_ACK_TIMEOUT,
  SPEED_UPDATE_MS, RECONNECT_MAX, RECONNECT_BASE_MS,
  USE_CUSTOM_PEER_SERVER, PEER_SERVER,
} from "../constants";
import Peer from "peerjs";

// ─── Build PeerJS constructor options ─────────────────────────────────────────
// Switches between the self-hosted Render server and the public PeerJS cloud
// based on USE_CUSTOM_PEER_SERVER flag in constants.js.
function buildPeerOptions() {
  const opts = {
    debug: 0,
    config: {
      iceServers: ICE_SERVERS,
      iceTransportPolicy: "all",     // try direct first, TURN relay as fallback
      sdpSemantics: "unified-plan",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    },
  };
  if (USE_CUSTOM_PEER_SERVER) {
    opts.host   = PEER_SERVER.host;
    opts.port   = PEER_SERVER.port;
    opts.path   = PEER_SERVER.path;
    opts.secure = PEER_SERVER.secure;
    opts.key    = PEER_SERVER.key;
  }
  return opts;
}

// ─── Feature flags ────────────────────────────────────────────────────────────
const STREAM_SUPPORTED  = typeof window !== "undefined" && "showSaveFilePicker" in window;
const STREAM_MIN_BYTES  = 1 * 1024 * 1024;

// ─── Flow-control watermarks ──────────────────────────────────────────────────
const HIGH_WATERMARK  = 1 * 1024 * 1024;  // 1 MB  — pause sending above this
const LOW_WATERMARK   = 256 * 1024;        // 256 KB — resume sending below this
const SCTP_WARMUP_MS  = 50;               // brief delay before first chunk

// ─── Binary framing protocol ──────────────────────────────────────────────────
// All wire data is ArrayBuffer (serialization: "raw").
// Byte 0 = frame type:
//   0x01 → JSON control  : [0x01][UTF-8 JSON]
//   0x02 → Binary chunk  : [0x02][u16 idLen][fileId bytes][u32 index][payload]
const TYPE_JSON  = 0x01;
const TYPE_CHUNK = 0x02;

function encodeJSON(obj) {
  const j = new TextEncoder().encode(JSON.stringify(obj));
  const b = new ArrayBuffer(1 + j.byteLength);
  const u = new Uint8Array(b);
  u[0] = TYPE_JSON;
  u.set(j, 1);
  return b;
}

function encodeChunk(fileId, index, chunkBuffer) {
  const id  = new TextEncoder().encode(fileId);
  const hdr = 1 + 2 + id.byteLength + 4;
  const buf = new ArrayBuffer(hdr + chunkBuffer.byteLength);
  const dv  = new DataView(buf);
  const u8  = new Uint8Array(buf);
  dv.setUint8(0, TYPE_CHUNK);
  dv.setUint16(1, id.byteLength, false);
  u8.set(id, 3);
  dv.setUint32(3 + id.byteLength, index, false);
  u8.set(new Uint8Array(chunkBuffer), hdr);
  return buf;
}

function decodeFrame(raw) {
  const buf  = raw instanceof ArrayBuffer ? raw : raw.buffer;
  const dv   = new DataView(buf);
  const u8   = new Uint8Array(buf);
  const kind = dv.getUint8(0);

  if (kind === TYPE_JSON) {
    try { return { type: "json", data: JSON.parse(new TextDecoder().decode(u8.subarray(1))) }; }
    catch { return null; }
  }
  if (kind === TYPE_CHUNK) {
    const idLen  = dv.getUint16(1, false);
    const idEnd  = 3 + idLen;
    const fileId = new TextDecoder().decode(u8.subarray(3, idEnd));
    const index  = dv.getUint32(idEnd, false);
    const chunk  = buf.slice(idEnd + 4);
    return { type: "chunk", fileId, index, chunk };
  }
  return null;
}

// ─── usePeer ──────────────────────────────────────────────────────────────────
export function usePeer({ onTransferComplete } = {}) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [screen,       setScreen]       = useState("home");
  const [roomCode,     setRoomCode]     = useState("");
  const [joinCode,     setJoinCode]     = useState("");
  const [peer,         setPeer]         = useState(null);
  const [connected,    setConnected]    = useState(false);
  const [messages,     setMessages]     = useState([]);
  const [transfers,    setTransfers]    = useState([]);
  const [fileQueue,    setFileQueue]    = useState([]);
  const [shareUrl,     setShareUrl]     = useState("");
  const [peerError,    setPeerError]    = useState("");
  const [libsReady,    setLibsReady]    = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const connRef         = useRef(null);
  const dcRef           = useRef(null);
  const connectedRef    = useRef(false);
  const peerRef         = useRef(null);
  const sendStates      = useRef({});
  const speedTrackers   = useRef({});
  const receiveBuffers  = useRef({});
  const activeFileId    = useRef(null);
  const fileQueueRef    = useRef([]);
  const reconnectCount  = useRef(0);
  const intentionalLeave = useRef(false);
  const targetRoomCode  = useRef("");
  const isHost          = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { fileQueueRef.current = fileQueue; }, [fileQueue]);
  useEffect(() => { peerRef.current = peer; },           [peer]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => { setLibsReady(true); }, []);

  // ── URL room param ─────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("room");
    if (p) { setJoinCode(p.toUpperCase()); setScreen("join"); }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addMessage = useCallback((msg) =>
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }])
  , []);

  const updateTransfer = useCallback((fileId, patch) =>
    setTransfers((prev) => prev.map((t) => t.id === fileId ? { ...t, ...patch } : t))
  , []);

  // ── Speed tracker ──────────────────────────────────────────────────────────
  const tickSpeed = useCallback((fileId, bytesDone, total) => {
    const tr = speedTrackers.current[fileId];
    if (!tr) return {};
    const now     = Date.now();
    const elapsed = (now - tr.startTime) / 1000;
    if (elapsed <= 0) return {};
    if (now - tr.lastUpdate < SPEED_UPDATE_MS && tr.speed !== undefined)
      return { speed: tr.speed, eta: tr.eta };
    const speed = bytesDone / elapsed;
    const eta   = speed > 0 ? (total - bytesDone) / speed : null;
    speedTrackers.current[fileId] = { ...tr, lastUpdate: now, speed, eta };
    return { speed, eta };
  }, []);

  // ── Stream flush ───────────────────────────────────────────────────────────
  const flushPending = useCallback(async (fileId) => {
    const buf = receiveBuffers.current[fileId];
    if (!buf || buf.mode !== "stream" || !buf.writable || buf.flushing) return;
    buf.flushing = true;
    while (buf.pendingChunks.has(buf.nextExpected)) {
      const chunk = buf.pendingChunks.get(buf.nextExpected);
      buf.pendingChunks.delete(buf.nextExpected);
      try { await buf.writable.write(new Uint8Array(chunk)); }
      catch (err) {
        updateTransfer(fileId, { status: "error" });
        addMessage({ type: "system", text: `❌ Stream write failed for "${buf.meta.name}".` });
        delete receiveBuffers.current[fileId];
        delete speedTrackers.current[fileId];
        buf.flushing = false;
        return;
      }
      buf.nextExpected++;
    }
    buf.flushing = false;
  }, [addMessage, updateTransfer]);

  const activateFallback = useCallback((fileId, buf) => {
    buf.mode = "buffer";
    buf.chunks = new Array(buf.meta.totalChunks);
    buf.pendingChunks.forEach((c, i) => { buf.chunks[i] = c; });
    buf.pendingChunks.clear();
  }, []);

  // ── finishBuffer — reassemble + trigger download ───────────────────────────
  const finishBuffer = useCallback((fileId, buf) => {
    const parts = buf.chunks.map((c) => {
      if (c instanceof ArrayBuffer) return new Uint8Array(c);
      if (ArrayBuffer.isView(c)) return new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
      return new Uint8Array(c);
    });
    const blob = new Blob(parts);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: buf.meta.name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    const tracker  = speedTrackers.current[fileId];
    const duration = tracker ? (Date.now() - tracker.startTime) / 1000 : null;
    const avgSpeed = duration && buf.meta.size ? buf.meta.size / duration : null;

    delete receiveBuffers.current[fileId];
    delete speedTrackers.current[fileId];

    updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
    addMessage({ type: "system", text: `✅ Received "${buf.meta.name}" (${formatBytes(buf.meta.size)})` });
    onTransferComplete?.({
      id: fileId, name: buf.meta.name, size: buf.meta.size,
      direction: "in", status: "done", duration, avgSpeed,
    });
  }, [addMessage, updateTransfer, onTransferComplete]);

  // ── Stable ref so _finalizeSender can call _advanceQueue without circular dep
  const _advanceQueueRef = useRef(null);

  // ── Queue advancement ──────────────────────────────────────────────────────
  const _advanceQueue = useCallback(() => {
    if (activeFileId.current) return;   // already sending
    if (!connectedRef.current) return;
    const queue = fileQueueRef.current;
    const next  = queue.find((q) => q.status === "queued");
    if (!next) return;
    setFileQueue((prev) => prev.map((q) => q.id === next.id ? { ...q, status: "sending" } : q));
    activeFileId.current = next.id;
    _sendFileInternal(next.file, next.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Always point ref at latest version
  _advanceQueueRef.current = _advanceQueue;

  // ── Sender finalize ────────────────────────────────────────────────────────
  const _finalizeSender = useCallback((fileId, state) => {
    if (!state || state.finalized) return;
    state.finalized = true;
    Object.values(state.ackTimers).forEach(clearTimeout);

    const tracker  = speedTrackers.current[fileId];
    const duration = tracker ? (Date.now() - tracker.startTime) / 1000 : null;
    const avgSpeed = duration && state.fileSize ? state.fileSize / duration : null;

    delete sendStates.current[fileId];
    delete speedTrackers.current[fileId];

    onTransferComplete?.({
      id: fileId, name: state.fileName, size: state.fileSize,
      direction: "out", status: "done", duration, avgSpeed,
    });

    // Advance queue via stable ref — avoids circular dependency
    activeFileId.current = null;
    _advanceQueueRef.current?.();
  }, [onTransferComplete]);

  // ── Incoming data handler ──────────────────────────────────────────────────
  const handleDataRef = useRef(null);
  handleDataRef.current = (raw) => {
    if (!(raw instanceof ArrayBuffer) && !ArrayBuffer.isView(raw)) return;
    const frame = decodeFrame(raw instanceof ArrayBuffer ? raw : raw.buffer);
    if (!frame) return;

    // ── JSON control frames ──────────────────────────────────────────────────
    if (frame.type === "json") {
      const { data } = frame;

      // Chat message
      if (data.type === "chat") {
        addMessage({ type: "chat", text: data.text, sender: "them", time: data.time });
        return;
      }

      // Incoming file announcement
      if (data.type === "file-meta") {
        const { fileId, name, size, totalChunks, chunkSize } = data;
        const useStream = STREAM_SUPPORTED && size >= STREAM_MIN_BYTES;

        if (useStream) {
          const writablePromise = window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: "File", accept: { "application/octet-stream": ["*"] } }],
          })
            .then((fh) => fh.createWritable())
            .catch((err) => { console.warn("Save dialog cancelled:", err.message); return null; });

          const buf = {
            mode: "stream", writablePromise, writable: null, ready: false,
            flushing: false, pendingChunks: new Map(), nextExpected: 0, received: 0,
            chunks: null, meta: { name, size, totalChunks, chunkSize },
          };
          receiveBuffers.current[fileId] = buf;
          writablePromise.then((w) => {
            const b = receiveBuffers.current[fileId]; if (!b) return;
            if (w) { b.writable = w; b.ready = true; flushPending(fileId); }
            else activateFallback(fileId, b);
          });
        } else {
          receiveBuffers.current[fileId] = {
            mode: "buffer", chunks: new Array(totalChunks), received: 0,
            meta: { name, size, totalChunks, chunkSize },
          };
        }

        speedTrackers.current[fileId] = { startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null };
        setTransfers((prev) => [...prev, {
          id: fileId, name, size, progress: 0, direction: "in", status: "receiving",
          speed: 0, eta: null, chunkSize, received: 0, totalChunks,
          streamMode: useStream, canCancel: true,
        }]);
        return;
      }

      // Chunk ACK received by sender
      if (data.type === "chunk-ack") {
        const { fileId, index } = data;
        const state = sendStates.current[fileId];
        if (!state) return;
        if (state.ackTimers[index]) { clearTimeout(state.ackTimers[index]); delete state.ackTimers[index]; }
        state.ackedChunks = (state.ackedChunks || 0) + 1;
        const p = Math.min(99, Math.round((state.ackedChunks / state.totalChunks) * 100));
        updateTransfer(fileId, { progress: p });
        if (state.allDispatched && state.ackedChunks >= state.totalChunks) {
          const lbl = state.chunkSize >= 1024 * 1024
            ? `${state.chunkSize / (1024 * 1024)}MB`
            : `${state.chunkSize / 1024}KB`;
          updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
          addMessage({ type: "system", text: `📤 Sent "${state.fileName}" (${formatBytes(state.fileSize)}) — ${lbl} chunks` });
          _finalizeSender(fileId, state);
        }
        return;
      }

      // Receiver cancelled a transfer
      if (data.type === "cancel-transfer") {
        const { fileId } = data;
        const state = sendStates.current[fileId];
        if (state) { state.aborted = true; Object.values(state.ackTimers).forEach(clearTimeout); }
        updateTransfer(fileId, { status: "cancelled" });
        addMessage({ type: "system", text: "🚫 Receiver cancelled the transfer." });
        activeFileId.current = null;
        setTimeout(_advanceQueue, 300);
        return;
      }

      // Resume request from receiver after reconnect
      if (data.type === "resume-request") {
        const { fileId, receivedCount } = data;
        const state = sendStates.current[fileId];
        if (!state || state.aborted) return;
        state.resumeFrom = receivedCount;
        addMessage({ type: "system", text: `♻️ Resuming "${state.fileName}" from chunk ${receivedCount}…` });
        return;
      }

      return;
    }

    // ── Binary chunk received ────────────────────────────────────────────────
    if (frame.type === "chunk") {
      const { fileId, index, chunk } = frame;
      const buf = receiveBuffers.current[fileId];
      if (!buf) return;

      // ACK back to sender immediately
      connRef.current?.send(encodeJSON({ type: "chunk-ack", fileId, index }));

      if (buf.mode === "stream") {
        if (!buf.pendingChunks.has(index)) { buf.pendingChunks.set(index, chunk); buf.received++; }
        const bd = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
        const p  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
        const { speed, eta } = tickSpeed(fileId, bd, buf.meta.size);
        updateTransfer(fileId, { progress: p, speed, eta, received: buf.received });
        if (buf.ready && buf.writable) flushPending(fileId);
        if (buf.received === buf.meta.totalChunks) {
          (async () => {
            const b = receiveBuffers.current[fileId]; if (!b) return;
            if (!b.ready) {
              await b.writablePromise;
              const b2 = receiveBuffers.current[fileId]; if (!b2) return;
              if (b2.mode === "buffer") { finishBuffer(fileId, b2); return; }
            }
            await flushPending(fileId);
            const b3 = receiveBuffers.current[fileId]; if (!b3 || !b3.writable) return;
            try { await b3.writable.close(); } catch { }
            delete receiveBuffers.current[fileId];
            delete speedTrackers.current[fileId];
            updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
            addMessage({ type: "system", text: `✅ Saved "${buf.meta.name}" (${formatBytes(buf.meta.size)}) to disk 💾` });
            onTransferComplete?.({ id: fileId, name: buf.meta.name, size: buf.meta.size, direction: "in", status: "done" });
          })();
        }
        return;
      }

      if (buf.mode === "buffer") {
        if (!buf.chunks[index]) { buf.chunks[index] = chunk; buf.received++; }
        const bd = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
        const p  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
        const { speed, eta } = tickSpeed(fileId, bd, buf.meta.size);
        updateTransfer(fileId, { progress: p, speed, eta, received: buf.received });
        if (buf.received === buf.meta.totalChunks) finishBuffer(fileId, buf);
        return;
      }
    }
  };

  // ── Connection setup ───────────────────────────────────────────────────────
  const setupConn = useRef(null);
  setupConn.current = (connection) => {
    connection.on("open", () => {
      connRef.current     = connection;
      connectedRef.current = true;
      reconnectCount.current = 0;
      setReconnecting(false);

      // Grab raw DataChannel for back-pressure flow control
      const dc = connection._dc || connection.dataChannel || null;
      if (dc) { dc.bufferedAmountLowThreshold = LOW_WATERMARK; dcRef.current = dc; }
      else    { dcRef.current = null; }

      setConnected(true);
      setRoomCode(targetRoomCode.current);
      setScreen("room");
      addMessage({ type: "system", text: "🔗 Connected — end-to-end encrypted." });

      // Send resume requests for any in-flight receives (after reconnect)
      Object.entries(receiveBuffers.current).forEach(([fileId, buf]) => {
        if (buf.received > 0) {
          connection.send(encodeJSON({ type: "resume-request", fileId, receivedCount: buf.received }));
        }
      });

      // Resume queue or notify about active send
      if (activeFileId.current) {
        const state = sendStates.current[activeFileId.current];
        if (state && !state.finalized)
          addMessage({ type: "system", text: `♻️ Resuming send of "${state.fileName}"…` });
      } else {
        setTimeout(_advanceQueue, 200);
      }
    });

    connection.on("data",  (raw) => { handleDataRef.current?.(raw); });

    connection.on("close", () => {
      connRef.current = null; dcRef.current = null; connectedRef.current = false;
      setConnected(false);

      if (!intentionalLeave.current && reconnectCount.current < RECONNECT_MAX) {
        setTransfers((prev) => prev.map((t) =>
          t.status === "sending" || t.status === "receiving"
            ? { ...t, status: "reconnecting" } : t
        ));
        _attemptReconnect();
      } else {
        // Abort everything
        Object.values(sendStates.current).forEach((s) => {
          s.aborted = true;
          Object.values(s.ackTimers || {}).forEach(clearTimeout);
          if (s.resumeSend)  s.resumeSend();
          if (s.resumePause) s.resumePause();
        });
        Object.values(receiveBuffers.current).forEach(async (buf) => {
          if (buf.mode === "stream" && buf.writable) try { await buf.writable.abort(); } catch { }
        });
        sendStates.current = {}; speedTrackers.current = {}; receiveBuffers.current = {};
        setTransfers((prev) => prev.map((t) =>
          t.status !== "done" && t.status !== "cancelled" ? { ...t, status: "error" } : t
        ));
        addMessage({ type: "system", text: "⚠️ Peer disconnected." });
      }
    });

    connection.on("error", (err) => { console.error("DataConnection error:", err); });
  };

  // ── Auto-reconnect ─────────────────────────────────────────────────────────
  const _attemptReconnect = useCallback(() => {
    if (intentionalLeave.current) return;
    const attempt = reconnectCount.current + 1;
    if (attempt > RECONNECT_MAX) {
      setReconnecting(false);
      addMessage({ type: "system", text: "❌ Could not reconnect after 3 attempts." });
      setTransfers((prev) => prev.map((t) =>
        t.status === "reconnecting" ? { ...t, status: "error" } : t
      ));
      return;
    }
    reconnectCount.current = attempt;
    setReconnecting(true);
    const delay = RECONNECT_BASE_MS * Math.pow(2, attempt - 1);
    addMessage({ type: "system", text: `🔄 Reconnecting… attempt ${attempt}/${RECONNECT_MAX} (${delay / 1000}s)` });

    setTimeout(() => {
      if (intentionalLeave.current) return;
      const p    = peerRef.current;
      if (!p || p.destroyed) return;
      const code = targetRoomCode.current;
      if (!code) return;

      if (isHost.current) {
        addMessage({ type: "system", text: "⏳ Waiting for peer to rejoin…" });
      } else {
        const conn = p.connect(code, { reliable: true, serialization: "raw" });
        setupConn.current(conn);
      }
    }, delay);
  }, [addMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create room ────────────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    if (!libsReady) { setPeerError("Libraries still loading."); return; }
    setPeerError(""); intentionalLeave.current = false; isHost.current = true;

    const attemptCreate = (retries = 3) => {
      const code = generateRoomCode();
      const p    = new Peer(code, buildPeerOptions());

      p.on("open", (id) => {
        targetRoomCode.current = id;
        const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
        setRoomCode(id); setShareUrl(url); setPeer(p); setScreen("host");
      });
      p.on("connection", (conn) => { setupConn.current(conn); });
      p.on("error", (err) => {
        if (err.type === "unavailable-id" && retries > 0) { p.destroy(); attemptCreate(retries - 1); }
        else setPeerError(`Could not create room (${err.type}).`);
      });
    };
    attemptCreate();
  }, [libsReady]);

  // ── Join room ──────────────────────────────────────────────────────────────
  const joinRoom = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    if (!libsReady) { setPeerError("Libraries still loading."); return; }
    setPeerError("");
    // Do NOT navigate to room screen here — wait for setupConn "open" event
    intentionalLeave.current = false; isHost.current = false;
    targetRoomCode.current = code;

    const p = new Peer(undefined, buildPeerOptions());
    p.on("open", () => {
      const conn = p.connect(code, { reliable: true, serialization: "raw" });
      setupConn.current(conn); setPeer(p);
    });
    p.on("error", (err) => {
      setPeerError(err.type === "peer-unavailable"
        ? "Room not found. Check the code."
        : `Connection failed (${err.type}).`);
      setScreen("join");
    });
  }, [joinCode, libsReady]);

  // ── Queue a file ───────────────────────────────────────────────────────────
  const queueFile = useCallback((file) => {
    if (!connectedRef.current) return;
    const id    = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const entry = { id, file, status: "queued", name: file.name, size: file.size };
    setFileQueue((prev) => [...prev, entry]);
    return id;
  }, []);

  // Trigger queue advancement whenever fileQueue changes
  useEffect(() => {
    if (connected && !activeFileId.current) {
      const next = fileQueue.find((q) => q.status === "queued");
      if (next) _advanceQueue();
    }
  }, [fileQueue, connected, _advanceQueue]);

  // ── Internal send ──────────────────────────────────────────────────────────
  const _sendFileInternal = useCallback((file, fileId) => {
    const c = connRef.current;
    if (!c || !connectedRef.current) return;

    const chunkSize   = getChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / chunkSize);

    sendStates.current[fileId] = {
      aborted: false, paused: false, finalized: false,
      chunkSize, totalChunks, fileName: file.name, fileSize: file.size,
      ackTimers: {}, retryCounts: {}, ackedChunks: 0, allDispatched: false,
      resumeFrom: 0, resumeSend: null, resumePause: null,
    };
    speedTrackers.current[fileId] = { startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null };

    setTransfers((prev) => [...prev, {
      id: fileId, name: file.name, size: file.size,
      progress: 0, direction: "out", status: "sending",
      speed: 0, eta: null, chunkSize, sent: 0, totalChunks,
      canPause: true, canCancel: true,
    }]);

    c.send(encodeJSON({ type: "file-meta", fileId, name: file.name, size: file.size, totalChunks, chunkSize }));

    // waitForDrain — blocks until DataChannel buffer drops below LOW_WATERMARK
    const waitForDrain = () => new Promise((resolve, reject) => {
      const state = sendStates.current[fileId];
      if (!state || state.aborted) { reject(new Error("aborted")); return; }
      state.resumeSend = () => {
        state.resumeSend = null;
        const s = sendStates.current[fileId];
        if (!s || s.aborted) reject(new Error("aborted")); else resolve();
      };
      const liveDc = dcRef.current;
      if (liveDc) {
        liveDc.onbufferedamountlow = () => { if (state.resumeSend) state.resumeSend(); };
      } else {
        const poll = setInterval(() => {
          const s = sendStates.current[fileId];
          if (!s || s.aborted) { clearInterval(poll); reject(new Error("aborted")); return; }
          const ba = connRef.current?._dc?.bufferedAmount ?? 0;
          if (ba <= LOW_WATERMARK) { clearInterval(poll); if (s.resumeSend) s.resumeSend(); }
        }, 50);
      }
    });

    // waitForResume — blocks while transfer is paused by user
    const waitForResume = () => new Promise((resolve, reject) => {
      const state = sendStates.current[fileId];
      if (!state || state.aborted) { reject(new Error("aborted")); return; }
      state.resumePause = () => {
        state.resumePause = null;
        const s = sendStates.current[fileId];
        if (!s || s.aborted) reject(new Error("aborted")); else resolve();
      };
    });

    // sendChunk — reads one chunk from disk and sends it
    const sendChunk = async (index) => {
      const state = sendStates.current[fileId];
      if (!state || state.aborted) return;
      if (!connRef.current || !connectedRef.current) {
        if (state) state.aborted = true;
        updateTransfer(fileId, { status: "error" });
        return;
      }

      // Back-pressure: check BEFORE reading chunk to avoid RAM spike
      const liveDc = dcRef.current;
      if (liveDc && liveDc.bufferedAmount > HIGH_WATERMARK) {
        try { await waitForDrain(); } catch { return; }
      }

      const stPre = sendStates.current[fileId];
      if (!stPre || stPre.aborted) return;

      const chunkBuffer = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = (e) => res(e.target.result);
        reader.onerror = () => rej(new Error("FileReader error"));
        reader.readAsArrayBuffer(file.slice(
          index * chunkSize,
          Math.min((index + 1) * chunkSize, file.size)
        ));
      });

      const st = sendStates.current[fileId];
      if (!st || st.aborted) return;

      // SCTP frame size guard
      const frame    = encodeChunk(fileId, index, chunkBuffer);
      const maxBytes = dcRef.current?.maxMessageSize ?? Infinity;
      if (frame.byteLength > maxBytes) {
        st.aborted = true;
        updateTransfer(fileId, { status: "error" });
        addMessage({ type: "system", text: `❌ Frame too large (${frame.byteLength}B > ${maxBytes}B).` });
        return;
      }

      try { connRef.current.send(frame); }
      catch (err) {
        console.error("Send err:", err);
        st.aborted = true;
        updateTransfer(fileId, { status: "error" });
        return;
      }

      // ACK timeout — retry or abort if no ACK within CHUNK_ACK_TIMEOUT
      const timer = setTimeout(() => {
        const s = sendStates.current[fileId];
        if (!s || s.aborted || !connectedRef.current) return;
        s.retryCounts[index] = (s.retryCounts[index] || 0) + 1;
        if (s.retryCounts[index] >= CHUNK_RETRY_LIMIT) {
          s.aborted = true;
          Object.values(s.ackTimers).forEach(clearTimeout);
          updateTransfer(fileId, { status: "error" });
          addMessage({ type: "system", text: `❌ "${file.name}" failed — chunk ${index} timed out.` });
        } else {
          sendChunk(index);
        }
      }, CHUNK_ACK_TIMEOUT);

      const st2 = sendStates.current[fileId];
      if (st2) st2.ackTimers[index] = timer;
    };

    // advanceSender — main send loop
    const advanceSender = async () => {
      await new Promise((r) => setTimeout(r, SCTP_WARMUP_MS));

      const state0     = sendStates.current[fileId];
      let chunkIndex   = state0?.resumeFrom ?? 0;
      if (chunkIndex > 0 && state0) state0.ackedChunks = chunkIndex;

      while (true) {
        const state = sendStates.current[fileId];
        if (!state || state.aborted) break;

        // Pause gate
        if (state.paused) {
          updateTransfer(fileId, { status: "paused" });
          try { await waitForResume(); }
          catch { break; }
          updateTransfer(fileId, { status: "sending" });
        }

        if (chunkIndex >= totalChunks) break;

        const index = chunkIndex++;
        await sendChunk(index);

        const bd = Math.min(chunkIndex * chunkSize, file.size);
        const p  = Math.min(99, Math.round((chunkIndex / totalChunks) * 100));
        const { speed, eta } = tickSpeed(fileId, bd, file.size);
        updateTransfer(fileId, { progress: p, speed, eta, sent: chunkIndex });
      }

      const st = sendStates.current[fileId];
      if (st && !st.aborted) {
        st.allDispatched = true;
        if (st.ackedChunks >= totalChunks) {
          const lbl = chunkSize >= 1024 * 1024
            ? `${chunkSize / (1024 * 1024)}MB`
            : `${chunkSize / 1024}KB`;
          updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
          addMessage({ type: "system", text: `📤 Sent "${file.name}" (${formatBytes(file.size)}) — ${lbl} chunks` });
          _finalizeSender(fileId, st);
        }
      }
    };

    advanceSender();
  }, [addMessage, updateTransfer, tickSpeed, _finalizeSender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause / Resume / Cancel ────────────────────────────────────────────────
  const pauseTransfer = useCallback((fileId) => {
    const state = sendStates.current[fileId];
    if (!state || state.aborted || state.paused) return;
    state.paused = true;
  }, []);

  const resumeTransfer = useCallback((fileId) => {
    const state = sendStates.current[fileId];
    if (!state || state.aborted || !state.paused) return;
    state.paused = false;
    if (state.resumePause) state.resumePause();
    updateTransfer(fileId, { status: "sending" });
  }, [updateTransfer]);

  const cancelTransfer = useCallback((fileId) => {
    const state = sendStates.current[fileId];
    if (state) {
      state.aborted = true;
      Object.values(state.ackTimers).forEach(clearTimeout);
      if (state.resumeSend)  state.resumeSend();
      if (state.resumePause) state.resumePause();
    }
    updateTransfer(fileId, { status: "cancelled" });
    setFileQueue((prev) => prev.map((q) => q.id === fileId ? { ...q, status: "cancelled" } : q));
    if (activeFileId.current === fileId) {
      activeFileId.current = null;
      setTimeout(_advanceQueue, 300);
    }
  }, [updateTransfer, _advanceQueue]);

  const cancelReceive = useCallback((fileId) => {
    const buf = receiveBuffers.current[fileId];
    if (buf?.mode === "stream" && buf.writable) buf.writable.abort().catch(() => { });
    delete receiveBuffers.current[fileId];
    delete speedTrackers.current[fileId];
    updateTransfer(fileId, { status: "cancelled" });
    connRef.current?.send(encodeJSON({ type: "cancel-transfer", fileId }));
  }, [updateTransfer]);

  const removeFromQueue = useCallback((id) => {
    if (activeFileId.current === id) return;  // don't remove actively-sending file
    setFileQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // ── Send chat ──────────────────────────────────────────────────────────────
  const sendChat = useCallback((text) => {
    const c = connRef.current;
    if (!c || !connectedRef.current || !text.trim()) return false;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    try { c.send(encodeJSON({ type: "chat", text: text.trim(), time })); }
    catch { addMessage({ type: "system", text: "⚠️ Message failed." }); return false; }
    addMessage({ type: "chat", text: text.trim(), sender: "me", time });
    return true;
  }, [addMessage]);

  // ── Leave room ─────────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    intentionalLeave.current = true;

    Object.values(receiveBuffers.current).forEach(async (buf) => {
      if (buf.mode === "stream" && buf.writable) try { await buf.writable.abort(); } catch { }
    });
    Object.values(sendStates.current).forEach((s) => {
      s.aborted = true;
      Object.values(s.ackTimers || {}).forEach(clearTimeout);
      if (s.resumeSend)  s.resumeSend();
      if (s.resumePause) s.resumePause();
    });

    sendStates.current = {}; speedTrackers.current = {}; receiveBuffers.current = {};
    connRef.current = null; dcRef.current = null; connectedRef.current = false;
    activeFileId.current = null; reconnectCount.current = 0;

    try { peerRef.current?.destroy(); } catch { }

    setPeer(null); setConnected(false); setMessages([]); setTransfers([]);
    setFileQueue([]); setRoomCode(""); setShareUrl(""); setPeerError("");
    setJoinCode(""); setScreen("home"); setReconnecting(false);
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    screen, setScreen, roomCode, shareUrl, joinCode, setJoinCode,
    connected, reconnecting, messages, transfers, setTransfers, fileQueue,
    peerError, setPeerError, libsReady,
    streamSupported: STREAM_SUPPORTED,
    createRoom, joinRoom, queueFile, sendChat, leaveRoom,
    pauseTransfer, resumeTransfer, cancelTransfer, cancelReceive,
    removeFromQueue,
  };
}