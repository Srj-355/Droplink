// ─── Adaptive chunk sizes ────────────────────────────────────────────────────
export const CHUNK_TIERS = [
  { maxSize: 1   * 1024 * 1024, chunkSize: 16  * 1024 }, // <1 MB   → 16 KB
  { maxSize: 10  * 1024 * 1024, chunkSize: 64  * 1024 }, // <10 MB  → 64 KB
  { maxSize: 100 * 1024 * 1024, chunkSize: 256 * 1024 }, // <100 MB → 256 KB
  { maxSize: Infinity,          chunkSize: 1   * 1024 * 1024 }, // >100 MB → 1 MB
];

export const CHUNK_RETRY_LIMIT  = 3;       // max retries per chunk
export const CHUNK_ACK_TIMEOUT  = 5000;    // ms to wait for ACK before retry
export const SPEED_UPDATE_MS    = 500;     // how often speed/ETA refreshes
export const PEERJS_CDN         = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
export const QRCODE_CDN         = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
export const ICE_SERVERS        = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pick chunk size based on total file size */
export function getChunkSize(fileSize) {
  for (const tier of CHUNK_TIERS) {
    if (fileSize <= tier.maxSize) return tier.chunkSize;
  }
  return 1 * 1024 * 1024;
}

/** Human-readable bytes */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Human-readable speed */
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return "-- KB/s";
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

/** Human-readable ETA */
export function formatETA(seconds) {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

/** Generate unambiguous 6-char room code */
export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Dynamically inject a <script> tag, resolves when loaded */
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