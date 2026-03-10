
// // ─── Adaptive chunk sizes ────────────────────────────────────────────────────
// // Chrome SCTP maxMessageSize = 262144 bytes (256 KB).
// // Our frame header adds ~28 bytes per chunk. Max safe chunk = 128 KB.
// import Peer from 'peerjs'
// export const CHUNK_TIERS = [
//   { maxSize: 1   * 1024 * 1024, chunkSize: 16  * 1024 }, // < 1 MB  → 16 KB
//   { maxSize: 10  * 1024 * 1024, chunkSize: 64  * 1024 }, // <10 MB  → 64 KB
//   { maxSize: Infinity,          chunkSize: 128 * 1024 }, // ≥10 MB  → 128 KB
// ];

// export const CHUNK_RETRY_LIMIT   = 3;
// export const CHUNK_ACK_TIMEOUT   = 8000;
// export const SPEED_UPDATE_MS     = 500;

// // ─── Auto-reconnect ───────────────────────────────────────────────────────────
// export const RECONNECT_MAX       = 3;       // max auto-reconnect attempts
// export const RECONNECT_BASE_MS   = 1500;    // base backoff (doubles each attempt)

// // ─── CDN ─────────────────────────────────────────────────────────────────────
// export const PEERJS_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
// export const QRCODE_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

// // ─── ICE / STUN ───────────────────────────────────────────────────────────────
// export const ICE_SERVERS = [
//   { urls: "stun:stun.l.google.com:19302" },
//   { urls: "stun:stun1.l.google.com:19302" },
//   { urls: "stun:stun2.l.google.com:19302" },
// ];

// // ─── Helpers ─────────────────────────────────────────────────────────────────
// export function getChunkSize(fileSize) {
//   for (const t of CHUNK_TIERS) if (fileSize <= t.maxSize) return t.chunkSize;
//   return 128 * 1024;
// }

// export function formatBytes(bytes) {
//   if (!bytes || bytes === 0) return "0 B";
//   const k = 1024, s = ["B","KB","MB","GB"];
//   const i = Math.floor(Math.log(bytes) / Math.log(k));
//   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
// }

// export function formatSpeed(bps) {
//   if (!bps || bps <= 0) return "-- KB/s";
//   if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
//   return `${(bps / 1024).toFixed(0)} KB/s`;
// }

// export function formatETA(sec) {
//   if (!sec || !isFinite(sec) || sec <= 0) return "--";
//   if (sec < 60) return `${Math.ceil(sec)}s`;
//   return `${Math.floor(sec / 60)}m ${Math.ceil(sec % 60)}s`;
// }

// export function generateRoomCode() {
//   const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
//   return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
// }

// export function loadScript(src) {
//   return new Promise((resolve, reject) => {
//     if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
//     const s = document.createElement("script");
//     s.src = src;
//     s.onload = resolve;
//     s.onerror = () => reject(new Error(`Failed to load ${src}`));
//     document.head.appendChild(s);
//   });
// }

// ─── Adaptive chunk sizes ────────────────────────────────────────────────────
// Chrome SCTP maxMessageSize = 262144 bytes (256 KB).
// Our frame header adds ~28 bytes per chunk. Max safe chunk = 128 KB.
export const CHUNK_TIERS = [
  { maxSize: 1   * 1024 * 1024, chunkSize: 16  * 1024 }, // < 1 MB  → 16 KB
  { maxSize: 10  * 1024 * 1024, chunkSize: 64  * 1024 }, // <10 MB  → 64 KB
  { maxSize: Infinity,          chunkSize: 128 * 1024 }, // ≥10 MB  → 128 KB
];

export const CHUNK_RETRY_LIMIT   = 3;
export const CHUNK_ACK_TIMEOUT   = 8000;
export const SPEED_UPDATE_MS     = 500;

// ─── Auto-reconnect ───────────────────────────────────────────────────────────
export const RECONNECT_MAX       = 3;
export const RECONNECT_BASE_MS   = 1500;

// ─── ICE / STUN + TURN ───────────────────────────────────────────────────────
// STUN: free Google servers — used first, works for most direct connections
// TURN: Open Relay by Metered — free, no account needed, used as fallback
//       only when both peers are behind strict NAT (e.g. mobile data networks)
export const ICE_SERVERS = [
  // ── STUN ──────────────────────────────────────────────────────────────────
  { urls: "stun:stun.l.google.com:19302"  },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:openrelay.metered.ca:80"  },

  // ── TURN (fallback relay) ──────────────────────────────────────────────────
  // Port 80 UDP/TCP — works through most firewalls
  {
    urls:       "turn:openrelay.metered.ca:80",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
  // Port 443 UDP/TCP — works through strict firewalls that block port 80
  {
    urls:       "turn:openrelay.metered.ca:443",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
  // TURNS — TURN over TLS on port 443, most reliable through corporate firewalls
  {
    urls:       "turns:openrelay.metered.ca:443",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getChunkSize(fileSize) {
  for (const t of CHUNK_TIERS) if (fileSize <= t.maxSize) return t.chunkSize;
  return 128 * 1024;
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024, s = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

export function formatSpeed(bps) {
  if (!bps || bps <= 0) return "-- KB/s";
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

export function formatETA(sec) {
  if (!sec || !isFinite(sec) || sec <= 0) return "--";
  if (sec < 60) return `${Math.ceil(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.ceil(sec % 60)}s`;
}

export function generateRoomCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}