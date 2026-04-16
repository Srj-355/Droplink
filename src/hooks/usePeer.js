import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChunkSize, generateRoomCode, formatBytes, formatSpeed,
  ICE_SERVERS, CHUNK_RETRY_LIMIT, CHUNK_ACK_TIMEOUT,
  SPEED_UPDATE_MS, RECONNECT_MAX, RECONNECT_BASE_MS, RECONNECT_TIMEOUT_MS,
  USE_CUSTOM_PEER_SERVER, PEER_SERVER, COMPRESSION_ENABLED,
} from "../constants";
import {
  isCompressionSupported, shouldCompressFile,
  compressChunk, decompressChunk, testCompressionRatio
} from "../utils/compression";
import Peer from "peerjs";

function buildPeerOptions() {
  const opts = {
    debug: 0,
    config: {
      iceServers: ICE_SERVERS,
      iceTransportPolicy: "all",
      sdpSemantics: "unified-plan",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    },
  };
  if (USE_CUSTOM_PEER_SERVER) {
    opts.host = PEER_SERVER.host;
    opts.port = PEER_SERVER.port;
    opts.path = PEER_SERVER.path;
    opts.secure = PEER_SERVER.secure;
    opts.key = PEER_SERVER.key;
  }
  return opts;
}

const STREAM_SUPPORTED = typeof window !== "undefined" && "showSaveFilePicker" in window;
const STREAM_MIN_BYTES = 1 * 1024 * 1024;
const HIGH_WATERMARK = 8 * 1024 * 1024;
const LOW_WATERMARK = 2 * 1024 * 1024;
const SCTP_WARMUP_MS = 50;
const TYPE_JSON = 0x01;
const TYPE_CHUNK = 0x02;

function encodeJSON(obj) {
  const j = new TextEncoder().encode(JSON.stringify(obj));
  const b = new ArrayBuffer(1 + j.byteLength);
  const u = new Uint8Array(b);
  u[0] = TYPE_JSON;
  u.set(j, 1);
  return b;
}

function encodeChunk(fileId, index, chunkBuffer, compressed = false) {
  const id = new TextEncoder().encode(fileId);
  const hdr = 1 + 2 + id.byteLength + 4 + 1;
  const buf = new ArrayBuffer(hdr + chunkBuffer.byteLength);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint8(0, TYPE_CHUNK);
  dv.setUint16(1, id.byteLength, false);
  u8.set(id, 3);
  const idEnd = 3 + id.byteLength;
  dv.setUint32(idEnd, index, false);
  dv.setUint8(idEnd + 4, compressed ? 1 : 0);
  u8.set(new Uint8Array(chunkBuffer), hdr);
  return buf;
}

function decodeFrame(raw) {
  const buf = raw instanceof ArrayBuffer ? raw : raw.buffer;
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const kind = dv.getUint8(0);
  if (kind === TYPE_JSON) {
    try { return { type: "json", data: JSON.parse(new TextDecoder().decode(u8.subarray(1))) }; }
    catch { return null; }
  }
  if (kind === TYPE_CHUNK) {
    const idLen = dv.getUint16(1, false);
    const idEnd = 3 + idLen;
    const fileId = new TextDecoder().decode(u8.subarray(3, idEnd));
    const index = dv.getUint32(idEnd, false);
    const compressed = dv.getUint8(idEnd + 4) === 1;
    const chunk = buf.slice(idEnd + 5);
    return { type: "chunk", fileId, index, compressed, chunk };
  }
  return null;
}

