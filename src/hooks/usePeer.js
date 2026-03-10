// import { useState, useEffect, useRef, useCallback } from "react";
// import {
//   getChunkSize,
//   generateRoomCode,
//   formatBytes,
//   ICE_SERVERS,
//   CHUNK_RETRY_LIMIT,
//   CHUNK_ACK_TIMEOUT,
//   SPEED_UPDATE_MS,
//   PEERJS_CDN,
//   QRCODE_CDN,
//   loadScript,
// } from "../constants";

// // ─── Feature detection ────────────────────────────────────────────────────────
// // File System Access API — Chrome/Edge 86+. Not in Firefox or Safari.
// const STREAM_SUPPORTED = typeof window !== "undefined" && "showSaveFilePicker" in window;

// // Files below this size always use buffer mode (no benefit opening a Save dialog)
// const STREAM_MIN_BYTES = 1 * 1024 * 1024; // 1 MB

// // Warn user about RAM usage above this threshold in buffer mode
// const BUFFER_WARN_BYTES = 200 * 1024 * 1024; // 200 MB

// // ─── usePeer ──────────────────────────────────────────────────────────────────
// // All PeerJS + WebRTC logic. Returns stable state and action callbacks.
// // ─────────────────────────────────────────────────────────────────────────────
// export function usePeer() {
//   const [screen,    setScreen]    = useState("home");
//   const [roomCode,  setRoomCode]  = useState("");
//   const [joinCode,  setJoinCode]  = useState("");
//   const [peer,      setPeer]      = useState(null);
//   const [connected, setConnected] = useState(false);
//   const [messages,  setMessages]  = useState([]);
//   const [transfers, setTransfers] = useState([]);
//   const [shareUrl,  setShareUrl]  = useState("");
//   const [peerError, setPeerError] = useState("");
//   const [libsReady, setLibsReady] = useState(false);

//   // ── Stable refs (avoid stale closures in async PeerJS callbacks) ─────────────
//   const connRef        = useRef(null);
//   const connectedRef   = useRef(false);
//   const sendStates     = useRef({});    // { fileId: SendState }
//   const speedTrackers  = useRef({});    // { fileId: SpeedTracker }

//   // receiveBuffers: two possible shapes per fileId ──────────────────────────────
//   //
//   // Stream mode (STREAM_SUPPORTED && size >= STREAM_MIN_BYTES):
//   //   { mode:"stream", writable:FileSystemWritableFileStream|null,
//   //     writablePromise:Promise, ready:boolean, fallback:boolean,
//   //     pendingChunks:Map<index,ArrayBuffer>, nextExpected:number,
//   //     received:number, chunks:Array|null,
//   //     meta:{ name, size, totalChunks, chunkSize } }
//   //
//   // Buffer mode (fallback or small files):
//   //   { mode:"buffer", chunks:Array<ArrayBuffer>, received:number,
//   //     meta:{ name, size, totalChunks, chunkSize } }
//   const receiveBuffers = useRef({});

//   useEffect(() => { connectedRef.current = connected; }, [connected]);

//   // ── Load CDN libraries ────────────────────────────────────────────────────────
//   useEffect(() => {
//     Promise.all([loadScript(PEERJS_CDN), loadScript(QRCODE_CDN)])
//       .then(() => setLibsReady(true))
//       .catch(() =>
//         setPeerError("Failed to load required libraries. Check your internet connection.")
//       );
//   }, []);

//   // ── Parse room code from URL ──────────────────────────────────────────────────
//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     const roomParam = params.get("room");
//     if (roomParam) {
//       setJoinCode(roomParam.toUpperCase());
//       setScreen("join");
//     }
//   }, []);

//   // ── Stable state helpers ──────────────────────────────────────────────────────
//   const addMessage = useCallback((msg) => {
//     setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }]);
//   }, []);

//   const updateTransfer = useCallback((fileId, patch) => {
//     setTransfers((prev) =>
//       prev.map((t) => (t.id === fileId ? { ...t, ...patch } : t))
//     );
//   }, []);

//   // ── Speed / ETA calculation ───────────────────────────────────────────────────
//   const tickSpeedTracker = useCallback((fileId, bytesDone, totalBytes) => {
//     const tracker = speedTrackers.current[fileId];
//     if (!tracker) return {};
//     const now     = Date.now();
//     const elapsed = (now - tracker.startTime) / 1000;
//     if (elapsed <= 0) return {};
//     // Throttle updates to avoid UI jitter
//     if (now - tracker.lastUpdate < SPEED_UPDATE_MS && tracker.speed !== undefined) {
//       return { speed: tracker.speed, eta: tracker.eta };
//     }
//     const speed     = bytesDone / elapsed;
//     const remaining = totalBytes - bytesDone;
//     const eta       = speed > 0 ? remaining / speed : null;
//     speedTrackers.current[fileId] = { ...tracker, lastUpdate: now, speed, eta };
//     return { speed, eta };
//   }, []);

//   // ── Stream helper: flush consecutive pending chunks to WritableStream ─────────
//   // WebRTC DataChannel (reliable:true) delivers in order, so pendingChunks rarely
//   // has gaps. The Map is a safety net for any edge-case reordering.
//   const flushPending = useCallback(
//     async (fileId) => {
//       const buf = receiveBuffers.current[fileId];
//       if (!buf || buf.mode !== "stream" || !buf.writable) return;

//       while (buf.pendingChunks.has(buf.nextExpected)) {
//         const chunk = buf.pendingChunks.get(buf.nextExpected);
//         buf.pendingChunks.delete(buf.nextExpected);
//         try {
//           await buf.writable.write(new Uint8Array(chunk));
//         } catch (err) {
//           // Disk full, stream closed by user, etc.
//           console.error("WritableStream write error:", err);
//           updateTransfer(fileId, { status: "error" });
//           addMessage({
//             type: "system",
//             text: `❌ Stream write failed for "${buf.meta.name}". Disk full or save cancelled?`,
//           });
//           delete receiveBuffers.current[fileId];
//           delete speedTrackers.current[fileId];
//           return;
//         }
//         buf.nextExpected++;
//       }
//     },
//     [addMessage, updateTransfer]
//   );

//   // ── Helper: switch a stream-mode buffer to buffer fallback ────────────────────
//   // Called when showSaveFilePicker is cancelled or fails after chunks already arrived.
//   const activateFallback = useCallback(
//     (fileId, buf) => {
//       buf.mode     = "buffer";
//       buf.fallback = true;
//       buf.chunks   = new Array(buf.meta.totalChunks);
//       // Drain any already-queued pending chunks into the chunks array
//       buf.pendingChunks.forEach((chunk, idx) => {
//         buf.chunks[idx] = chunk;
//       });
//       buf.pendingChunks.clear();
//       if (buf.meta.size > BUFFER_WARN_BYTES) {
//         addMessage({
//           type: "system",
//           text: `⚠️ Streaming cancelled — buffering "${buf.meta.name}" in RAM. Large files may slow your browser.`,
//         });
//       }
//     },
//     [addMessage]
//   );

//   // ── Incoming data handler ─────────────────────────────────────────────────────
//   // Stored in a ref so PeerJS event listeners always call the latest version
//   // without needing to re-register (which would break the connection).
//   const handleIncomingDataRef = useRef(null);
//   handleIncomingDataRef.current = (data) => {
//     if (!data?.type) return;

//     // ── Chat ──────────────────────────────────────────────────────────────────
//     if (data.type === "chat") {
//       addMessage({ type: "chat", text: data.text, sender: "them", time: data.time });
//       return;
//     }

//     // ── File metadata ─────────────────────────────────────────────────────────
//     if (data.type === "file-meta") {
//       const { fileId, name, size, totalChunks, chunkSize } = data;
//       const useStream = STREAM_SUPPORTED && size >= STREAM_MIN_BYTES;

//       if (useStream) {
//         // Open save dialog immediately — user picks save location before chunks arrive.
//         // We keep a reference to the promise so the chunk handler can wait on it.
//         const writablePromise = window.showSaveFilePicker({
//           suggestedName: name,
//           types: [{ description: "File", accept: { "application/octet-stream": ["*"] } }],
//         })
//           .then((fileHandle) => fileHandle.createWritable())
//           .catch((err) => {
//             // User dismissed the dialog → will activate fallback when promise resolves
//             console.warn("Save dialog cancelled:", err.message);
//             return null;
//           });

//         const buf = {
//           mode: "stream",
//           writablePromise,
//           writable: null,
//           ready: false,
//           fallback: false,
//           pendingChunks: new Map(),
//           nextExpected: 0,
//           received: 0,
//           chunks: null,
//           meta: { name, size, totalChunks, chunkSize },
//         };
//         receiveBuffers.current[fileId] = buf;

//         // Resolve promise: either get writable or activate RAM fallback
//         writablePromise.then((writable) => {
//           const b = receiveBuffers.current[fileId];
//           if (!b) return; // transfer finished while dialog was open — nothing to do

//           if (writable) {
//             b.writable = writable;
//             b.ready    = true;
//             // Drain any chunks that arrived while dialog was open
//             flushPending(fileId);
//           } else {
//             // Dialog cancelled — switch to buffer mode
//             activateFallback(fileId, b);
//           }
//         });
//       } else {
//         // Buffer mode: small file or unsupported browser
//         receiveBuffers.current[fileId] = {
//           mode: "buffer",
//           chunks: new Array(totalChunks),
//           received: 0,
//           meta: { name, size, totalChunks, chunkSize },
//         };
//         if (!STREAM_SUPPORTED && size > BUFFER_WARN_BYTES) {
//           addMessage({
//             type: "system",
//             text: `⚠️ Your browser doesn't support streaming saves. "${name}" (${formatBytes(size)}) will be buffered in RAM.`,
//           });
//         }
//       }

