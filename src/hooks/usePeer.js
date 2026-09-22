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
// How long to wait for the private signal server before falling back
// to the public PeerJS cloud (covers Render free-tier cold starts).
const SIGNAL_FALLBACK_MS = 8000;

function getPeerOptions(mode) {
  if (mode === "public") return { debug: 0 }; // PeerJS public cloud defaults
  return buildPeerOptions();
}

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
  const [isJoining, setIsJoining] = useState(false);
  const [connStats, setConnStats] = useState(null);
  const [signalMode, setSignalMode] = useState("custom");
  const [maxParallel, setMaxParallel] = useState(1);
  const [peerTyping, setPeerTyping] = useState(false);
  const [completedBlobs, setCompletedBlobs] = useState({});

  const connRef = useRef(null);
  const dcRef = useRef(null);
  const connectedRef = useRef(false);
  const peerRef = useRef(null);
  const messagesRef = useRef([]);
  const sendStates = useRef({});
  const speedTrackers = useRef({});
  const receiveBuffers = useRef({});
  const activeFileIds = useRef(new Set());
  const fileQueueRef = useRef([]);
  const maxParallelRef = useRef(1);
  const completedBlobsRef = useRef({});
  const peerTypingTimeout = useRef(null);
  const typingThrottle = useRef(0);

  useEffect(() => { maxParallelRef.current = maxParallel; }, [maxParallel]);

  const playDoneSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.start(); o.stop(ctx.currentTime + 0.36);
      setTimeout(() => ctx.close().catch(() => {}), 500);
    } catch { /* audio optional */ }
  }, []);

  const notifyDone = useCallback((title, body) => {
    try {
      playDoneSound();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch { /* ignore */ }
  }, [playDoneSound]);

  const requestNotifyPermission = useCallback(() => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);
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
  const signalModeRef = useRef("custom"); // "custom" → private server, "public" → PeerJS cloud fallback
  const signalTimerRef = useRef(null);
  const statsIntervalRef = useRef(null);

  const addMessage = useCallback((msg) => {
    const id = msg.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // dedup by id (stable) — fixes fragile text+time matching
    if (messagesRef.current.some((m) => m.id === id)) return id;
    setMessages((prev) => {
      if (prev.some((m) => m.id === id)) return prev;
      return [...prev, { ...msg, id }];
    });
    return id;
  }, []);

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

  // ── Connection diagnostics (h): poll RTCPeerConnection.getStats() ──
  // Read-only side effect — never touches the transfer protocol.
  const pollConnStats = useCallback(async () => {
    try {
      const conn = connRef.current;
      const pc = conn?.peerConnection;
      if (!pc || pc.signalingState === "closed") return;
      let report = null;
      try { report = await pc.getStats(); }
      catch { return; }
      if (!report) return;

      let pair = null;
      let localCand = null;
      let remoteCand = null;
      const pairs = [];
      const locals = new Map();
      const remotes = new Map();
      report.forEach((s) => {
        if (s.type === "candidate-pair") pairs.push(s);
        else if (s.type === "local-candidate") locals.set(s.id, s);
        else if (s.type === "remote-candidate") remotes.set(s.id, s);
      });
      pair = pairs.find((p) => p.nominated) || pairs.find((p) => p.state === "succeeded" || p.writable) || pairs[0] || null;
      if (pair) {
        localCand = locals.get(pair.localCandidateId) || null;
        remoteCand = remotes.get(pair.remoteCandidateId) || null;
      }
      const candStr = `${localCand?.candidate || ""} ${remoteCand?.candidate || ""}`.toLowerCase();
      const isRelay = Boolean(
        localCand?.candidateType === "relay" || remoteCand?.candidateType === "relay" ||
        localCand?.type === "relay" || remoteCand?.type === "relay" ||
        candStr.includes("typ relay")
      );
      const rttSec = pair?.currentRoundTripTime ?? pair?.roundTripTime ?? null;
      const dc = dcRef.current;
      setConnStats({
        timestamp: Date.now(),
        signaling: signalModeRef.current,
        iceState: pc.iceConnectionState || "--",
        connState: pc.connectionState || "--",
        connType: !pair ? "--" : isRelay ? "relay" : (remoteCand?.candidateType || remoteCand?.type || "direct"),
        isRelay,
        rttMs: typeof rttSec === "number" ? Math.round(rttSec * 1000) : null,
        localType: localCand?.candidateType || localCand?.type || null,
        remoteType: remoteCand?.candidateType || remoteCand?.type || null,
        localProto: localCand?.protocol || null,
        bytesSent: pair?.bytesSent ?? null,
        bytesReceived: pair?.bytesReceived ?? pair?.bytesReceived ?? null,
        bufferedAmount: typeof dc?.bufferedAmount === "number" ? dc.bufferedAmount : null,
      });
    } catch { /* diagnostics must never break transfers */ }
  }, []);

  const startStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    pollConnStats();
    statsIntervalRef.current = setInterval(pollConnStats, 2000);
  }, [pollConnStats]);

  const stopStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    setConnStats(null);
  }, []);

  // Creates a Peer on the private server, auto-falling back to the public
  // PeerJS cloud if the private server doesn't answer in time (cold start).
  const spawnPeer = useCallback((idOrUndefined, wire, opts = {}) => {
    const allowFallback = opts.allowFallback !== false;
    const p = new Peer(idOrUndefined, getPeerOptions(signalModeRef.current));
    let opened = false;
    p.on("open", () => {
      opened = true;
      if (signalTimerRef.current) { clearTimeout(signalTimerRef.current); signalTimerRef.current = null; }
    });
    if (allowFallback && signalModeRef.current === "custom") {
      if (signalTimerRef.current) clearTimeout(signalTimerRef.current);
      signalTimerRef.current = setTimeout(() => {
        signalTimerRef.current = null;
        if (!opened && signalModeRef.current === "custom" && !intentionalLeave.current) {
          console.warn("[Signal] Private server not responding. Falling back to public PeerJS cloud…");
          try { p.destroy(); } catch { /* ignore */ }
          signalModeRef.current = "public";
          setSignalMode("public");
          setPeerError("");
          addMessage({ type: "system", text: "⚠️ Private signal server unreachable — using public relay instead." });
          setPeer(spawnPeer(idOrUndefined, wire, { allowFallback: false }));
        }
      }, SIGNAL_FALLBACK_MS);
    }
    wire(p);
    return p;
  }, [addMessage]);

  const _advanceQueue = useCallback(() => {
    if (!connectedRef.current) return;
    const limit = maxParallelRef.current || 1;
    // start up to `limit` concurrent sends
    for (let i = activeFileIds.current.size; i < limit; i++) {
      const queue = fileQueueRef.current;
      const next = queue.find((q) => q.status === "queued" && !activeFileIds.current.has(q.id));
      if (!next) return;
      setFileQueue((prev) => prev.map((q) => q.id === next.id ? { ...q, status: "sending" } : q));
      activeFileIds.current.add(next.id);
      _sendFileInternal(next.file, next.id);
    }
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

      onTransferComplete?.({ id: fileId, name: state.fileName, size: state.fileSize, direction: "out", status: "done", duration, avgSpeed, compressed: state.compressionActive, rawBytes: state.rawBytes, compBytes: state.compBytes, savedBytes: savingsBytes });

      // Notify peer so they also record this transfer in their history
      const c = connRef.current;
      if (c) {
        c.send(encodeJSON({
          type: "transfer-complete", fileId,
          name: state.fileName, size: state.fileSize,
          direction: "out", status: "done",
          duration: duration ?? null, avgSpeed: avgSpeed ?? null,
          compressed: state.compressionActive,
          rawBytes: state.rawBytes, compBytes: state.compBytes, savedBytes: savingsBytes,
        }));
      }
    } catch (err) { console.error("Error in _finalizeSender:", err); }
    finally {
      delete sendStates.current[fileId]; delete speedTrackers.current[fileId];
      activeFileIds.current.delete(fileId);
      setFileQueue((prev) => prev.map((q) => q.id === fileId ? { ...q, status: "done" } : q));
      notifyDone("File sent", `"${state?.fileName || "file"}" delivered`);
      _advanceQueueRef.current?.();
    }
  }, [onTransferComplete, notifyDone]);

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
        const newPeer = isHost.current ? new Peer(code, getPeerOptions(signalModeRef.current)) : new Peer(undefined, getPeerOptions(signalModeRef.current));
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
          else {
            updateTransfer(fileId, { status: "error" });
            setFileQueue((prev) => prev.map((q) => q.id === fileId ? { ...q, status: "error" } : q));
            st.aborted = true;
            activeFileIds.current.delete(fileId);
            setTimeout(() => _advanceQueueRef.current?.(), 200);
          }
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
    const code = generateRoomCode();
    const wireHost = (peer) => {
      peer.on("open", id => { targetRoomCode.current = id; setRoomCode(id); setShareUrl(`${window.location.origin}${window.location.pathname}?room=${id}`); setPeer(peer); setScreen("host"); window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}?room=${id}`); });
      peer.on("disconnected", () => { console.warn("[Signals] Disconnected. Reconnecting…"); peer.reconnect(); });
      peer.on("connection", conn => { if (connectedRef.current) { conn.on("open", () => { conn.send(encodeJSON({ type: "room-full" })); setTimeout(() => conn.close(), 500); }); return; } setupConn.current(conn); });
      peer.on("error", err => { if (!connectedRef.current) setPeerError(`Create failed: ${err.type}`); });
    };
    setPeer(spawnPeer(code, wireHost));
  }, [spawnPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = useCallback(() => {
    const code = joinCode.trim().toUpperCase(); if (!code) return;
    if (isJoining || connectedRef.current) return;
    setIsJoining(true);
    intentionalLeave.current = false; isHost.current = false; targetRoomCode.current = code;
    const wireJoin = (peer) => {
      peer.on("open", () => { setupConn.current(peer.connect(code, { reliable: true, serialization: "raw" })); setPeer(peer); });
      peer.on("disconnected", () => { console.warn("[Signals] Disconnected. Reconnecting…"); peer.reconnect(); });
      peer.on("error", err => {
        // Private server asleep (or host sitting on the public cloud)?
        // Retry once on the public cloud before giving up.
        if (!connectedRef.current && signalModeRef.current === "custom") {
          console.warn(`[Signal] Private server issue (${err.type}). Retrying join on public cloud…`);
          try { peer.destroy(); } catch { /* ignore */ }
          if (signalTimerRef.current) { clearTimeout(signalTimerRef.current); signalTimerRef.current = null; }
          signalModeRef.current = "public";
          setSignalMode("public");
          setPeer(spawnPeer(undefined, wireJoin, { allowFallback: false }));
          return;
        }
        setIsJoining(false);
        if (!connectedRef.current) {
          setPeerError(err.type === "peer-unavailable" ? "Room not found or host offline." : `Join failed: ${err.type}`);
          setTimeout(() => leaveRoomRef.current?.(), 2000);
        }
      });
    };
    setPeer(spawnPeer(undefined, wireJoin));
  }, [joinCode, isJoining, spawnPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  const queueFile = useCallback((file) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setFileQueue(prev => [...prev, { id, file, status: "queued", name: file.name, size: file.size }]);
    return id;
  }, []);

  const leaveRoom = useCallback(() => {
    intentionalLeave.current = true;
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    if (backoffTimerRef.current) { clearTimeout(backoffTimerRef.current); backoffTimerRef.current = null; }
    if (signalTimerRef.current) { clearTimeout(signalTimerRef.current); signalTimerRef.current = null; }
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    if (peerTypingTimeout.current) { clearTimeout(peerTypingTimeout.current); peerTypingTimeout.current = null; }
    signalModeRef.current = "custom"; setSignalMode("custom");
    setConnStats(null);
    setPeerTyping(false);
    Object.values(sendStates.current).forEach(s => { s.aborted = true; Object.values(s.ackTimers || {}).forEach(clearTimeout); });
    Object.values(completedBlobsRef.current).forEach((b) => { try { URL.revokeObjectURL(b.url); } catch { /* ignore */ } });
    completedBlobsRef.current = {}; setCompletedBlobs({});

    sendStates.current = {};
    speedTrackers.current = {};
    receiveBuffers.current = {};
    activeFileIds.current.clear();
    fileQueueRef.current = [];
    dataQueue.current = [];
    reconnectCount.current = 0;
    lastReconnectMsgRef.current = "";

    peerRef.current?.destroy();
    setPeer(null);
    setConnected(false);
    setMessages([]);
    setTransfers([]);
    setFileQueue([]);
    setIsJoining(false);
    setRoomCode("");
    setShareUrl("");
    setReconnecting(false);
    setScreen("home");

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const pauseTransfer = useCallback((id) => {
    const s = sendStates.current[id]; if (s) s.paused = true;
    updateTransfer(id, { status: "paused", pausedByPeer: false });
    try { connRef.current?.send(encodeJSON({ type: "pause-transfer", fileId: id })); } catch { /* ignore */ }
  }, [updateTransfer]);
  const resumeTransfer = useCallback((id) => {
    const s = sendStates.current[id]; if (s) s.paused = false;
    updateTransfer(id, { status: "sending", pausedByPeer: false });
    try { connRef.current?.send(encodeJSON({ type: "resume-transfer", fileId: id })); } catch { /* ignore */ }
  }, [updateTransfer]);
  // Receiver-initiated pause/resume — asks sender to stop/start via protocol
  const pauseReceive = useCallback((id) => {
    updateTransfer(id, { status: "paused", pausedByPeer: false });
    try { connRef.current?.send(encodeJSON({ type: "pause-transfer", fileId: id })); } catch { /* ignore */ }
  }, [updateTransfer]);
  const resumeReceive = useCallback((id) => {
    updateTransfer(id, { status: "receiving", pausedByPeer: false });
    try { connRef.current?.send(encodeJSON({ type: "resume-transfer", fileId: id })); } catch { /* ignore */ }
  }, [updateTransfer]);
  const cancelTransfer = useCallback((id) => {
    const s = sendStates.current[id];
    if (s) { s.aborted = true; Object.values(s.ackTimers || {}).forEach(clearTimeout); }
    activeFileIds.current.delete(id);
    setFileQueue((prev) => prev.map((q) => q.id === id ? { ...q, status: "cancelled" } : q));
    updateTransfer(id, { status: "cancelled" });
    try { connRef.current?.send(encodeJSON({ type: "cancel-transfer", fileId: id })); } catch { /* ignore */ }
    _advanceQueueRef.current?.();
  }, [updateTransfer]);
  const retryTransfer = useCallback((transferId) => {
    const q = fileQueueRef.current.find((x) => x.id === transferId);
    const qFile = q?.file;
    if (!qFile) return null;
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFileQueue((prev) => [...prev, { id: newId, file: qFile, status: "queued", name: qFile.name, size: qFile.size }]);
    _advanceQueueRef.current?.();
    // kick queue in case connection ready
    setTimeout(() => _advanceQueueRef.current?.(), 50);
    return newId;
  }, []);

  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { fileQueueRef.current = fileQueue; }, [fileQueue]);
  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
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
  useEffect(() => { if (connected) _advanceQueue(); }, [fileQueue, connected, maxParallel, _advanceQueue]);
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

  const cacheCompletedBlob = useCallback((fileId, blob, name) => {
    try {
      const url = URL.createObjectURL(blob);
      completedBlobsRef.current[fileId] = { url, name, blob };
      setCompletedBlobs((prev) => ({ ...prev, [fileId]: { url, name } }));
      return url;
    } catch { return null; }
  }, []);

  const finishBuffer = (fileId, buf) => {
    const blob = new Blob(buf.chunks);
    const url = cacheCompletedBlob(fileId, blob, buf.meta.name);
    if (url) {
      const a = Object.assign(document.createElement("a"), { href: url, download: buf.meta.name });
      document.body.appendChild(a); a.click(); a.remove();
      // keep URL for "Download again" — revoked on leaveRoom
    }
    updateTransfer(fileId, { progress: 100, status: "done" });
    addMessage({ type: "system", text: `✅ Received "${buf.meta.name}"` });
    notifyDone("File received", `"${buf.meta.name}" — tap to download again from Files`);

    const savingsBytes = (buf.rawBytes || 0) - (buf.compBytes || 0);

    onTransferComplete?.({ id: fileId, name: buf.meta.name, size: buf.meta.size, direction: "in", status: "done", duration: null, avgSpeed: null, compressed: Boolean(buf.meta.compressed), rawBytes: buf.rawBytes, compBytes: buf.compBytes, savedBytes: savingsBytes });
    delete receiveBuffers.current[fileId];
  };

  const finishStream = useCallback((fileId, buf) => {
    updateTransfer(fileId, { progress: 100, status: "done" });
    addMessage({ type: "system", text: `✅ Received "${buf.meta.name}" (saved to disk)` });
    notifyDone("File received", `"${buf.meta.name}" saved to disk`);
    const _saved = (buf.rawBytes || 0) - (buf.compBytes || 0);
    onTransferComplete?.({ id: fileId, name: buf.meta.name, size: buf.meta.size, direction: "in", status: "done", duration: null, avgSpeed: null, compressed: Boolean(buf.meta.compressed), rawBytes: buf.rawBytes, compBytes: buf.compBytes, savedBytes: _saved });
    delete receiveBuffers.current[fileId];
  }, [notifyDone, onTransferComplete, updateTransfer, addMessage]);

  const _handleDataInternal = async (raw) => {
    const frame = decodeFrame(raw); if (!frame) return;
    if (frame.type === "json") {
      const { data } = frame;
      if (data.type === "chat") {
        addMessage({ id: data.id, type: "chat", text: data.text, sender: "them", time: data.time, status: "read" });
        // delivered ACK back to sender
        try { connRef.current?.send(encodeJSON({ type: "chat-ack", id: data.id })); } catch { /* ignore */ }
      }
      if (data.type === "chat-ack") {
        setMessages((prev) => prev.map((m) => m.id === data.id ? { ...m, status: "delivered" } : m));
        return;
      }
      if (data.type === "typing") {
        if (data.typing) {
          setPeerTyping(true);
          if (peerTypingTimeout.current) clearTimeout(peerTypingTimeout.current);
          peerTypingTimeout.current = setTimeout(() => setPeerTyping(false), 3000);
        } else {
          if (peerTypingTimeout.current) clearTimeout(peerTypingTimeout.current);
          setPeerTyping(false);
        }
        return;
      }
      if (data.type === "sync-history") {
        (data.messages || []).forEach((m) => {
          if (!m.id) return;
          const flip = m.sender === "me" ? "them" : "me";
          addMessage({ id: m.id, type: "chat", text: m.text, sender: flip, time: m.time, status: "read" });
        });
      }
      if (data.type === "hello") peerCompression.current = data.compression || [];
      if (data.type === "room-full") { setPeerError("Room is full."); setTimeout(leaveRoom, 2000); }
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
        const st = sendStates.current[data.fileId];
        if (st) {
          st.aborted = true;
          Object.values(st.ackTimers || {}).forEach(clearTimeout);
          activeFileIds.current.delete(data.fileId);
          setFileQueue((prev) => prev.map((q) => q.id === data.fileId ? { ...q, status: "cancelled" } : q));
          _advanceQueueRef.current?.();
        }
        // receiver-side cancel of our send, or sender-side cancel of our receive
        if (receiveBuffers.current[data.fileId]) {
          const rb = receiveBuffers.current[data.fileId];
          if (rb.mode === "stream" && rb.writable) rb.writable.abort().catch(() => {});
          delete receiveBuffers.current[data.fileId];
        }
        updateTransfer(data.fileId, { status: "cancelled" });
        addMessage({ type: "system", text: "🚫 Peer cancelled transfer." });
      }
      if (data.type === "pause-transfer") {
        const st = sendStates.current[data.fileId];
        if (st) { st.paused = true; updateTransfer(data.fileId, { status: "paused", pausedByPeer: true }); }
        else { updateTransfer(data.fileId, { status: "paused", pausedByPeer: true }); }
        return;
      }
      if (data.type === "resume-transfer") {
        const st = sendStates.current[data.fileId];
        if (st) { st.paused = false; updateTransfer(data.fileId, { status: "sending", pausedByPeer: false }); }
        else { updateTransfer(data.fileId, { status: "receiving", pausedByPeer: false }); }
        return;
      }
      if (data.type === "resume-request") {
        const st = sendStates.current[data.fileId]; if (st) { st.resumeFrom = data.receivedCount; addMessage({ type: "system", text: "♻️ Resuming..." }); }
      }
      if (data.type === "transfer-complete") {
        onTransferComplete?.({
          id: data.fileId, name: data.name, size: data.size,
          direction: data.direction === "out" ? "in" : "out",
          status: data.status, duration: data.duration ?? null,
          avgSpeed: data.avgSpeed ?? null,
          compressed: Boolean(data.compressed),
          rawBytes: data.rawBytes ?? null, compBytes: data.compBytes ?? null,
          savedBytes: data.savedBytes ?? null,
        });
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
        if (buf.received === buf.meta.totalChunks) { try { await buf.writable.close(); } catch { /* ignore */ } finishStream(fileId, buf); }
      } else {
        buf.chunks[index] = chunk; buf.received++;
        updateTransfer(fileId, { progress: Math.min(99, Math.floor((buf.received / buf.meta.totalChunks) * 100)) });
        if (buf.received === buf.meta.totalChunks) finishBuffer(fileId, buf);
      }
    }
  };

  setupConn.current = (connection) => {
    connection.on("open", () => {
      setIsJoining(false);
      connRef.current = connection; connectedRef.current = true; setConnected(true); setScreen("room");
      reconnectCount.current = 0; setReconnecting(false); lastReconnectMsgRef.current = "";
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
      if (backoffTimerRef.current) { clearTimeout(backoffTimerRef.current); backoffTimerRef.current = null; }
      requestNotifyPermission();

      if (COMPRESSION_ENABLED && isCompressionSupported()) connection.send(encodeJSON({ type: "hello", compression: ["deflate-raw"] }));
      const dc = connection._dc || connection.dataChannel; if (dc) { try { dc.bufferedAmountLowThreshold = LOW_WATERMARK; } catch { /* ignore */ } dcRef.current = dc; }
      startStatsPolling();
      Object.entries(receiveBuffers.current).forEach(([id, b]) => { if (b.received > 0) connection.send(encodeJSON({ type: "resume-request", fileId: id, receivedCount: b.received })); });

      // Sync chat history so both peers always have the full conversation (ids for stable dedup)
      const chatMsgs = messagesRef.current.filter((m) => m.type === "chat" && m.id);
      if (chatMsgs.length > 0) {
        connection.send(encodeJSON({
          type: "sync-history",
          messages: chatMsgs.map((m) => ({ id: m.id, text: m.text, sender: m.sender, time: m.time })),
        }));
      }

      _advanceQueue();
    });
    connection.on("data", raw => { dataQueue.current.push(raw); processQueue(); });
    connection.on("close", () => {
      connRef.current = null; dcRef.current = null;
      stopStatsPolling();
      const wasConnected = connectedRef.current;
      connectedRef.current = false;
      setConnected(false);
      if (wasConnected && !intentionalLeave.current) {
        setTransfers(prev => prev.map(t =>
          (t.status === "sending" || t.status === "receiving") ? { ...t, status: "reconnecting" } : t
        ));
        _attemptReconnect();
      } else if (intentionalLeave.current) {
        leaveRoom();
      }
      // if never connected (wasConnected=false) and !intentionalLeave,
      // the join error handler's timeout will call leaveRoom
    });
  };

  const sendChat = useCallback((t) => {
    const c = connRef.current; if (!c || !t.trim()) return false;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try { c.send(encodeJSON({ type: "chat", id, text: t, time })); } catch { return false; }
    addMessage({ id, type: "chat", text: t, sender: "me", time, status: "sent" });
    // stop typing indicator
    try { c.send(encodeJSON({ type: "typing", typing: false })); } catch { /* ignore */ }
    return true;
  }, [addMessage]);

  const sendTyping = useCallback((typing) => {
    const now = Date.now();
    if (typing && now - typingThrottle.current < 1500) return;
    if (typing) typingThrottle.current = now;
    try { connRef.current?.send(encodeJSON({ type: "typing", typing: Boolean(typing) })); } catch { /* ignore */ }
  }, []);

  const downloadAgain = useCallback((fileId) => {
    const entry = completedBlobsRef.current[fileId];
    if (!entry) return false;
    const a = Object.assign(document.createElement("a"), { href: entry.url, download: entry.name });
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  }, []);

  return {
    screen, setScreen, roomCode, joinCode, connected, messages, transfers, fileQueue, shareUrl, peerError, libsReady, reconnecting, isJoining,
    connStats, signalMode, maxParallel, setMaxParallel, peerTyping, completedBlobs,
    setJoinCode, createRoom, joinRoom, queueFile, leaveRoom, setTransfers, setPeerError,
    sendChat, sendTyping, downloadAgain,
    pauseTransfer, resumeTransfer, pauseReceive, resumeReceive, cancelTransfer, retryTransfer,
    cancelReceive: (id) => {
      const buf = receiveBuffers.current[id]; if (buf?.mode === "stream" && buf.writable) buf.writable.abort().catch(() => { });
      delete receiveBuffers.current[id]; updateTransfer(id, { status: "cancelled" });
      try { connRef.current?.send(encodeJSON({ type: "cancel-transfer", fileId: id })); } catch { /* ignore */ }
    },
    removeFromQueue: (id) => { if (!activeFileIds.current.has(id)) setFileQueue(prev => prev.filter(q => q.id !== id)); }
  };
}