export function usePeer({ onTransferComplete } = {}) {
  // ── 1. Hooks (Consolidated) ─────────────────────────────────────────────────
  const [screen, setScreen] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [peer, setPeer] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [fileQueue, setFileQueue] = useState([]);
  const [shareUrl, setShareUrl] = useState("");
  const [peerError, setPeerError] = useState("");
  const [libsReady, setLibsReady] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const connRef = useRef(null);
  const dcRef = useRef(null);
  const connectedRef = useRef(false);
  const peerRef = useRef(null);
  const sendStates = useRef({});
  const speedTrackers = useRef({});
  const receiveBuffers = useRef({});
  const activeFileId = useRef(null);
  const fileQueueRef = useRef([]);
  const reconnectCount = useRef(0);
  const intentionalLeave = useRef(false);
  const targetRoomCode = useRef("");
  const isHost = useRef(false);
  const leaveRoomRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const backoffTimerRef = useRef(null);
  const lastReconnectMsgRef = useRef("");
  const peerCompression = useRef(null);
  const _advanceQueueRef = useRef(null);
  const handleDataRef = useRef(null);
  const dataQueue = useRef([]);
  const processingData = useRef(false);
  const lastSignallingAlert = useRef(0);
  const setupConn = useRef(null);

  const addMessage = useCallback((msg) =>
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }])
    , []);

  const updateTransfer = useCallback((fileId, patch) =>
    setTransfers((prev) => prev.map((t) => t.id === fileId ? { ...t, ...patch } : t))
    , []);

  const triggerAutoReturn = useCallback((msg = "❌ Connection lost. Peer no longer available. Returning home…") => {
    setReconnecting(false); addMessage({ type: "system", text: msg });
    setTransfers((prev) => prev.map((t) =>
      t.status === "reconnecting" || t.status === "sending" || t.status === "receiving" ? { ...t, status: "error" } : t
    ));
    setTimeout(() => { if (!intentionalLeave.current && !connectedRef.current) leaveRoomRef.current?.(); }, RECONNECT_TIMEOUT_MS);
  }, [addMessage]);

  const tickSpeed = useCallback((fileId, bytesDone, total) => {
    const tr = speedTrackers.current[fileId]; if (!tr) return {};
    const now = Date.now(); const elapsed = (now - tr.startTime) / 1000;
    if (elapsed <= 0) return {};
    if (now - tr.lastUpdate < SPEED_UPDATE_MS && tr.speed !== undefined) return { speed: tr.speed, eta: tr.eta };
    const speed = bytesDone / elapsed; const eta = speed > 0 ? (total - bytesDone) / speed : null;
    speedTrackers.current[fileId] = { ...tr, lastUpdate: now, speed, eta };
    return { speed, eta };
  }, []);

  const _advanceQueue = useCallback(() => {
    if (activeFileId.current || !connectedRef.current) return;
    const queue = fileQueueRef.current;
    const next = queue.find((q) => q.status === "queued");
    if (!next) return;
    setFileQueue((prev) => prev.map((q) => q.id === next.id ? { ...q, status: "sending" } : q));
    activeFileId.current = next.id;
    _sendFileInternal(next.file, next.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const _finalizeSender = useCallback((fileId, state) => {
    if (!state || state.finalized) return;
    state.finalized = true;
    try {
      Object.values(state.ackTimers).forEach(clearTimeout);
      const tracker = speedTrackers.current[fileId];
      const duration = tracker ? (Date.now() - tracker.startTime) / 1000 : null;
      const avgSpeed = duration && state.fileSize ? state.fileSize / duration : null;
      
      const ratio = state.rawBytes > 0 ? (state.compBytes / state.rawBytes) : 1;
      const savingsPercent = ((1 - ratio) * 100).toFixed(1);
      const savingsBytes = state.rawBytes - state.compBytes;
      const timeSaved = avgSpeed && avgSpeed > 0 ? (savingsBytes / avgSpeed).toFixed(2) : "0.00";

      console.log(`[Transfer] ✅ Finalized "${state.fileName}"`);
      console.log(`  └─ Size: ${formatBytes(state.rawBytes)} (Raw) → ${formatBytes(state.compBytes)} (On-wire)`);
      console.log(`  └─ Savings: ${formatBytes(savingsBytes)} (${savingsPercent}%)`);
      console.log(`  └─ Estimated compression time save: ${timeSaved}s`);
      
      onTransferComplete?.({ id: fileId, name: state.fileName, size: state.fileSize, direction: "out", status: "done", duration, avgSpeed, compressed: state.compressionActive });
    } catch (err) { console.error("Error in _finalizeSender:", err); }
    finally { delete sendStates.current[fileId]; delete speedTrackers.current[fileId]; activeFileId.current = null; _advanceQueueRef.current?.(); }
  }, [onTransferComplete]);

  const _checkCompletion = useCallback((fileId) => {
    const state = sendStates.current[fileId];
    if (!state || state.finalized || state.aborted) return;
    if (state.allDispatched && state.ackedChunks >= state.totalChunks) {
      updateTransfer(fileId, { progress: 100, status: "done", speed: 0, eta: null });
      addMessage({ type: "system", text: `📤 Sent "${state.fileName}"` });
      _finalizeSender(fileId, state);
    }
  }, [addMessage, updateTransfer, _finalizeSender]);

  const _attemptReconnect = useCallback(() => {
    if (intentionalLeave.current || connectedRef.current) return;

    // Safety exit if we've reached max attempts
    const attempt = reconnectCount.current + 1;
    if (attempt > RECONNECT_MAX) {
      triggerAutoReturn("❌ Reconnection failed. Signal lost for too long.");
      return;
    }

    // Start a global timeout on the first attempt
    if (reconnectCount.current === 0 && !reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!connectedRef.current && !intentionalLeave.current) {
          triggerAutoReturn("❌ Reconnection timed out.");
        }
      }, RECONNECT_TIMEOUT_MS);
    }

    reconnectCount.current = attempt;
    setReconnecting(true);
    const delay = RECONNECT_BASE_MS * Math.pow(2, attempt - 1);

    const logOnce = (text) => {
      if (lastReconnectMsgRef.current === text) return;
      lastReconnectMsgRef.current = text;
      addMessage({ type: "system", text });
    };

    logOnce(`🔄 Reconnecting… (Attempt ${attempt}/${RECONNECT_MAX})`);
    console.log(`[Signal] Reconnect attempt ${attempt}/${RECONNECT_MAX} with ${delay}ms delay`);

    if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
    backoffTimerRef.current = setTimeout(() => {
      if (intentionalLeave.current || connectedRef.current) return;

      let p = peerRef.current;
      const code = targetRoomCode.current;
      if (!code) return;

      // 1. If Peer is destroyed, recreate it
      if (!p || p.destroyed) {
        logOnce("🛠️ Peer engine crashed. Re-initializing…");
        const newPeer = isHost.current ? new Peer(code, buildPeerOptions()) : new Peer(undefined, buildPeerOptions());
        p = newPeer;
        setPeer(newPeer);
        newPeer.on("open", id => {
          if (isHost.current) setRoomCode(id);
          _attemptReconnect();
        });
        newPeer.on("disconnected", () => { newPeer.reconnect(); });
        newPeer.on("error", () => _attemptReconnect());
        if (isHost.current) {
          newPeer.on("connection", conn => {
            if (connectedRef.current) {
              conn.on("open", () => { conn.send(encodeJSON({ type: "room-full" })); setTimeout(() => conn.close(), 500); });
              return;
            }
            setupConn.current(conn);
          });
        }
        return;
      }

      // 2. If signaling is disconnected
      if (p.disconnected) {
        logOnce("📡 Signaling lost. reconnecting to server…");
        p.reconnect();
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
        backoffTimerRef.current = setTimeout(_attemptReconnect, 1000);
        return;
      }

      // 3. P2P Reconnection logic
      if (isHost.current) {
        logOnce("⏳ Waiting for peer to resume…");
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
        backoffTimerRef.current = setTimeout(() => { if (!connectedRef.current) _attemptReconnect(); }, delay);
      } else {
        const conn = p.connect(code, { reliable: true, serialization: "raw" });
        setupConn.current(conn);
        const onErr = (err) => {
          if (err.type === "peer-unavailable") {
            if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
            backoffTimerRef.current = setTimeout(_attemptReconnect, 2000);
          } else {
            _attemptReconnect();
          }
        };
        p.once("error", onErr);
      }
    }, delay);
  }, [addMessage, triggerAutoReturn, setRoomCode, setPeer]);

  const _sendFileInternal = useCallback((file, fileId) => {
    const c = connRef.current; if (!c) return;
    const chunkSize = getChunkSize(file.size); const totalChunks = Math.ceil(file.size / chunkSize);
    const useCompression = COMPRESSION_ENABLED && isCompressionSupported() && peerCompression.current?.includes("deflate-raw") && shouldCompressFile(file);
    console.log(`[Transfer] Initiating: ${file.name} (${formatBytes(file.size)}). Compression: ${useCompression ? "Yes" : "No"}`);
    sendStates.current[fileId] = { aborted: false, paused: false, finalized: false, chunkSize, totalChunks, fileName: file.name, fileSize: file.size, ackTimers: {}, retryCounts: {}, ackedChunks: 0, ackedIndexes: new Set(), allDispatched: false, resumeFrom: 0, useCompression, compressionActive: useCompression, rawBytes: 0, compBytes: 0 };
    speedTrackers.current[fileId] = { startTime: Date.now(), lastUpdate: Date.now() };
    setTransfers(prev => [...prev, { id: fileId, name: file.name, size: file.size, progress: 0, direction: "out", status: "sending", totalChunks, compressed: useCompression }]);
    c.send(encodeJSON({ type: "file-meta", fileId, name: file.name, size: file.size, totalChunks, chunkSize, compressed: useCompression }));

    const sendChunk = async (index, buffer) => {
      const s = sendStates.current[fileId]; if (!s || s.aborted) return;
      let data = buffer;
      if (s.useCompression) {
        try { 
          const comp = await compressChunk(buffer); 
          if (index === 0 && (comp.byteLength / buffer.byteLength) > 0.9) { 
            console.log("[Compression] Threshold not met on first chunk, disabling compression for this file.");
            s.useCompression = false; 
            s.compressionActive = false; 
          } else data = comp; 
        }
        catch { s.useCompression = false; }
      }
      s.rawBytes += buffer.byteLength;
      s.compBytes += data.byteLength;
      const frame = encodeChunk(fileId, index, data, s.compressionActive);
      s.ackTimers[index] = setTimeout(() => {
        const st = sendStates.current[fileId];
        if (st && !st.aborted && !st.ackedIndexes.has(index)) {
          console.warn(`[Transfer] No ACK for chunk ${index}. Retry ${st.retryCounts[index] || 0}/${CHUNK_RETRY_LIMIT}`);
          if ((st.retryCounts[index] || 0) < CHUNK_RETRY_LIMIT) { st.retryCounts[index] = (st.retryCounts[index] || 0) + 1; sendChunk(index, buffer); }
          else { updateTransfer(fileId, { status: "error" }); }
        }
      }, CHUNK_ACK_TIMEOUT);
      console.log(`[Transfer] Sending chunk ${index}/${totalChunks - 1} (${data.byteLength} bytes)`);
      connRef.current?.send(frame);
    };

    (async () => {
      const st = sendStates.current[fileId]; let chunkIndex = st.resumeFrom || 0;
      await new Promise(r => setTimeout(r, SCTP_WARMUP_MS));
      while (chunkIndex < totalChunks && !st.aborted) {
        while (st.paused) await new Promise(r => setTimeout(r, 100));
        const dc = dcRef.current; if (dc && dc.bufferedAmount > HIGH_WATERMARK) await new Promise(r => { dc.onbufferedamountlow = r; setTimeout(r, 1000); });
        const start = chunkIndex * chunkSize; const end = Math.min(start + chunkSize, file.size);
        const buf = await file.slice(start, end).arrayBuffer();
        sendChunk(chunkIndex, buf); chunkIndex++;
        const { speed, eta } = tickSpeed(fileId, Math.min(chunkIndex * chunkSize, file.size), file.size);
        updateTransfer(fileId, { progress: Math.min(99, Math.floor((chunkIndex / totalChunks) * 100)), speed, eta });
        if (chunkIndex % 4 === 0) await new Promise(r => setTimeout(r, 0));
      }
      st.allDispatched = true; 
      console.log(`[Transfer] All chunks for "${st.fileName}" dispatched. (Acked: ${st.ackedChunks}/${st.totalChunks})`);
      _checkCompletion(fileId);
    })();
  }, [updateTransfer, tickSpeed, _checkCompletion]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRoom = useCallback(() => {
    setPeerError(""); intentionalLeave.current = false; isHost.current = true;
    const p = new Peer(generateRoomCode(), buildPeerOptions());
    p.on("open", id => { targetRoomCode.current = id; setRoomCode(id); setShareUrl(`${window.location.origin}${window.location.pathname}?room=${id}`); setPeer(p); setScreen("host"); window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}?room=${id}`); });
    p.on("disconnected", () => { console.warn("[Signals] Disconnected. Reconnecting…"); p.reconnect(); });
    p.on("connection", conn => { if (connectedRef.current) { conn.on("open", () => { conn.send(encodeJSON({ type: "room-full" })); setTimeout(() => conn.close(), 500); }); return; } setupConn.current(conn); });
    p.on("error", err => { if (!connectedRef.current) setPeerError(`Create failed: ${err.type}`); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = useCallback(() => {
    const code = joinCode.trim().toUpperCase(); if (!code) return;
    intentionalLeave.current = false; isHost.current = false; targetRoomCode.current = code;
    const p = new Peer(undefined, buildPeerOptions());
    p.on("open", () => { setupConn.current(p.connect(code, { reliable: true, serialization: "raw" })); setPeer(p); });
    p.on("disconnected", () => { console.warn("[Signals] Disconnected. Reconnecting…"); p.reconnect(); });
    p.on("error", err => {
      if (!connectedRef.current) {
        setPeerError(err.type === "peer-unavailable" ? "Room not found or host offline." : `Join failed: ${err.type}`);
        leaveRoomRef.current?.();
      }
    });
  }, [joinCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const queueFile = useCallback((file) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setFileQueue(prev => [...prev, { id, file, status: "queued", name: file.name, size: file.size }]);
    return id;
  }, []);

  const leaveRoom = useCallback(() => {
    intentionalLeave.current = true;
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    if (backoffTimerRef.current) { clearTimeout(backoffTimerRef.current); backoffTimerRef.current = null; }
    Object.values(sendStates.current).forEach(s => { s.aborted = true; Object.values(s.ackTimers).forEach(clearTimeout); });

    // Clear refs
    sendStates.current = {};
    speedTrackers.current = {};
    receiveBuffers.current = {};
    activeFileId.current = null;
    fileQueueRef.current = [];
    dataQueue.current = [];
    reconnectCount.current = 0;
    lastReconnectMsgRef.current = "";

    // Clear state
    peerRef.current?.destroy();
    setPeer(null);
    setConnected(false);
    setMessages([]);
    setTransfers([]);
    setFileQueue([]);
    setRoomCode("");
    setShareUrl("");
    setPeerError("");
    setReconnecting(false);
    setScreen("home");

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const pauseTransfer = useCallback((id) => { const s = sendStates.current[id]; if (s) s.paused = true; }, []);
  const resumeTransfer = useCallback((id) => { const s = sendStates.current[id]; if (s) s.paused = false; }, []);
  const cancelTransfer = useCallback((id) => {
    const s = sendStates.current[id]; if (s) { s.aborted = true; }
    updateTransfer(id, { status: "cancelled" });
    connRef.current?.send(encodeJSON({ type: "cancel-transfer", fileId: id }));
  }, [updateTransfer]);

  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { fileQueueRef.current = fileQueue; }, [fileQueue]);
  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { setLibsReady(true); }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("room");
    if (p) { setJoinCode(p.toUpperCase()); setScreen("join"); }
  }, []);
  useEffect(() => {
    const h = () => { if (peerRef.current) leaveRoomRef.current?.(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, []);
  useEffect(() => { _advanceQueueRef.current = _advanceQueue; }, [_advanceQueue]);
  useEffect(() => { if (connected && !activeFileId.current) _advanceQueue(); }, [fileQueue, connected, _advanceQueue]);
  useEffect(() => { leaveRoomRef.current = leaveRoom; }, [leaveRoom]);

  // ── 2. Background Handlers ───────────────────────────────────────────────────
  const processQueue = async () => {
    if (processingData.current || dataQueue.current.length === 0) return;
    processingData.current = true;
    while (dataQueue.current.length > 0) { await _handleDataInternal(dataQueue.current.shift()); }
    processingData.current = false;
  };

  const flushPending = async (fileId) => {
    const buf = receiveBuffers.current[fileId]; if (!buf || buf.mode !== "stream" || !buf.writable || buf.flushing) return;
    buf.flushing = true;
    while (buf.pendingChunks.has(buf.nextExpected)) {
      const c = buf.pendingChunks.get(buf.nextExpected); buf.pendingChunks.delete(buf.nextExpected);
      await buf.writable.write(new Uint8Array(c)); buf.nextExpected++;
    }
    buf.flushing = false;
  };

  const finishBuffer = (fileId, buf) => {
    const blob = new Blob(buf.chunks); const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: buf.meta.name });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    updateTransfer(fileId, { progress: 100, status: "done" });
    addMessage({ type: "system", text: `✅ Received "${buf.meta.name}"` });
    
    const ratio = buf.rawBytes > 0 ? (buf.compBytes / buf.rawBytes) : 1;
    const savingsPercent = ((1 - ratio) * 100).toFixed(1);
    const savingsBytes = buf.rawBytes - buf.compBytes;

    console.log(`[Transfer] ✅ Received "${buf.meta.name}"`);
    console.log(`  └─ Size: ${formatBytes(buf.rawBytes)} (Decompressed) ← ${formatBytes(buf.compBytes)} (On-wire)`);
    if (savingsPercent > 0) {
      console.log(`  └─ Savings: ${formatBytes(savingsBytes)} (${savingsPercent}%)`);
    }
    delete receiveBuffers.current[fileId];
  };

  const _handleDataInternal = async (raw) => {
    const frame = decodeFrame(raw); if (!frame) return;
    if (frame.type === "json") {
      const { data } = frame;
      if (data.type === "chat") addMessage({ type: "chat", text: data.text, sender: "them", time: data.time });
      if (data.type === "hello") peerCompression.current = data.compression || [];
      if (data.type === "room-full") { setPeerError("Room is full."); setTimeout(leaveRoom, 1000); }
      if (data.type === "file-meta") {
        const { fileId, name, size, totalChunks, chunkSize } = data;
        const useStream = STREAM_SUPPORTED && size >= STREAM_MIN_BYTES;
        if (useStream) {
          try { const h = await window.showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); receiveBuffers.current[fileId] = { mode: "stream", writable: w, pendingChunks: new Map(), nextExpected: 0, received: 0, meta: data, rawBytes: 0, compBytes: 0 }; }
          catch { receiveBuffers.current[fileId] = { mode: "buffer", chunks: new Array(totalChunks), received: 0, meta: data, rawBytes: 0, compBytes: 0 }; }
        } else receiveBuffers.current[fileId] = { mode: "buffer", chunks: new Array(totalChunks), received: 0, meta: data, rawBytes: 0, compBytes: 0 };
        setTransfers(prev => [...prev, { id: fileId, name, size, progress: 0, direction: "in", status: "receiving", totalChunks }]);
      }
      if (data.type === "chunk-ack") {
        const state = sendStates.current[data.fileId]; if (!state) return;
        if (!state.ackedIndexes.has(data.index)) { state.ackedIndexes.add(data.index); state.ackedChunks++; }
        updateTransfer(data.fileId, { progress: Math.min(99, Math.floor((state.ackedChunks / state.totalChunks) * 100)) });
        _checkCompletion(data.fileId);
      }
      if (data.type === "cancel-transfer") {
        const st = sendStates.current[data.fileId]; if (st) st.aborted = true;
        updateTransfer(data.fileId, { status: "cancelled" });
        addMessage({ type: "system", text: "🚫 Peer cancelled transfer." });
      }
      if (data.type === "resume-request") {
        const st = sendStates.current[data.fileId]; if (st) { st.resumeFrom = data.receivedCount; addMessage({ type: "system", text: "♻️ Resuming..." }); }
      }
      return;
    }
    if (frame.type === "chunk") {
      let { fileId, index, chunk, compressed } = frame; const buf = receiveBuffers.current[fileId]; if (!buf) return;
      console.log(`[Transfer] Received chunk ${index} for ${fileId} (${chunk.byteLength}B, Compressed: ${compressed})`);
      connRef.current?.send(encodeJSON({ type: "chunk-ack", fileId, index }));
      buf.compBytes += chunk.byteLength;
      if (compressed) chunk = await decompressChunk(chunk);
      buf.rawBytes += chunk.byteLength;
      if (buf.mode === "stream") {
        buf.pendingChunks.set(index, chunk); buf.received++;
        updateTransfer(fileId, { progress: Math.min(99, Math.floor((buf.received / buf.meta.totalChunks) * 100)) });
        await flushPending(fileId);
        if (buf.received === buf.meta.totalChunks) { await buf.writable.close(); updateTransfer(fileId, { progress: 100, status: "done" }); delete receiveBuffers.current[fileId]; }
      } else {
        buf.chunks[index] = chunk; buf.received++;
        updateTransfer(fileId, { progress: Math.min(99, Math.floor((buf.received / buf.meta.totalChunks) * 100)) });
        if (buf.received === buf.meta.totalChunks) finishBuffer(fileId, buf);
      }
    }
  };

  setupConn.current = (connection) => {
    connection.on("open", () => {
      connRef.current = connection; connectedRef.current = true; setConnected(true); setScreen("room");
      reconnectCount.current = 0; setReconnecting(false); lastReconnectMsgRef.current = "";
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
      if (backoffTimerRef.current) { clearTimeout(backoffTimerRef.current); backoffTimerRef.current = null; }

      if (COMPRESSION_ENABLED && isCompressionSupported()) connection.send(encodeJSON({ type: "hello", compression: ["deflate-raw"] }));
      const dc = connection._dc || connection.dataChannel; if (dc) { dc.bufferedAmountLowThreshold = LOW_WATERMARK; dcRef.current = dc; }
      Object.entries(receiveBuffers.current).forEach(([id, b]) => { if (b.received > 0) connection.send(encodeJSON({ type: "resume-request", fileId: id, receivedCount: b.received })); });
      _advanceQueue();
    });
    connection.on("data", raw => { dataQueue.current.push(raw); processQueue(); });
    connection.on("close", () => {
      connRef.current = null; dcRef.current = null; connectedRef.current = false;
      setConnected(false);
      if (!intentionalLeave.current) {
        setTransfers(prev => prev.map(t =>
          (t.status === "sending" || t.status === "receiving") ? { ...t, status: "reconnecting" } : t
        ));
        _attemptReconnect();
      } else leaveRoom();
    });
  };

  return {
    screen, setScreen, roomCode, joinCode, connected, messages, transfers, fileQueue, shareUrl, peerError, libsReady, reconnecting,
    setJoinCode, createRoom, joinRoom, queueFile, leaveRoom, setTransfers, setPeerError,
    sendChat: (t) => {
      const c = connRef.current; if (!c || !t.trim()) return false;
      const time = new Date().toLocaleTimeString();
      c.send(encodeJSON({ type: "chat", text: t, time }));
      addMessage({ type: "chat", text: t, sender: "me", time }); return true;
    },
    pauseTransfer, resumeTransfer, cancelTransfer,
    cancelReceive: (id) => {
      const buf = receiveBuffers.current[id]; if (buf?.mode === "stream" && buf.writable) buf.writable.abort().catch(() => { });
      delete receiveBuffers.current[id]; updateTransfer(id, { status: "cancelled" });
      connRef.current?.send(encodeJSON({ type: "cancel-transfer", fileId: id }));
    },
    removeFromQueue: (id) => { if (activeFileId.current !== id) setFileQueue(prev => prev.filter(q => q.id !== id)); }
  };
}