//       speedTrackers.current[fileId] = {
//         startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null,
//       };

//       setTransfers((prev) => [
//         ...prev,
//         {
//           id: fileId, name, size,
//           progress: 0, direction: "in", status: "receiving",
//           speed: 0, eta: null, chunkSize, received: 0, totalChunks,
//           streamMode: useStream,
//         },
//       ]);
//       return;
//     }

//     // ── File chunk ────────────────────────────────────────────────────────────
//     if (data.type === "file-chunk") {
//       const { fileId, chunk, index } = data;
//       const buf = receiveBuffers.current[fileId];
//       if (!buf) return;

//       // Always ACK immediately so sender can clear its retry timer
//       connRef.current?.send({ type: "chunk-ack", fileId, index });

//       // ── STREAM MODE ──────────────────────────────────────────────────────────
//       if (buf.mode === "stream") {
//         // Queue chunk (deduplication: skip if already seen)
//         if (!buf.pendingChunks.has(index)) {
//           buf.pendingChunks.set(index, chunk);
//           buf.received++;
//         }

//         const bytesDone = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
//         const progress  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
//         const { speed, eta } = tickSpeedTracker(fileId, bytesDone, buf.meta.size);
//         updateTransfer(fileId, { progress, speed, eta, received: buf.received });

//         // Flush if writable is ready; otherwise chunks stay in pendingChunks
//         // until writablePromise resolves and flushPending is called there.
//         if (buf.ready && buf.writable) {
//           flushPending(fileId); // async — non-blocking
//         }

//         // All chunks received
//         if (buf.received === buf.meta.totalChunks) {
//           // Wait for pending flushes, then close the stream
//           const finishStream = async () => {
//             const b = receiveBuffers.current[fileId];
//             if (!b) return;

//             // If writable isn't ready yet (user still has dialog open), wait for it
//             if (!b.ready) {
//               await b.writablePromise;
//               // After promise resolves, re-check — might have fallen back to buffer
//               const b2 = receiveBuffers.current[fileId];
//               if (!b2) return;
//               if (b2.mode === "buffer") {
//                 finishBuffer(fileId, b2);
//                 return;
//               }
//             }

//             await flushPending(fileId);
//             const b3 = receiveBuffers.current[fileId];
//             if (!b3 || !b3.writable) return;
//             try {
//               await b3.writable.close();
//             } catch (err) {
//               console.error("WritableStream close error:", err);
//             }
//             delete receiveBuffers.current[fileId];
//             delete speedTrackers.current[fileId];
//             updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//             addMessage({
//               type: "system",
//               text: `✅ Saved "${buf.meta.name}" (${formatBytes(buf.meta.size)}) directly to disk 💾`,
//             });
//           };
//           finishStream();
//         }
//         return;
//       }

//       // ── BUFFER MODE ──────────────────────────────────────────────────────────
//       if (buf.mode === "buffer") {
//         // Idempotent store — ignore duplicate chunks from retries
//         if (!buf.chunks[index]) {
//           buf.chunks[index] = chunk;
//           buf.received++;
//         }

//         const bytesDone = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
//         const progress  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
//         const { speed, eta } = tickSpeedTracker(fileId, bytesDone, buf.meta.size);
//         updateTransfer(fileId, { progress, speed, eta, received: buf.received });

//         if (buf.received === buf.meta.totalChunks) {
//           finishBuffer(fileId, buf);
//         }
//         return;
//       }
//     }

//     // ── ACK received by sender ────────────────────────────────────────────────
//     if (data.type === "chunk-ack") {
//       const { fileId, index } = data;
//       const state = sendStates.current[fileId];
//       if (!state) return;
//       if (state.ackTimers[index]) {
//         clearTimeout(state.ackTimers[index]);
//         delete state.ackTimers[index];
//       }
//     }
//   };

//   // ── Buffer finisher (shared by buffer mode and stream→buffer fallback) ────────
//   // Extracted as a plain function (not useCallback) since it's called from within
//   // the data handler which already captures addMessage/updateTransfer via closure.
//   const finishBuffer = useCallback((fileId, buf) => {
//     const blob = new Blob(buf.chunks.map((c) => new Uint8Array(c)));
//     const url  = URL.createObjectURL(blob);
//     const a    = document.createElement("a");
//     a.href     = url;
//     a.download = buf.meta.name;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     setTimeout(() => URL.revokeObjectURL(url), 2000);
//     delete receiveBuffers.current[fileId];
//     delete speedTrackers.current[fileId];
//     updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//     addMessage({
//       type: "system",
//       text: `✅ Received "${buf.meta.name}" (${formatBytes(buf.meta.size)})`,
//     });
//   }, [addMessage, updateTransfer]);

//   // ── Connection setup ──────────────────────────────────────────────────────────
//   const setupConnectionRef = useRef(null);
//   setupConnectionRef.current = (connection) => {
//     connection.on("open", () => {
//       connRef.current      = connection;
//       connectedRef.current = true;
//       setConnected(true);
//       setScreen("room");
//       addMessage({ type: "system", text: "🔗 Peer connected — channel is encrypted & direct." });
//       if (STREAM_SUPPORTED) {
//         addMessage({
//           type: "system",
//           text: "💾 Stream mode active — large files write directly to disk, no RAM limit.",
//         });
//       }
//     });

//     connection.on("data", (data) => {
//       handleIncomingDataRef.current?.(data);
//     });

//     connection.on("close", () => {
//       // Abort any open WritableStreams to release file locks
//       Object.values(receiveBuffers.current).forEach(async (buf) => {
//         if (buf.mode === "stream" && buf.writable) {
//           try { await buf.writable.abort(); } catch {}
//         }
//       });
//       connRef.current      = null;
//       connectedRef.current = false;
//       setConnected(false);
//       receiveBuffers.current = {};
//       Object.values(sendStates.current).forEach((s) => { s.aborted = true; });
//       sendStates.current    = {};
//       speedTrackers.current = {};
//       addMessage({ type: "system", text: "⚠️ Peer disconnected." });
//       setTransfers((prev) =>
//         prev.map((t) => (t.status !== "done" ? { ...t, status: "error" } : t))
//       );
//     });

//     connection.on("error", (err) => {
//       console.error("DataConnection error:", err);
//       setPeerError("Connection error. Try reconnecting.");
//     });
//   };

//   // ── Create room (Host) ────────────────────────────────────────────────────────
//   const createRoom = useCallback(() => {
//     if (!libsReady || !window.Peer) {
//       setPeerError("Libraries still loading — please wait.");
//       return;
//     }
//     setPeerError("");

//     const attemptCreate = (retries = 3) => {
//       const code = generateRoomCode();
//       const p    = new window.Peer(code, { debug: 0, config: { iceServers: ICE_SERVERS } });

//       p.on("open", (id) => {
//         const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
//         setRoomCode(id);
//         setShareUrl(url);
//         setPeer(p);
//         setScreen("host");
//       });

//       p.on("connection", (connection) => {
//         setupConnectionRef.current(connection);
//       });

//       p.on("error", (err) => {
//         if (err.type === "unavailable-id" && retries > 0) {
//           p.destroy();
//           attemptCreate(retries - 1);
//         } else {
//           setPeerError(`Could not create room (${err.type}). Please try again.`);
//         }
//       });
//     };

//     attemptCreate();
//   }, [libsReady]);

//   // ── Join room ─────────────────────────────────────────────────────────────────
//   const joinRoom = useCallback(() => {
//     const targetCode = joinCode.trim().toUpperCase();
//     if (!targetCode) return;
//     if (!libsReady || !window.Peer) {
//       setPeerError("Libraries still loading — please wait.");
//       return;
//     }
//     setPeerError("");
//     setScreen("room");

//     const p = new window.Peer(undefined, { debug: 0, config: { iceServers: ICE_SERVERS } });

//     p.on("open", () => {
//       const connection = p.connect(targetCode, { reliable: true, serialization: "binary" });
//       setupConnectionRef.current(connection);
//       setPeer(p);
//     });

//     p.on("error", (err) => {
//       const msg =
//         err.type === "peer-unavailable"
//           ? "Room not found. Check the code and try again."
//           : `Connection failed (${err.type}). Try again.`;
//       setPeerError(msg);
//       setScreen("join");
//     });
//   }, [joinCode, libsReady]);

//   // ── Send file (adaptive chunking + ACK retry + speed/ETA) ────────────────────
//   const sendFile = useCallback(
//     (file) => {
//       const c = connRef.current;
//       if (!c || !connectedRef.current) return;

//       const fileId      = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
//       const chunkSize   = getChunkSize(file.size);
//       const totalChunks = Math.ceil(file.size / chunkSize);

//       sendStates.current[fileId] = {
//         aborted: false, chunkSize, totalChunks,
//         ackTimers: {}, retryCounts: {},
//       };
//       speedTrackers.current[fileId] = {
//         startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null,
//       };

//       setTransfers((prev) => [
//         ...prev,
//         {
//           id: fileId, name: file.name, size: file.size,
//           progress: 0, direction: "out", status: "sending",
//           speed: 0, eta: null, chunkSize, sent: 0, totalChunks,
//           streamMode: false,
//         },
//       ]);

//       c.send({ type: "file-meta", fileId, name: file.name, size: file.size, totalChunks, chunkSize });

//       let chunkIndex = 0;

//       // ── Send one chunk with ACK + retry ─────────────────────────────────────
//       const sendChunk = (index) => {
//         const state = sendStates.current[fileId];
//         if (!state || state.aborted) return;

