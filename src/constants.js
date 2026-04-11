
// ─── Adaptive chunk sizes ────────────────────────────────────────────────────
// Chrome SCTP maxMessageSize = 262144 bytes (256 KB).
// Our frame header adds ~28 bytes per chunk. Max safe payload = 128 KB.
export const CHUNK_TIERS = [
  { maxSize: 1 * 1024 * 1024,   chunkSize: 16 * 1024   }, // < 1 MB  → 16 KB chunks
  { maxSize: 10 * 1024 * 1024,  chunkSize: 64 * 1024   }, // <10 MB  → 64 KB chunks
  { maxSize: 100 * 1024 * 1024, chunkSize: 128 * 1024  }, // <100 MB → 128 KB chunks
  { maxSize: Infinity,           chunkSize: 224 * 1024  }, // ≥100 MB → 224 KB chunks (Safely <256KB)
];

export const CHUNK_RETRY_LIMIT = 3;
export const CHUNK_ACK_TIMEOUT = 8000;
export const SPEED_UPDATE_MS   = 500;
export const RECONNECT_MAX     = 3;
export const RECONNECT_BASE_MS = 1500;
export const RECONNECT_TIMEOUT_MS = 15000;
export const COMPRESSION_ENABLED = true;

// ─── PeerJS Signalling Server ─────────────────────────────────────────────────
// Self-hosted on Render.com — free, no card required.
// Fixes rate limits and unreliability of the default public PeerJS cloud.
export const USE_CUSTOM_PEER_SERVER = true;

export const PEER_SERVER = {
  host:   "droplink-peerjs-server.onrender.com",
  port:   443,
  path:   "/",
  secure: true,
  key:    "droplink",
};

// ─── ICE / STUN servers ───────────────────────────────────────────────────────
// Multiple independent STUN providers for redundancy.
// Works for ~70% of connections (same WiFi, simple home NAT).
// NOTE: A TURN relay server is required for strict NAT / mobile data.
// For university demo: put all devices on the same hotspot as a backup.
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302"       },
  { urls: "stun:stun1.l.google.com:19302"      },
  { urls: "stun:stun2.l.google.com:19302"      },
  { urls: "stun:stun3.l.google.com:19302"      },
  { urls: "stun:stun4.l.google.com:19302"      },
  { urls: "stun:stun.cloudflare.com:3478"      },
  { urls: "stun:stun.stunprotocol.org:3478"    },
  { urls: "stun:stun.voip.blackberry.com:3478" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getChunkSize(fileSize) {
  for (const t of CHUNK_TIERS) if (fileSize <= t.maxSize) return t.chunkSize;
  return 128 * 1024;
}

export function formatBytes(bytes) {
  if (bytes == null || bytes <= 0) return "0 B";
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