// // ─── Adaptive chunk sizes ────────────────────────────────────────────────────
// export const CHUNK_TIERS = [
//   { maxSize: 1   * 1024 * 1024, chunkSize: 16  * 1024 }, // <1 MB   → 16 KB
//   { maxSize: 10  * 1024 * 1024, chunkSize: 64  * 1024 }, // <10 MB  → 64 KB
//   { maxSize: 100 * 1024 * 1024, chunkSize: 256 * 1024 }, // <100 MB → 256 KB
//   { maxSize: Infinity,          chunkSize: 1   * 1024 * 1024 }, // >100 MB → 1 MB
// ];

// export const CHUNK_RETRY_LIMIT  = 3;       // max retries per chunk
// export const CHUNK_ACK_TIMEOUT  = 5000;    // ms to wait for ACK before retry
// export const SPEED_UPDATE_MS    = 500;     // how often speed/ETA refreshes
// export const PEERJS_CDN         = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
// export const QRCODE_CDN         = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
// export const ICE_SERVERS        = [
//   { urls: "stun:stun.l.google.com:19302" },
//   { urls: "stun:stun1.l.google.com:19302" },
//   { urls: "stun:stun2.l.google.com:19302" },
// ];

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /** Pick chunk size based on total file size */
// export function getChunkSize(fileSize) {
//   for (const tier of CHUNK_TIERS) {
//     if (fileSize <= tier.maxSize) return tier.chunkSize;
//   }
//   return 1 * 1024 * 1024;
// }

// /** Human-readable bytes */
// export function formatBytes(bytes) {
//   if (!bytes || bytes === 0) return "0 B";
//   const k = 1024;
//   const sizes = ["B", "KB", "MB", "GB"];
//   const i = Math.floor(Math.log(bytes) / Math.log(k));
//   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
// }

// /** Human-readable speed */
// export function formatSpeed(bytesPerSec) {
//   if (!bytesPerSec || bytesPerSec <= 0) return "-- KB/s";
//   if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
//   return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
// }

// /** Human-readable ETA */
// export function formatETA(seconds) {
//   if (!seconds || !isFinite(seconds) || seconds <= 0) return "--";
//   if (seconds < 60) return `${Math.ceil(seconds)}s`;
//   const m = Math.floor(seconds / 60);
//   const s = Math.ceil(seconds % 60);
//   return `${m}m ${s}s`;
// }

// /** Generate unambiguous 6-char room code */
// export function generateRoomCode() {
//   const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
//   return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
// }

// /** Dynamically inject a <script> tag, resolves when loaded */
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
//
// CRITICAL: Chrome enforces a hard SCTP maxMessageSize of exactly 256 KB
// (262144 bytes). Our framing protocol adds a header to every chunk frame:
//
//   Layout: [0x02][u16 fileIdLen=2][fileId ~21 bytes][u32 index=4] = ~28 bytes
//
// So a 256 KB chunk + 28 B header = 262,172 bytes which EXCEEDS the 262,144 B
// Chrome limit. Chrome throws:
//   "RTCDataChannel::send() called with message size(262172)
//    exceeding max message size (262144)"
// This was caught by our try/catch → status:"error" → "✗ Failed".
//
// FIX: cap the largest chunk at 128 KB. Even with the 28-byte header, the
// maximum frame is 131,100 bytes — safely under Chrome's 262,144 B SCTP limit.
// 128 KB chunks also give flow control finer granularity (more pause points).


// export const CHUNK_TIERS = [
//   { maxSize: 1   * 1024 * 1024, chunkSize: 16  * 1024 }, // < 1 MB  → 16 KB
//   { maxSize: 10  * 1024 * 1024, chunkSize: 64  * 1024 }, // <10 MB  → 64 KB
//   { maxSize: Infinity,          chunkSize: 128 * 1024 }, // ≥10 MB  → 128 KB
// ];

// export const CHUNK_RETRY_LIMIT  = 3;       // max retries per chunk
// export const CHUNK_ACK_TIMEOUT  = 8000;    // ms to wait for ACK before retry
//                                             // (raised from 5000 — gives slow
//                                             //  WAN peers room to breathe)
// export const SPEED_UPDATE_MS    = 500;     // how often speed/ETA refreshes
// export const PEERJS_CDN         = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
// export const QRCODE_CDN         = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
// export const ICE_SERVERS        = [
//   { urls: "stun:stun.l.google.com:19302" },
//   { urls: "stun:stun1.l.google.com:19302" },
//   { urls: "stun:stun2.l.google.com:19302" },
// ];

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /** Pick chunk size based on total file size */
// export function getChunkSize(fileSize) {
//   for (const tier of CHUNK_TIERS) {
//     if (fileSize <= tier.maxSize) return tier.chunkSize;
//   }
//   return 128 * 1024; // fallback: 128 KB
// }

// /** Human-readable bytes */
// export function formatBytes(bytes) {
//   if (!bytes || bytes === 0) return "0 B";
//   const k = 1024;
//   const sizes = ["B", "KB", "MB", "GB"];
//   const i = Math.floor(Math.log(bytes) / Math.log(k));
//   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
// }

// /** Human-readable speed */
// export function formatSpeed(bytesPerSec) {
//   if (!bytesPerSec || bytesPerSec <= 0) return "-- KB/s";
//   if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
//   return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
// }

// /** Human-readable ETA */
// export function formatETA(seconds) {
//   if (!seconds || !isFinite(seconds) || seconds <= 0) return "--";
//   if (seconds < 60) return `${Math.ceil(seconds)}s`;
//   const m = Math.floor(seconds / 60);
//   const s = Math.ceil(seconds % 60);
//   return `${m}m ${s}s`;
// }

// /** Generate unambiguous 6-char room code */
// export function generateRoomCode() {
//   const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
//   return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
// }

// /** Dynamically inject a <script> tag, resolves when loaded */
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
import Peer from 'peerjs'
export const CHUNK_TIERS = [
  { maxSize: 1   * 1024 * 1024, chunkSize: 16  * 1024 }, // < 1 MB  → 16 KB
  { maxSize: 10  * 1024 * 1024, chunkSize: 64  * 1024 }, // <10 MB  → 64 KB
  { maxSize: Infinity,          chunkSize: 128 * 1024 }, // ≥10 MB  → 128 KB
];

export const CHUNK_RETRY_LIMIT   = 3;
export const CHUNK_ACK_TIMEOUT   = 8000;
export const SPEED_UPDATE_MS     = 500;

// ─── Auto-reconnect ───────────────────────────────────────────────────────────
export const RECONNECT_MAX       = 3;       // max auto-reconnect attempts
export const RECONNECT_BASE_MS   = 1500;    // base backoff (doubles each attempt)

// ─── CDN ─────────────────────────────────────────────────────────────────────
export const PEERJS_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
export const QRCODE_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

// ─── ICE / STUN ───────────────────────────────────────────────────────────────
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function getChunkSize(fileSize) {
  for (const t of CHUNK_TIERS) if (fileSize <= t.maxSize) return t.chunkSize;
  return 128 * 1024;
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB"];
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

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}