//         const currentConn = connRef.current;
//         if (!currentConn || !connectedRef.current) {
//           if (state) state.aborted = true;
//           updateTransfer(fileId, { status: "error" });
//           return;
//         }

//         const start       = index * chunkSize;
//         const end         = Math.min(start + chunkSize, file.size);
//         const chunkReader = new FileReader();

//         chunkReader.onload = (e) => {
//           const st = sendStates.current[fileId];
//           if (!st || st.aborted) return;

//           try {
//             currentConn.send({ type: "file-chunk", fileId, chunk: e.target.result, index });
//           } catch {
//             st.aborted = true;
//             updateTransfer(fileId, { status: "error" });
//             return;
//           }

//           // ACK watchdog timer
//           const timer = setTimeout(() => {
//             const st2 = sendStates.current[fileId];
//             if (!st2 || st2.aborted) return;
//             st2.retryCounts[index] = (st2.retryCounts[index] || 0) + 1;
//             if (st2.retryCounts[index] >= CHUNK_RETRY_LIMIT) {
//               st2.aborted = true;
//               updateTransfer(fileId, { status: "error" });
//               addMessage({
//                 type: "system",
//                 text: `❌ "${file.name}" failed — chunk ${index} timed out after ${CHUNK_RETRY_LIMIT} retries.`,
//               });
//             } else {
//               sendChunk(index); // retry
//             }
//           }, CHUNK_ACK_TIMEOUT);

//           sendStates.current[fileId].ackTimers[index] = timer;
//         };

//         chunkReader.onerror = () => {
//           const st = sendStates.current[fileId];
//           if (st) st.aborted = true;
//           updateTransfer(fileId, { status: "error" });
//         };

//         chunkReader.readAsArrayBuffer(file.slice(start, end));
//       };

//       // ── Advance sender ───────────────────────────────────────────────────────
//       const advanceSender = () => {
//         const state = sendStates.current[fileId];
//         if (!state || state.aborted || chunkIndex >= totalChunks) return;

//         const index     = chunkIndex++;
//         sendChunk(index);

//         const bytesDone = Math.min(chunkIndex * chunkSize, file.size);
//         const progress  = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));
//         const { speed, eta } = tickSpeedTracker(fileId, bytesDone, file.size);
//         updateTransfer(fileId, { progress, speed, eta, sent: chunkIndex });

//         if (chunkIndex < totalChunks) {
//           // Adaptive throttle: smaller chunks need more pacing to avoid buffer overflow
//           const delay = chunkSize <= 16 * 1024 ? 12 : chunkSize <= 64 * 1024 ? 8 : 4;
//           setTimeout(advanceSender, delay);
//         } else {
//           // All chunks dispatched — mark done
//           updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//           delete speedTrackers.current[fileId];
//           const chunkLabel = chunkSize >= 1024 * 1024
//             ? `${chunkSize / (1024 * 1024)}MB`
//             : `${chunkSize / 1024}KB`;
//           addMessage({
//             type: "system",
//             text: `📤 Sent "${file.name}" (${formatBytes(file.size)}) — ${chunkLabel} chunks`,
//           });
//           const st = sendStates.current[fileId];
//           if (st) {
//             Object.values(st.ackTimers).forEach(clearTimeout);
//             delete sendStates.current[fileId];
//           }
//         }
//       };

//       advanceSender();
//     },
//     [addMessage, updateTransfer, tickSpeedTracker]
//   );

//   // ── Send chat ─────────────────────────────────────────────────────────────────
//   const sendChat = useCallback(
//     (text) => {
//       const c = connRef.current;
//       if (!c || !connectedRef.current || !text.trim()) return false;
//       const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//       try {
//         c.send({ type: "chat", text: text.trim(), time });
//       } catch {
//         addMessage({ type: "system", text: "⚠️ Message failed to send." });
//         return false;
//       }
//       addMessage({ type: "chat", text: text.trim(), sender: "me", time });
//       return true;
//     },
//     [addMessage]
//   );

//   // ── Leave / full reset ────────────────────────────────────────────────────────
//   const leaveRoom = useCallback(() => {
//     // Close/abort any open WritableStreams
//     Object.values(receiveBuffers.current).forEach(async (buf) => {
//       if (buf.mode === "stream" && buf.writable) {
//         try { await buf.writable.abort(); } catch {}
//       }
//     });
//     // Clear all send timers
//     Object.values(sendStates.current).forEach((s) => {
//       s.aborted = true;
//       Object.values(s.ackTimers || {}).forEach(clearTimeout);
//     });
//     sendStates.current     = {};
//     speedTrackers.current  = {};
//     receiveBuffers.current = {};
//     connRef.current        = null;
//     connectedRef.current   = false;

//     try { peer?.destroy(); } catch {}

//     setPeer(null);
//     setConnected(false);
//     setMessages([]);
//     setTransfers([]);
//     setRoomCode("");
//     setShareUrl("");
//     setPeerError("");
//     setJoinCode("");
//     setScreen("home");
//   }, [peer]);

//   return {
//     screen, setScreen,
//     roomCode, shareUrl,
//     joinCode, setJoinCode,
//     connected,
//     messages,
//     transfers, setTransfers,
//     peerError, setPeerError,
//     libsReady,
//     streamSupported: STREAM_SUPPORTED,
//     createRoom, joinRoom, sendFile, sendChat, leaveRoom,
//   };
// }

// import { useState, useEffect, useRef, useCallback } from "react";
// import {
//   getChunkSize,
//   generateRoomCode,
//   formatBytes,
//   ICE_SERVERS,
//   CHUNK_RETRY_LIMIT,
//   CHUNK_ACK_TIMEOUT,
//   SPEED_UPDATE_MS,
//   PEERJS_CDN,
//   QRCODE_CDN,
//   loadScript,
// } from "../constants";

// // ─── Feature detection ────────────────────────────────────────────────────────
// const STREAM_SUPPORTED  = typeof window !== "undefined" && "showSaveFilePicker" in window;
// const STREAM_MIN_BYTES  = 1  * 1024 * 1024;   // 1 MB
// const BUFFER_WARN_BYTES = 200 * 1024 * 1024;  // 200 MB

// // ─── Flow-control watermarks ──────────────────────────────────────────────────
// //
// // ROOT CAUSE OF DISCONNECT:
// //   WebRTC DataChannel has an internal send buffer. When you call .send()
// //   faster than the network drains it, bufferedAmount climbs. Chrome closes
// //   the DataChannel hard (no error, just "close") when bufferedAmount exceeds
// //   ~16 MB. With 256 KB chunks at 4 ms intervals, we can queue 64 MB/s —
// //   the channel dies in under a second on any file > a few MB.
// //
// //   59 KB file  →  4 chunks × 16 KB  =   64 KB total  → safe
// //   30 MB file  → 120 chunks × 256 KB = ~30 MB queued in <500 ms → CRASH
// //
// // FIX: back-pressure via DataChannel.bufferedAmount + bufferedAmountLowThreshold
// //   HIGH_WATERMARK  — pause sending when buffer exceeds this
// //   LOW_WATERMARK   — resume sending when buffer drains to this (via onbufferedamountlow)
// //
// // This is the standard WebRTC flow-control pattern. No setTimeout guessing.

// const HIGH_WATERMARK = 1   * 1024 * 1024;  // 1 MB  — pause above this
// const LOW_WATERMARK  = 256 * 1024;          // 256 KB — resume below this
// const SCTP_WARMUP_MS = 50;                  // initial delay before first chunk

// // ─── Framing protocol ─────────────────────────────────────────────────────────
// //
// // All data travels as ArrayBuffer (serialization:"raw").
// // First byte identifies frame type:
// //
// //   0x01  Control frame: [ 0x01 ][ UTF-8 JSON bytes ]
// //   0x02  Chunk frame:   [ 0x02 ][ u16 fileIdLen ][ fileId bytes ][ u32 index ][ chunk bytes ]

// const TYPE_JSON  = 0x01;
// const TYPE_CHUNK = 0x02;

// function encodeJSON(obj) {
//   const jsonBytes = new TextEncoder().encode(JSON.stringify(obj));
//   const buf       = new ArrayBuffer(1 + jsonBytes.byteLength);
//   new Uint8Array(buf).set([TYPE_JSON]);
//   new Uint8Array(buf).set(jsonBytes, 1);
//   return buf;
// }

// function encodeChunk(fileId, index, chunkBuffer) {
//   const idBytes = new TextEncoder().encode(fileId);
//   const header  = 1 + 2 + idBytes.byteLength + 4;
//   const buf     = new ArrayBuffer(header + chunkBuffer.byteLength);
//   const dv      = new DataView(buf);
//   const u8      = new Uint8Array(buf);

//   dv.setUint8(0,  TYPE_CHUNK);
//   dv.setUint16(1, idBytes.byteLength, false);      // big-endian u16
//   u8.set(idBytes, 3);
//   dv.setUint32(3 + idBytes.byteLength, index, false); // big-endian u32
//   u8.set(new Uint8Array(chunkBuffer), header);
//   return buf;
// }

// function decodeFrame(raw) {
//   const buf  = raw instanceof ArrayBuffer ? raw : raw.buffer;
//   const dv   = new DataView(buf);
//   const u8   = new Uint8Array(buf);
//   const kind = dv.getUint8(0);

//   if (kind === TYPE_JSON) {
//     try {
//       return { type: "json", data: JSON.parse(new TextDecoder().decode(u8.subarray(1))) };
//     } catch { return null; }
//   }

//   if (kind === TYPE_CHUNK) {
//     const idLen  = dv.getUint16(1, false);
//     const idEnd  = 3 + idLen;
//     const fileId = new TextDecoder().decode(u8.subarray(3, idEnd));
//     const index  = dv.getUint32(idEnd, false);
//     const chunk  = buf.slice(idEnd + 4);
//     return { type: "chunk", fileId, index, chunk };
//   }

//   return null;
// }

// // ─── usePeer ──────────────────────────────────────────────────────────────────
// export function usePeer() {
//   const [screen,    setScreen]    = useState("home");
//   const [roomCode,  setRoomCode]  = useState("");
//   const [joinCode,  setJoinCode]  = useState("");
//   const [peer,      setPeer]      = useState(null);
//   const [connected, setConnected] = useState(false);
//   const [messages,  setMessages]  = useState([]);
//   const [transfers, setTransfers] = useState([]);
//   const [shareUrl,  setShareUrl]  = useState("");
//   const [peerError, setPeerError] = useState("");
//   const [libsReady, setLibsReady] = useState(false);

//   // ── Refs ──────────────────────────────────────────────────────────────────────
//   const connRef        = useRef(null);
//   const dcRef          = useRef(null);   // raw RTCDataChannel for bufferedAmount checks
//   const connectedRef   = useRef(false);
//   const sendStates     = useRef({});
//   const speedTrackers  = useRef({});
//   const receiveBuffers = useRef({});

//   useEffect(() => { connectedRef.current = connected; }, [connected]);

//   // ── Load CDN libs ─────────────────────────────────────────────────────────────
//   useEffect(() => {
//     Promise.all([loadScript(PEERJS_CDN), loadScript(QRCODE_CDN)])
//       .then(() => setLibsReady(true))
//       .catch(() => setPeerError("Failed to load required libraries. Check your internet connection."));
//   }, []);

//   // ── Parse room code from URL ──────────────────────────────────────────────────
//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     const rp     = params.get("room");
//     if (rp) { setJoinCode(rp.toUpperCase()); setScreen("join"); }
//   }, []);

//   // ── Helpers ───────────────────────────────────────────────────────────────────
//   const addMessage = useCallback((msg) => {
//     setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }]);
//   }, []);

//   const updateTransfer = useCallback((fileId, patch) => {
//     setTransfers((prev) => prev.map((t) => t.id === fileId ? { ...t, ...patch } : t));
//   }, []);

//   const tickSpeedTracker = useCallback((fileId, bytesDone, totalBytes) => {
//     const tr = speedTrackers.current[fileId];
//     if (!tr) return {};
//     const now     = Date.now();
//     const elapsed = (now - tr.startTime) / 1000;
//     if (elapsed <= 0) return {};
//     if (now - tr.lastUpdate < SPEED_UPDATE_MS && tr.speed !== undefined)
//       return { speed: tr.speed, eta: tr.eta };
//     const speed = bytesDone / elapsed;
//     const eta   = speed > 0 ? (totalBytes - bytesDone) / speed : null;
//     speedTrackers.current[fileId] = { ...tr, lastUpdate: now, speed, eta };
//     return { speed, eta };
//   }, []);

//   // ── Stream flush (concurrent-safe) ───────────────────────────────────────────
//   const flushPending = useCallback(async (fileId) => {
//     const buf = receiveBuffers.current[fileId];
//     if (!buf || buf.mode !== "stream" || !buf.writable || buf.flushing) return;
//     buf.flushing = true;
//     while (buf.pendingChunks.has(buf.nextExpected)) {
//       const chunk = buf.pendingChunks.get(buf.nextExpected);
//       buf.pendingChunks.delete(buf.nextExpected);
//       try {
//         await buf.writable.write(new Uint8Array(chunk));
//       } catch (err) {
//         console.error("WritableStream write error:", err);
//         updateTransfer(fileId, { status: "error" });
//         addMessage({ type: "system", text: `❌ Stream write failed for "${buf.meta.name}".` });
//         delete receiveBuffers.current[fileId];
//         delete speedTrackers.current[fileId];
//         buf.flushing = false;
//         return;
//       }
//       buf.nextExpected++;
//     }
//     buf.flushing = false;
//   }, [addMessage, updateTransfer]);

//   const activateFallback = useCallback((fileId, buf) => {
//     buf.mode  = "buffer";
//     buf.chunks = new Array(buf.meta.totalChunks);
//     buf.pendingChunks.forEach((c, i) => { buf.chunks[i] = c; });
//     buf.pendingChunks.clear();
//     if (buf.meta.size > BUFFER_WARN_BYTES)
//       addMessage({ type: "system", text: `⚠️ Streaming cancelled — buffering "${buf.meta.name}" in RAM.` });
//   }, [addMessage]);

//   // ── finishBuffer: normalize all chunk types before Blob assembly ──────────────
//   const finishBuffer = useCallback((fileId, buf) => {
//     const parts = buf.chunks.map((c) => {
//       if (c instanceof ArrayBuffer) return new Uint8Array(c);
//       if (ArrayBuffer.isView(c))    return new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
//       return new Uint8Array(c);
//     });
//     const blob = new Blob(parts);
//     const url  = URL.createObjectURL(blob);
//     const a    = document.createElement("a");
//     a.href = url; a.download = buf.meta.name;
//     document.body.appendChild(a); a.click(); document.body.removeChild(a);
//     setTimeout(() => URL.revokeObjectURL(url), 2000);
//     delete receiveBuffers.current[fileId];
//     delete speedTrackers.current[fileId];
//     updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//     addMessage({ type: "system", text: `✅ Received "${buf.meta.name}" (${formatBytes(buf.meta.size)})` });
//   }, [addMessage, updateTransfer]);

//   // ── Sender finalize (idempotent) ─────────────────────────────────────────────
//   const _finalizeSender = useCallback((fileId, state) => {
//     if (!state || state.finalized) return;
//     state.finalized = true;
//     Object.values(state.ackTimers).forEach(clearTimeout);
//     delete sendStates.current[fileId];
//     delete speedTrackers.current[fileId];
//   }, []);

//   // ── Incoming data handler ─────────────────────────────────────────────────────
//   const handleIncomingDataRef = useRef(null);
//   handleIncomingDataRef.current = (raw) => {
//     if (!(raw instanceof ArrayBuffer) && !ArrayBuffer.isView(raw)) return;
//     const frame = decodeFrame(raw instanceof ArrayBuffer ? raw : raw.buffer);
//     if (!frame) return;

//     // ── Control frames ─────────────────────────────────────────────────────────
//     if (frame.type === "json") {
//       const { data } = frame;

//       if (data.type === "chat") {
//         addMessage({ type: "chat", text: data.text, sender: "them", time: data.time });
//         return;
//       }

//       if (data.type === "file-meta") {
//         const { fileId, name, size, totalChunks, chunkSize } = data;
//         const useStream = STREAM_SUPPORTED && size >= STREAM_MIN_BYTES;

//         if (useStream) {
//           const writablePromise = window.showSaveFilePicker({
//             suggestedName: name,
//             types: [{ description: "File", accept: { "application/octet-stream": ["*"] } }],
//           })
//             .then((fh) => fh.createWritable())
//             .catch((err) => { console.warn("Save dialog cancelled:", err.message); return null; });

//           const buf = {
//             mode: "stream", writablePromise, writable: null,
//             ready: false, flushing: false,
//             pendingChunks: new Map(), nextExpected: 0, received: 0, chunks: null,
//             meta: { name, size, totalChunks, chunkSize },
//           };
//           receiveBuffers.current[fileId] = buf;

//           writablePromise.then((writable) => {
//             const b = receiveBuffers.current[fileId];
//             if (!b) return;
//             if (writable) { b.writable = writable; b.ready = true; flushPending(fileId); }
//             else activateFallback(fileId, b);
//           });
//         } else {
//           receiveBuffers.current[fileId] = {
//             mode: "buffer", chunks: new Array(totalChunks), received: 0,
//             meta: { name, size, totalChunks, chunkSize },
//           };
//           if (!STREAM_SUPPORTED && size > BUFFER_WARN_BYTES)
//             addMessage({ type: "system", text: `⚠️ Your browser doesn't support streaming. "${name}" will be buffered in RAM.` });
//         }

//         speedTrackers.current[fileId] = { startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null };
//         setTransfers((prev) => [...prev, {
//           id: fileId, name, size, progress: 0, direction: "in", status: "receiving",
//           speed: 0, eta: null, chunkSize, received: 0, totalChunks, streamMode: useStream,
//         }]);
//         return;
//       }

//       if (data.type === "chunk-ack") {
//         const { fileId, index } = data;
//         const state = sendStates.current[fileId];
//         if (!state) return;
//         if (state.ackTimers[index]) {
//           clearTimeout(state.ackTimers[index]);
//           delete state.ackTimers[index];
//         }
//         state.ackedChunks = (state.ackedChunks || 0) + 1;

//         // Update progress on sender side based on ACKs (accurate delivery progress)
//         const ackProgress = Math.min(99, Math.round((state.ackedChunks / state.totalChunks) * 100));
//         updateTransfer(fileId, { progress: ackProgress });

//         if (state.allDispatched && state.ackedChunks >= state.totalChunks) {
//           const chunkLabel = state.chunkSize >= 1024 * 1024
//             ? `${state.chunkSize / (1024 * 1024)}MB`
//             : `${state.chunkSize / 1024}KB`;
//           updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//           addMessage({ type: "system", text: `📤 Sent "${state.fileName}" (${formatBytes(state.fileSize)}) — ${chunkLabel} chunks` });
//           _finalizeSender(fileId, state);
//         }
//         return;
//       }
//     }

//     // ── Binary chunk frames ────────────────────────────────────────────────────
//     if (frame.type === "chunk") {
//       const { fileId, index, chunk } = frame;
//       const buf = receiveBuffers.current[fileId];
//       if (!buf) return;

//       // ACK immediately so sender's watchdog timer is cleared
//       connRef.current?.send(encodeJSON({ type: "chunk-ack", fileId, index }));

//       if (buf.mode === "stream") {
//         if (!buf.pendingChunks.has(index)) {
//           buf.pendingChunks.set(index, chunk);
//           buf.received++;
//         }
//         const bytesDone = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
//         const progress  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
//         const { speed, eta } = tickSpeedTracker(fileId, bytesDone, buf.meta.size);
//         updateTransfer(fileId, { progress, speed, eta, received: buf.received });
//         if (buf.ready && buf.writable) flushPending(fileId);

//         if (buf.received === buf.meta.totalChunks) {
//           (async () => {
//             const b = receiveBuffers.current[fileId];
//             if (!b) return;
//             if (!b.ready) {
//               await b.writablePromise;
//               const b2 = receiveBuffers.current[fileId];
//               if (!b2) return;
//               if (b2.mode === "buffer") { finishBuffer(fileId, b2); return; }
//             }
//             await flushPending(fileId);
//             const b3 = receiveBuffers.current[fileId];
//             if (!b3 || !b3.writable) return;
//             try { await b3.writable.close(); } catch (e) { console.error(e); }
//             delete receiveBuffers.current[fileId];
//             delete speedTrackers.current[fileId];
//             updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//             addMessage({ type: "system", text: `✅ Saved "${buf.meta.name}" (${formatBytes(buf.meta.size)}) directly to disk 💾` });
//           })();
//         }
//         return;
//       }

//       if (buf.mode === "buffer") {
//         if (!buf.chunks[index]) {
//           buf.chunks[index] = chunk;
//           buf.received++;
//         }
//         const bytesDone = Math.min(buf.received * buf.meta.chunkSize, buf.meta.size);
//         const progress  = Math.min(100, Math.round((buf.received / buf.meta.totalChunks) * 100));
//         const { speed, eta } = tickSpeedTracker(fileId, bytesDone, buf.meta.size);
//         updateTransfer(fileId, { progress, speed, eta, received: buf.received });
//         if (buf.received === buf.meta.totalChunks) finishBuffer(fileId, buf);
//         return;
//       }
//     }
//   };

//   // ── Connection setup ──────────────────────────────────────────────────────────
//   const setupConnectionRef = useRef(null);
//   setupConnectionRef.current = (connection) => {
//     connection.on("open", () => {
//       connRef.current      = connection;
//       connectedRef.current = true;

//       // ── Grab the raw RTCDataChannel for bufferedAmount flow control ─────────
//       // PeerJS 1.5.x does NOT expose a public .dataChannel property.
//       // The internal reference is connection._dc (set before "open" fires).
//       // We also probe .dataChannel as a forward-compat fallback for any future
//       // PeerJS version that makes it public.
//       const dc = connection._dc || connection.dataChannel || null;
//       if (dc) {
//         dc.bufferedAmountLowThreshold = LOW_WATERMARK;
//         dcRef.current = dc;
//       } else {
//         // Should never happen with PeerJS 1.5.4 + reliable:true, but log so
//         // we can catch it in dev without silently falling back to polling.
//         console.warn("[usePeer] Could not get raw DataChannel — flow control will use polling fallback.");
//         dcRef.current = null;
//       }

//       setConnected(true);
//       setScreen("room");
//       addMessage({ type: "system", text: "🔗 Peer connected — channel is encrypted & direct." });
//       if (STREAM_SUPPORTED)
//         addMessage({ type: "system", text: "💾 Stream mode active — large files write directly to disk." });
//     });

//     connection.on("data", (raw) => { handleIncomingDataRef.current?.(raw); });

//     connection.on("close", () => {
//       Object.values(receiveBuffers.current).forEach(async (buf) => {
//         if (buf.mode === "stream" && buf.writable) try { await buf.writable.abort(); } catch {}
//       });
//       // Abort all pending send timers
//       Object.values(sendStates.current).forEach((s) => {
//         s.aborted = true;
//         Object.values(s.ackTimers || {}).forEach(clearTimeout);
//         // Wake up any paused sender so it can see aborted=true and stop
//         if (s.resumeSend) s.resumeSend();
//       });
//       connRef.current      = null;
//       dcRef.current        = null;
//       connectedRef.current = false;
//       setConnected(false);
//       receiveBuffers.current = {};
//       sendStates.current     = {};
//       speedTrackers.current  = {};
//       addMessage({ type: "system", text: "⚠️ Peer disconnected." });
//       setTransfers((prev) => prev.map((t) => t.status !== "done" ? { ...t, status: "error" } : t));
//     });

//     connection.on("error", (err) => {
//       console.error("DataConnection error:", err);
//       setPeerError("Connection error. Try reconnecting.");
//     });
//   };

//   // ── Create room (Host) ────────────────────────────────────────────────────────
//   const createRoom = useCallback(() => {
//     if (!libsReady || !window.Peer) { setPeerError("Libraries still loading — please wait."); return; }
//     setPeerError("");

//     const attemptCreate = (retries = 3) => {
//       const code = generateRoomCode();
//       const p    = new window.Peer(code, { debug: 0, config: { iceServers: ICE_SERVERS } });

//       p.on("open", (id) => {
//         const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
//         setRoomCode(id); setShareUrl(url); setPeer(p); setScreen("host");
//       });
//       p.on("connection", (conn) => { setupConnectionRef.current(conn); });
//       p.on("error", (err) => {
//         if (err.type === "unavailable-id" && retries > 0) { p.destroy(); attemptCreate(retries - 1); }
//         else setPeerError(`Could not create room (${err.type}). Please try again.`);
//       });
//     };
//     attemptCreate();
//   }, [libsReady]);

//   // ── Join room ─────────────────────────────────────────────────────────────────
//   const joinRoom = useCallback(() => {
//     const targetCode = joinCode.trim().toUpperCase();
//     if (!targetCode) return;
//     if (!libsReady || !window.Peer) { setPeerError("Libraries still loading — please wait."); return; }
//     setPeerError("");
//     setScreen("room");

//     const p = new window.Peer(undefined, { debug: 0, config: { iceServers: ICE_SERVERS } });
//     p.on("open", () => {
//       const connection = p.connect(targetCode, { reliable: true, serialization: "raw" });
//       setupConnectionRef.current(connection);
//       setPeer(p);
//     });
//     p.on("error", (err) => {
//       setPeerError(err.type === "peer-unavailable"
//         ? "Room not found. Check the code and try again."
//         : `Connection failed (${err.type}). Try again.`);
//       setScreen("join");
//     });
//   }, [joinCode, libsReady]);

//   // ── Send file ─────────────────────────────────────────────────────────────────
//   //
//   // FLOW CONTROL:
//   //   Before every send(), check dc.bufferedAmount against HIGH_WATERMARK.
//   //   If over limit → pause (store a resume callback in sendStates).
//   //   dc.onbufferedamountlow fires when buffer drains to LOW_WATERMARK → resume.
//   //   This guarantees we never exceed ~1 MB queued at any time.
//   const sendFile = useCallback((file) => {
//     const c  = connRef.current;
//     const dc = dcRef.current;
//     if (!c || !connectedRef.current) return;

//     const fileId      = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
//     const chunkSize   = getChunkSize(file.size);
//     const totalChunks = Math.ceil(file.size / chunkSize);

//     sendStates.current[fileId] = {
//       aborted: false, chunkSize, totalChunks,
//       ackTimers: {}, retryCounts: {},
//       ackedChunks: 0, allDispatched: false, finalized: false,
//       resumeSend: null,   // set when paused; called by onbufferedamountlow
//       fileName: file.name, fileSize: file.size,
//     };
//     speedTrackers.current[fileId] = { startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null };

//     setTransfers((prev) => [...prev, {
//       id: fileId, name: file.name, size: file.size,
//       progress: 0, direction: "out", status: "sending",
//       speed: 0, eta: null, chunkSize, sent: 0, totalChunks, streamMode: false,
//     }]);

//     c.send(encodeJSON({ type: "file-meta", fileId, name: file.name, size: file.size, totalChunks, chunkSize }));

//     let chunkIndex = 0;

//     // ── waitForDrain: returns a Promise that resolves when bufferedAmount
//     //    drops below LOW_WATERMARK, or rejects if the transfer was aborted.
//     //
//     //    Uses dcRef.current (the RTCDataChannel grabbed via connection._dc).
//     //    If dcRef is unavailable, falls back to polling bufferedAmount directly
//     //    via the PeerJS connection object — belt-and-suspenders.
//     const waitForDrain = () => new Promise((resolve, reject) => {
//       const state = sendStates.current[fileId];
//       if (!state || state.aborted) { reject(new Error("aborted")); return; }

//       // Store resume callback so connection "close" handler can unblock us
//       state.resumeSend = () => {
//         state.resumeSend = null;
//         const s = sendStates.current[fileId];
//         if (!s || s.aborted) reject(new Error("aborted"));
//         else resolve();
//       };

//       const liveDc = dcRef.current;
//       if (liveDc) {
//         // Primary path: RTCDataChannel event-driven drain notification
//         liveDc.onbufferedamountlow = () => {
//           if (state.resumeSend) state.resumeSend();
//         };
//       } else {
//         // Polling fallback: check bufferedAmount on the PeerJS connection
//         // every 50 ms until it drains or the transfer is aborted.
//         const poll = setInterval(() => {
//           const s = sendStates.current[fileId];
//           if (!s || s.aborted) {
//             clearInterval(poll);
//             reject(new Error("aborted"));
//             return;
//           }
//           // PeerJS DataConnection exposes bufferedAmount by proxying _dc
//           const ba = connRef.current?._dc?.bufferedAmount ?? 0;
//           if (ba <= LOW_WATERMARK) {
//             clearInterval(poll);
//             if (s.resumeSend) s.resumeSend();
//           }
//         }, 50);
//       }
//     });

//     // ── sendChunk: read slice → encode → wait for drain if needed → send ────
//     const sendChunk = async (index) => {
//       const state = sendStates.current[fileId];
//       if (!state || state.aborted) return;

//       const currentConn = connRef.current;
//       if (!currentConn || !connectedRef.current) {
//         if (state) { state.aborted = true; }
//         updateTransfer(fileId, { status: "error" });
//         return;
//       }

//       // Read chunk
//       const chunkBuffer = await new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onload  = (e) => resolve(e.target.result);
//         reader.onerror = () => reject(new Error("FileReader error"));
//         reader.readAsArrayBuffer(file.slice(index * chunkSize, Math.min((index + 1) * chunkSize, file.size)));
//       });

//       const st = sendStates.current[fileId];
//       if (!st || st.aborted) return;

//       // ── BACK-PRESSURE CHECK ──────────────────────────────────────────────
//       // Pause BEFORE sending if the buffer is already over the high watermark.
//       // This prevents even one oversized chunk from tipping us over the limit.
//       const currentDc = dcRef.current;
//       if (currentDc && currentDc.bufferedAmount > HIGH_WATERMARK) {
//         try {
//           await waitForDrain();
//         } catch {
//           // aborted while waiting
//           return;
//         }
//       }

//       const st2 = sendStates.current[fileId];
//       if (!st2 || st2.aborted) return;

//       // ── Runtime SCTP size guard ──────────────────────────────────────────
//       // Belt-and-suspenders: verify the encoded frame won't exceed the
//       // negotiated SCTP maxMessageSize before calling .send().
//       // dc.maxMessageSize is available in Chrome 56+ / Firefox 57+.
//       const frame    = encodeChunk(fileId, index, chunkBuffer);
//       const liveDc2  = dcRef.current;
//       const maxBytes = liveDc2?.maxMessageSize ?? Infinity;
//       if (frame.byteLength > maxBytes) {
//         // Should never happen with 128 KB chunks, but guard anyway.
//         console.error(`[usePeer] Frame too large: ${frame.byteLength} > SCTP max ${maxBytes}. Reduce chunk size.`);
//         st2.aborted = true;
//         updateTransfer(fileId, { status: "error" });
//         addMessage({ type: "system", text: `❌ "${file.name}" — frame too large for this connection (${frame.byteLength} B > ${maxBytes} B). File a bug.` });
//         return;
//       }

//       try {
//         currentConn.send(frame);
//       } catch (err) {
//         console.error("Send error:", err);
//         st2.aborted = true;
//         updateTransfer(fileId, { status: "error" });
//         return;
//       }

//       // ACK watchdog timer
//       const timer = setTimeout(() => {
//         const st3 = sendStates.current[fileId];
//         if (!st3 || st3.aborted) return;
//         // Don't retry if the connection is already dead
//         if (!connectedRef.current) {
//           st3.aborted = true;
//           return;
//         }
//         st3.retryCounts[index] = (st3.retryCounts[index] || 0) + 1;
//         if (st3.retryCounts[index] >= CHUNK_RETRY_LIMIT) {
//           st3.aborted = true;
//           Object.values(st3.ackTimers).forEach(clearTimeout);
//           updateTransfer(fileId, { status: "error" });
//           addMessage({ type: "system", text: `❌ "${file.name}" failed — chunk ${index} timed out after ${CHUNK_RETRY_LIMIT} retries.` });
//         } else {
//           sendChunk(index); // retry
//         }
//       }, CHUNK_ACK_TIMEOUT);

//       const st3 = sendStates.current[fileId];
//       if (st3) st3.ackTimers[index] = timer;
//     };

//     // ── advanceSender: sequential async loop — one chunk at a time ────────────
//     //    No setTimeout pacing needed; back-pressure handles the rate automatically.
//     const advanceSender = async () => {
//       // Small initial delay — lets SCTP finish path negotiation before first chunk
//       await new Promise((r) => setTimeout(r, SCTP_WARMUP_MS));

//       while (true) {
//         const state = sendStates.current[fileId];
//         if (!state || state.aborted || chunkIndex >= totalChunks) break;

//         const index = chunkIndex++;
//         await sendChunk(index);

//         // Update dispatch progress (capped at 99 — 100 comes from last ACK)
//         const bytesDone = Math.min(chunkIndex * chunkSize, file.size);
//         const progress  = Math.min(99, Math.round((chunkIndex / totalChunks) * 100));
//         const { speed, eta } = tickSpeedTracker(fileId, bytesDone, file.size);
//         updateTransfer(fileId, { progress, speed, eta, sent: chunkIndex });
//       }

//       // All chunks dispatched
//       const st = sendStates.current[fileId];
//       if (st && !st.aborted) {
//         st.allDispatched = true;
//         // Edge case: all ACKs may have arrived already
//         if (st.ackedChunks >= totalChunks) {
//           const chunkLabel = chunkSize >= 1024 * 1024 ? `${chunkSize / (1024 * 1024)}MB` : `${chunkSize / 1024}KB`;
//           updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
//           addMessage({ type: "system", text: `📤 Sent "${file.name}" (${formatBytes(file.size)}) — ${chunkLabel} chunks` });
//           _finalizeSender(fileId, st);
//         }
//       }
//     };

//     advanceSender();
//   }, [addMessage, updateTransfer, tickSpeedTracker, _finalizeSender]);

//   // ── Send chat ─────────────────────────────────────────────────────────────────
//   const sendChat = useCallback((text) => {
//     const c = connRef.current;
//     if (!c || !connectedRef.current || !text.trim()) return false;
//     const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     try {
//       c.send(encodeJSON({ type: "chat", text: text.trim(), time }));
//     } catch {
//       addMessage({ type: "system", text: "⚠️ Message failed to send." });
//       return false;
//     }
//     addMessage({ type: "chat", text: text.trim(), sender: "me", time });
//     return true;
//   }, [addMessage]);

//   // ── Leave / full reset ────────────────────────────────────────────────────────
//   const leaveRoom = useCallback(() => {
//     Object.values(receiveBuffers.current).forEach(async (buf) => {
//       if (buf.mode === "stream" && buf.writable) try { await buf.writable.abort(); } catch {}
//     });
//     Object.values(sendStates.current).forEach((s) => {
//       s.aborted = true;
//       Object.values(s.ackTimers || {}).forEach(clearTimeout);
//       if (s.resumeSend) s.resumeSend(); // unblock any waiting drain
//     });
//     sendStates.current     = {};
//     speedTrackers.current  = {};
//     receiveBuffers.current = {};
//     connRef.current        = null;
//     dcRef.current          = null;
//     connectedRef.current   = false;

//     try { peer?.destroy(); } catch {}
//     setPeer(null); setConnected(false); setMessages([]); setTransfers([]);
//     setRoomCode(""); setShareUrl(""); setPeerError(""); setJoinCode(""); setScreen("home");
//   }, [peer]);

//   return {
//     screen, setScreen,
//     roomCode, shareUrl,
//     joinCode, setJoinCode,
//     connected, messages,
//     transfers, setTransfers,
//     peerError, setPeerError,
//     libsReady,
//     streamSupported: STREAM_SUPPORTED,
//     createRoom, joinRoom, sendFile, sendChat, leaveRoom,
//   };
// }

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChunkSize, generateRoomCode, formatBytes,
  ICE_SERVERS, CHUNK_RETRY_LIMIT, CHUNK_ACK_TIMEOUT,
  SPEED_UPDATE_MS, PEERJS_CDN, QRCODE_CDN, loadScript,
  RECONNECT_MAX, RECONNECT_BASE_MS,
} from "../constants";

// ─── Feature flags ────────────────────────────────────────────────────────────
const STREAM_SUPPORTED  = typeof window !== "undefined" && "showSaveFilePicker" in window;
const STREAM_MIN_BYTES  = 1   * 1024 * 1024;
const BUFFER_WARN_BYTES = 200 * 1024 * 1024;

// ─── Flow-control ─────────────────────────────────────────────────────────────
const HIGH_WATERMARK = 1   * 1024 * 1024;  // 1 MB  — pause above this
const LOW_WATERMARK  = 256 * 1024;          // 256 KB — resume below this
const SCTP_WARMUP_MS = 50;

// ─── Framing protocol ─────────────────────────────────────────────────────────
// All wire data is ArrayBuffer (serialization:"raw").
// Byte 0 = frame type:
//   0x01 → JSON control  : [0x01][UTF-8 JSON]
//   0x02 → Binary chunk  : [0x02][u16 idLen][fileId][u32 index][data]

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
  const [screen,       setScreen]      = useState("home");
  const [roomCode,     setRoomCode]    = useState("");
  const [joinCode,     setJoinCode]    = useState("");
  const [peer,         setPeer]        = useState(null);
  const [connected,    setConnected]   = useState(false);
  const [messages,     setMessages]    = useState([]);
  const [transfers,    setTransfers]   = useState([]);
  const [fileQueue,    setFileQueue]   = useState([]);   // { id, file, status }
  const [shareUrl,     setShareUrl]    = useState("");
  const [peerError,    setPeerError]   = useState("");
  const [libsReady,    setLibsReady]   = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const connRef          = useRef(null);
  const dcRef            = useRef(null);
  const connectedRef     = useRef(false);
  const peerRef          = useRef(null);      // mirrors peer state for callbacks
  const sendStates       = useRef({});
  const speedTrackers    = useRef({});
  const receiveBuffers   = useRef({});
  const activeFileId     = useRef(null);      // currently sending fileId
  const fileQueueRef     = useRef([]);        // mirror of fileQueue for callbacks
  const reconnectCount   = useRef(0);
  const intentionalLeave = useRef(false);     // user pressed Leave
  const targetRoomCode   = useRef("");        // room to reconnect to
  const isHost           = useRef(false);

  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { fileQueueRef.current = fileQueue; }, [fileQueue]);
  useEffect(() => { peerRef.current = peer; }, [peer]);

  // ── Load CDN ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadScript(PEERJS_CDN), loadScript(QRCODE_CDN)])
      .then(() => setLibsReady(true))
      .catch(() => setPeerError("Failed to load libraries. Check your connection."));
  }, []);

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
    const now = Date.now(), elapsed = (now - tr.startTime) / 1000;
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
        buf.flushing = false; return;
      }
      buf.nextExpected++;
    }
    buf.flushing = false;
  }, [addMessage, updateTransfer]);

  const activateFallback = useCallback((fileId, buf) => {
    buf.mode   = "buffer";
    buf.chunks = new Array(buf.meta.totalChunks);
    buf.pendingChunks.forEach((c, i) => { buf.chunks[i] = c; });
    buf.pendingChunks.clear();
  }, []);

  // ── finishBuffer ───────────────────────────────────────────────────────────
  const finishBuffer = useCallback((fileId, buf) => {
    const parts = buf.chunks.map((c) => {
      if (c instanceof ArrayBuffer) return new Uint8Array(c);
      if (ArrayBuffer.isView(c))    return new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
      return new Uint8Array(c);
    });
    const blob = new Blob(parts);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: buf.meta.name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    const tracker = speedTrackers.current[fileId];
    const duration = tracker ? (Date.now() - tracker.startTime) / 1000 : null;
    const avgSpeed = duration && buf.meta.size ? buf.meta.size / duration : null;
    delete receiveBuffers.current[fileId];
    delete speedTrackers.current[fileId];
    updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
    addMessage({ type: "system", text: `✅ Received "${buf.meta.name}" (${formatBytes(buf.meta.size)})` });
    onTransferComplete?.({ id: fileId, name: buf.meta.name, size: buf.meta.size,
      direction: "in", status: "done", duration, avgSpeed });
  }, [addMessage, updateTransfer, onTransferComplete]);

  // ── Sender finalize ────────────────────────────────────────────────────────
  const _finalizeSender = useCallback((fileId, state) => {
    if (!state || state.finalized) return;
    state.finalized = true;
    Object.values(state.ackTimers).forEach(clearTimeout);
    const tracker = speedTrackers.current[fileId];
    const duration = tracker ? (Date.now() - tracker.startTime) / 1000 : null;
    const avgSpeed = duration && state.fileSize ? state.fileSize / duration : null;
    delete sendStates.current[fileId];
    delete speedTrackers.current[fileId];
    // Notify history
    onTransferComplete?.({ id: fileId, name: state.fileName, size: state.fileSize,
      direction: "out", status: "done", duration, avgSpeed });
    // Advance queue
    activeFileId.current = null;
    _advanceQueue();
  }, [onTransferComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Queue advancement ──────────────────────────────────────────────────────
  const _advanceQueue = useCallback(() => {
    if (activeFileId.current) return; // already sending
    if (!connectedRef.current) return;
    const queue = fileQueueRef.current;
    const next  = queue.find((q) => q.status === "queued");
    if (!next) return;
    setFileQueue((prev) => prev.map((q) => q.id === next.id ? { ...q, status: "sending" } : q));
    activeFileId.current = next.id;
    _sendFileInternal(next.file, next.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Incoming data handler ──────────────────────────────────────────────────
  const handleDataRef = useRef(null);
  handleDataRef.current = (raw) => {
    if (!(raw instanceof ArrayBuffer) && !ArrayBuffer.isView(raw)) return;
    const frame = decodeFrame(raw instanceof ArrayBuffer ? raw : raw.buffer);
    if (!frame) return;

    // ── JSON control frames ────────────────────────────────────────────────
    if (frame.type === "json") {
      const { data } = frame;

      if (data.type === "chat") {
        addMessage({ type: "chat", text: data.text, sender: "them", time: data.time });
        return;
      }

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

          const buf = { mode: "stream", writablePromise, writable: null, ready: false,
            flushing: false, pendingChunks: new Map(), nextExpected: 0, received: 0,
            chunks: null, meta: { name, size, totalChunks, chunkSize } };
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
          speed: 0, eta: null, chunkSize, received: 0, totalChunks, streamMode: useStream,
          canCancel: true,
        }]);
        return;
      }

      // Sender received ACK
      if (data.type === "chunk-ack") {
        const { fileId, index } = data;
        const state = sendStates.current[fileId];
        if (!state) return;
        if (state.ackTimers[index]) { clearTimeout(state.ackTimers[index]); delete state.ackTimers[index]; }
        state.ackedChunks = (state.ackedChunks || 0) + 1;
        const p = Math.min(99, Math.round((state.ackedChunks / state.totalChunks) * 100));
        updateTransfer(fileId, { progress: p });
        if (state.allDispatched && state.ackedChunks >= state.totalChunks) {
          const lbl = state.chunkSize >= 1024*1024 ? `${state.chunkSize/(1024*1024)}MB` : `${state.chunkSize/1024}KB`;
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
        addMessage({ type: "system", text: `🚫 Receiver cancelled the transfer.` });
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

    // ── Binary chunk ──────────────────────────────────────────────────────
    if (frame.type === "chunk") {
      const { fileId, index, chunk } = frame;
      const buf = receiveBuffers.current[fileId];
      if (!buf) return;

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
            try { await b3.writable.close(); } catch {}
            delete receiveBuffers.current[fileId]; delete speedTrackers.current[fileId];
            updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
            addMessage({ type: "system", text: `✅ Saved "${buf.meta.name}" (${formatBytes(buf.meta.size)}) to disk 💾` });
            onTransferComplete?.({ id: fileId, name: buf.meta.name, size: buf.meta.size,
              direction: "in", status: "done" });
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
      connRef.current = connection;
      connectedRef.current = true;
      reconnectCount.current = 0;
      setReconnecting(false);

      // Grab raw DataChannel for flow control (PeerJS 1.5.x uses ._dc)
      const dc = connection._dc || connection.dataChannel || null;
      if (dc) { dc.bufferedAmountLowThreshold = LOW_WATERMARK; dcRef.current = dc; }
      else { dcRef.current = null; }

      setConnected(true);
      setScreen("room");
      addMessage({ type: "system", text: "🔗 Connected — end-to-end encrypted." });

      // Send any pending resume requests for in-flight receives
      Object.entries(receiveBuffers.current).forEach(([fileId, buf]) => {
        if (buf.received > 0) {
          connection.send(encodeJSON({ type: "resume-request", fileId, receivedCount: buf.received }));
        }
      });

      // Resume queue if we had an active send
      if (activeFileId.current) {
        const state = sendStates.current[activeFileId.current];
        if (state && !state.finalized) {
          addMessage({ type: "system", text: `♻️ Resuming send of "${state.fileName}"…` });
        }
      } else {
        setTimeout(_advanceQueue, 200);
      }
    });

    connection.on("data", (raw) => { handleDataRef.current?.(raw); });

    connection.on("close", () => {
      connRef.current = null; dcRef.current = null; connectedRef.current = false;
      setConnected(false);

      // Mark in-flight transfers as paused (not errored) if we might reconnect
      if (!intentionalLeave.current && reconnectCount.current < RECONNECT_MAX) {
        setTransfers((prev) => prev.map((t) =>
          t.status === "sending" || t.status === "receiving"
            ? { ...t, status: "reconnecting" } : t
        ));
        _attemptReconnect();
      } else {
        // Abort all
        Object.values(sendStates.current).forEach((s) => {
          s.aborted = true; Object.values(s.ackTimers || {}).forEach(clearTimeout);
          if (s.resumeSend) s.resumeSend(); if (s.resumePause) s.resumePause();
        });
        Object.values(receiveBuffers.current).forEach(async (buf) => {
          if (buf.mode === "stream" && buf.writable) try { await buf.writable.abort(); } catch {}
        });
        sendStates.current = {}; speedTrackers.current = {}; receiveBuffers.current = {};
        setTransfers((prev) => prev.map((t) =>
          t.status !== "done" && t.status !== "cancelled" ? { ...t, status: "error" } : t
        ));
        addMessage({ type: "system", text: "⚠️ Peer disconnected." });
      }
    });

    connection.on("error", (err) => {
      console.error("DataConnection error:", err);
    });
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
    addMessage({ type: "system", text: `🔄 Reconnecting… attempt ${attempt}/${RECONNECT_MAX} (${delay/1000}s)` });

    setTimeout(() => {
      if (intentionalLeave.current) return;
      const p = peerRef.current;
      if (!p || p.destroyed) return;
      const code = targetRoomCode.current;
      if (!code) return;

      if (isHost.current) {
        // Host: just wait for peer to re-connect to the same room code
        addMessage({ type: "system", text: "⏳ Waiting for peer to rejoin…" });
      } else {
        // Joiner: re-connect to the same room code
        const conn = p.connect(code, { reliable: true, serialization: "raw" });
        setupConn.current(conn);
      }
    }, delay);
  }, [addMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create room ────────────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    if (!libsReady || !window.Peer) { setPeerError("Libraries still loading."); return; }
    setPeerError(""); intentionalLeave.current = false; isHost.current = true;

    const attemptCreate = (retries = 3) => {
      const code = generateRoomCode();
      const p = new window.Peer(code, {
  host: typeof __LOCAL_IP__ !== "undefined" ? __LOCAL_IP__ : "localhost",
  port: 9000,
  path: "/",
  debug: 0,
  config: { iceServers: ICE_SERVERS },
});


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
    if (!libsReady || !window.Peer) { setPeerError("Libraries still loading."); return; }
    setPeerError(""); setScreen("room");
    intentionalLeave.current = false; isHost.current = false;
    targetRoomCode.current = code;

    const p = new window.Peer(undefined, {
  host: typeof __LOCAL_IP__ !== "undefined" ? __LOCAL_IP__ : "localhost",
  port: 9000,
  path: "/",
  debug: 0,
  config: { iceServers: ICE_SERVERS },
});
    p.on("open", () => {
      const conn = p.connect(code, { reliable: true, serialization: "raw" });
      setupConn.current(conn); setPeer(p);
    });
    p.on("error", (err) => {
      setPeerError(err.type === "peer-unavailable"
        ? "Room not found. Check the code." : `Connection failed (${err.type}).`);
      setScreen("join");
    });
  }, [joinCode, libsReady]);

  // ── Queue a file (public API) ──────────────────────────────────────────────
  const queueFile = useCallback((file) => {
    if (!connectedRef.current) return;
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const entry = { id, file, status: "queued", name: file.name, size: file.size };
    setFileQueue((prev) => [...prev, entry]);
    // advanceQueue runs via useEffect when fileQueue changes
    return id;
  }, []);

  // Trigger queue advancement whenever fileQueue changes
  useEffect(() => {
    if (connected && !activeFileId.current) {
      const next = fileQueue.find((q) => q.status === "queued");
      if (next) _advanceQueue();
    }
  }, [fileQueue, connected, _advanceQueue]);

  // ── Internal send (called by queue) ───────────────────────────────────────
  const _sendFileInternal = useCallback((file, fileId) => {
    const c = connRef.current;
    if (!c || !connectedRef.current) return;

    const chunkSize   = getChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / chunkSize);

    sendStates.current[fileId] = {
      aborted: false, paused: false, finalized: false,
      chunkSize, totalChunks, fileName: file.name, fileSize: file.size,
      ackTimers: {}, retryCounts: {}, ackedChunks: 0, allDispatched: false,
      resumeFrom: 0,       // chunks receiver already has (from resume-request)
      resumeSend: null,    // unblocks waitForDrain
      resumePause: null,   // unblocks waitForResume
    };
    speedTrackers.current[fileId] = { startTime: Date.now(), lastUpdate: Date.now(), speed: 0, eta: null };

    setTransfers((prev) => [...prev, {
      id: fileId, name: file.name, size: file.size,
      progress: 0, direction: "out", status: "sending",
      speed: 0, eta: null, chunkSize, sent: 0, totalChunks,
      canPause: true, canCancel: true,
    }]);

    c.send(encodeJSON({ type: "file-meta", fileId, name: file.name, size: file.size, totalChunks, chunkSize }));

    // ── waitForDrain ─────────────────────────────────────────────────────────
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

    // ── waitForResume (pause support) ─────────────────────────────────────────
    const waitForResume = () => new Promise((resolve, reject) => {
      const state = sendStates.current[fileId];
      if (!state || state.aborted) { reject(new Error("aborted")); return; }
      state.resumePause = () => {
        state.resumePause = null;
        const s = sendStates.current[fileId];
        if (!s || s.aborted) reject(new Error("aborted")); else resolve();
      };
    });

    // ── sendChunk ─────────────────────────────────────────────────────────────
    const sendChunk = async (index) => {
      const state = sendStates.current[fileId];
      if (!state || state.aborted) return;
      if (!connRef.current || !connectedRef.current) {
        if (state) state.aborted = true;
        updateTransfer(fileId, { status: "error" }); return;
      }

      const chunkBuffer = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = (e) => res(e.target.result);
        reader.onerror = () => rej(new Error("FileReader error"));
        reader.readAsArrayBuffer(file.slice(index * chunkSize, Math.min((index + 1) * chunkSize, file.size)));
      });

      const st = sendStates.current[fileId];
      if (!st || st.aborted) return;

      // Back-pressure
      const liveDc = dcRef.current;
      if (liveDc && liveDc.bufferedAmount > HIGH_WATERMARK) {
        try { await waitForDrain(); } catch { return; }
      }

      const st2 = sendStates.current[fileId];
      if (!st2 || st2.aborted) return;

      // SCTP size guard
      const frame    = encodeChunk(fileId, index, chunkBuffer);
      const maxBytes = dcRef.current?.maxMessageSize ?? Infinity;
      if (frame.byteLength > maxBytes) {
        st2.aborted = true;
        updateTransfer(fileId, { status: "error" });
        addMessage({ type: "system", text: `❌ Frame too large (${frame.byteLength}B > ${maxBytes}B).` });
        return;
      }

      try { connRef.current.send(frame); }
      catch (err) { console.error("Send err:", err); st2.aborted = true; updateTransfer(fileId, { status: "error" }); return; }

      const timer = setTimeout(() => {
        const st3 = sendStates.current[fileId];
        if (!st3 || st3.aborted || !connectedRef.current) return;
        st3.retryCounts[index] = (st3.retryCounts[index] || 0) + 1;
        if (st3.retryCounts[index] >= CHUNK_RETRY_LIMIT) {
          st3.aborted = true;
          Object.values(st3.ackTimers).forEach(clearTimeout);
          updateTransfer(fileId, { status: "error" });
          addMessage({ type: "system", text: `❌ "${file.name}" failed — chunk ${index} timed out.` });
        } else sendChunk(index);
      }, CHUNK_ACK_TIMEOUT);

      const st3 = sendStates.current[fileId];
      if (st3) st3.ackTimers[index] = timer;
    };

    // ── advanceSender loop ─────────────────────────────────────────────────────
    const advanceSender = async () => {
      await new Promise((r) => setTimeout(r, SCTP_WARMUP_MS));

      // If receiver requested a resume, skip already-received chunks
      const state0 = sendStates.current[fileId];
      let chunkIndex = state0?.resumeFrom ?? 0;
      if (chunkIndex > 0) {
        // Adjust ack count to match
        if (state0) state0.ackedChunks = chunkIndex;
      }

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
          const lbl = chunkSize >= 1024*1024 ? `${chunkSize/(1024*1024)}MB` : `${chunkSize/1024}KB`;
          updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
          addMessage({ type: "system", text: `📤 Sent "${file.name}" (${formatBytes(file.size)}) — ${lbl} chunks` });
          _finalizeSender(fileId, st);
        }
      }
    };

    advanceSender();
  }, [addMessage, updateTransfer, tickSpeed, _finalizeSender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause transfer ─────────────────────────────────────────────────────────
  const pauseTransfer = useCallback((fileId) => {
    const state = sendStates.current[fileId];
    if (!state || state.aborted || state.paused) return;
    state.paused = true;
    // updateTransfer called from advanceSender when it hits the pause gate
  }, []);

  // ── Resume transfer ────────────────────────────────────────────────────────
  const resumeTransfer = useCallback((fileId) => {
    const state = sendStates.current[fileId];
    if (!state || state.aborted || !state.paused) return;
    state.paused = false;
    if (state.resumePause) state.resumePause();
    updateTransfer(fileId, { status: "sending" });
  }, [updateTransfer]);

  // ── Cancel transfer (sender side) ─────────────────────────────────────────
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

  // ── Cancel transfer (receiver side) ───────────────────────────────────────
  const cancelReceive = useCallback((fileId) => {
    const buf = receiveBuffers.current[fileId];
    if (buf?.mode === "stream" && buf.writable) buf.writable.abort().catch(() => {});
    delete receiveBuffers.current[fileId];
    delete speedTrackers.current[fileId];
    updateTransfer(fileId, { status: "cancelled" });
    // Notify sender
    connRef.current?.send(encodeJSON({ type: "cancel-transfer", fileId }));
  }, [updateTransfer]);

  // ── Remove from queue ──────────────────────────────────────────────────────
  const removeFromQueue = useCallback((id) => {
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

  // ── Leave ──────────────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    intentionalLeave.current = true;
    Object.values(receiveBuffers.current).forEach(async (buf) => {
      if (buf.mode === "stream" && buf.writable) try { await buf.writable.abort(); } catch {}
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
    try { peerRef.current?.destroy(); } catch {}
    setPeer(null); setConnected(false); setMessages([]); setTransfers([]);
    setFileQueue([]); setRoomCode(""); setShareUrl(""); setPeerError("");
    setJoinCode(""); setScreen("home"); setReconnecting(false);
  }, []);

  return {
    screen, setScreen, roomCode, shareUrl, joinCode, setJoinCode,
    connected, reconnecting, messages, transfers, fileQueue,
    peerError, setPeerError, libsReady,
    streamSupported: STREAM_SUPPORTED,
    createRoom, joinRoom, queueFile, sendChat, leaveRoom,
    pauseTransfer, resumeTransfer, cancelTransfer, cancelReceive,
    removeFromQueue,
  };
}