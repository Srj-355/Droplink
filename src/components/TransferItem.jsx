import { formatBytes, formatSpeed, formatETA } from "../constants";

function fileIcon(name = "") {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { e: "🖼️", bg: "#E7F6EB", fg: "#1F7A3D" };
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return { e: "🎬", bg: "#EFE7FE", fg: "#6A24E0" };
  if (["mp3", "wav", "ogg"].includes(ext)) return { e: "🎵", bg: "#FFF7E6", fg: "#9A6B0F" };
  if (["pdf"].includes(ext)) return { e: "📄", bg: "#FDECEF", fg: "#C01235" };
  if (["zip", "rar", "7z", "tar"].includes(ext)) return { e: "🗜️", bg: "#E7F0FE", fg: "#166FE5" };
  if (["doc", "docx", "txt", "md"].includes(ext)) return { e: "📝", bg: "#E7F3FB", fg: "#0E7CC0" };
  return { e: "📦", bg: "var(--surface-hover)", fg: "var(--text-muted)" };
}

export default function TransferItem({ transfer: t, onPause, onResume, onCancel, onRetry, onDownloadAgain, canDownloadAgain }) {
  const isOut = t.direction === "out";
  const isDone = t.status === "done";
  const isErr = t.status === "error";
  const isPaused = t.status === "paused";
  const isCancelled = t.status === "cancelled";
  const isReconnecting = t.status === "reconnecting";
  const failed = isErr || isCancelled;

  const barClass =
    isDone ? "bar-done" :
      isErr ? "bar-error" :
        isPaused ? "bar-paused" :
          isCancelled ? "bar-cancelled" :
            isReconnecting ? "bar-reconnecting" :
              isOut ? "bar-shimmer" : "bar-receive";

  const statusLabel =
    isDone ? <span style={{ ...s.badge, ...s.badgeDone }}>✓ Done</span> :
      isErr ? <span style={{ ...s.badge, ...s.badgeErr }}>Failed</span> :
        isPaused ? <span style={{ ...s.badge, ...s.badgePaused }}>{t.pausedByPeer ? "Paused by peer" : "Paused"}</span> :
          isCancelled ? <span style={{ ...s.badge, ...s.badgeCancelled }}>Cancelled</span> :
            isReconnecting ? <span style={{ ...s.badge, ...s.badgeRetry }}>Reconnecting…</span> :
              <span style={s.pct}>{t.progress}%</span>;

  const active = !isDone && !isErr && !isCancelled && !isReconnecting;
  const fi = fileIcon(t.name);

  return (
    <div style={s.item} className="glass-sm">
      <div style={s.top}>
        <span style={{ ...s.fIcon, background: fi.bg, color: fi.fg }}>{fi.e}</span>
        <div style={s.nameCol}>
          <span style={s.name} title={t.name}>{t.name}</span>
          <span style={s.sub}>{isOut ? "Sending" : "Receiving"} · {formatBytes(t.size)}</span>
        </div>
        <span style={{ ...s.dir, ...(isOut ? s.dirOut : s.dirIn) }}>
          {isOut ? "↑" : "↓"}
        </span>
      </div>

      <div style={s.barBg}>
        <div className={barClass} style={{ ...s.barFill, width: `${t.progress}%` }} />
      </div>

      <div style={s.foot}>
        <div style={s.footL}>
          {statusLabel}
          {t.compressed && !isDone && !isErr && !isCancelled && (
            <span style={{ ...s.badge, color: "var(--text-muted)", background: "var(--surface-hover)" }}>
              zipped
            </span>
          )}
        </div>

        <div style={s.footR}>
          {active && !isPaused && (
            <>
              {t.speed > 0 && <span style={s.speed}>{formatSpeed(t.speed)}</span>}
              {t.eta > 0 && <span style={s.eta}>· {formatETA(t.eta)} left</span>}
            </>
          )}

          {active && (
            <div style={s.actions}>
              {isPaused ? (
                <button className="btn-icon" title="Resume" aria-label="Resume transfer" onClick={() => onResume?.(t.id)} style={s.btnGreen}>▶</button>
              ) : (
                <button className="btn-icon" title={isOut ? "Pause sending" : "Ask sender to pause"} aria-label={isOut ? "Pause sending" : "Ask sender to pause"} onClick={() => onPause?.(t.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                </button>
              )}
              <button className="btn-icon" title="Cancel transfer" aria-label="Cancel transfer" onClick={() => onCancel?.(t.id)} style={s.btnRed}>✕</button>
            </div>
          )}

          {failed && isOut && (
            <button className="btn btn-primary" style={{ padding: "0.45rem 0.9rem", fontSize: "0.72rem", minHeight: 36 }} onClick={() => onRetry?.(t.id)} title="Re-queue this file" aria-label="Retry transfer">
              ↻ Retry
            </button>
          )}
          {failed && !isOut && (
            <span style={s.hint}>Ask sender to resend</span>
          )}

          {isDone && !isOut && canDownloadAgain && (
            <button className="btn btn-outline" style={{ padding: "0.45rem 0.9rem", fontSize: "0.72rem", borderRadius: 999, minHeight: 36 }} onClick={() => onDownloadAgain?.(t.id)} title="Save this file again" aria-label="Download file again">
              ⬇ Save again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  item: { borderRadius: 16, padding: "0.75rem 0.85rem", overflow: "hidden", minWidth: 0, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)" },
  top: { display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.55rem", minWidth: 0, overflow: "hidden" },
  fIcon: { width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 },
  nameCol: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  name: { fontSize: "0.8rem", color: "var(--text)", fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sub: { fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 500 },
  dir: { fontSize: "0.7rem", width: 26, height: 26, borderRadius: "50%", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  dirOut: { background: "var(--send-light)", color: "var(--primary)" },
  dirIn: { background: "var(--receive-light)", color: "var(--primary-2)" },
  barBg: { height: 6, background: "var(--surface-hover)", borderRadius: 99, overflow: "hidden", marginBottom: "0.5rem" },
  barFill: { height: "100%", borderRadius: 99, transition: "width 0.3s ease" },
  foot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", minWidth: 0 },
  footL: { display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: 0 },
  footR: { display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 },
  pct: { fontSize: "0.68rem", color: "var(--primary)", fontWeight: 800, fontFamily: "'Geist Mono', monospace" },
  speed: { fontSize: "0.66rem", color: "var(--primary)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" },
  eta: { fontSize: "0.66rem", color: "var(--text-dim)" },
  hint: { fontSize: "0.66rem", color: "var(--text-dim)", fontStyle: "italic" },
  badge: { fontSize: "0.64rem", padding: "0.18rem 0.6rem", borderRadius: 999, fontWeight: 700 },
  badgeDone: { background: "var(--green-bg)", color: "var(--green)" },
  badgeErr: { background: "var(--rose-bg)", color: "var(--rose)" },
  badgePaused: { background: "var(--amber-bg)", color: "var(--amber)" },
  badgeCancelled: { background: "var(--surface-hover)", color: "var(--text-dim)" },
  badgeRetry: { background: "var(--info-bg)", color: "var(--info)" },
  actions: { display: "flex", gap: "0.25rem" },
  btnGreen: { color: "var(--green)", borderColor: "var(--green-border)", background: "var(--green-bg)" },
  btnRed: { color: "var(--rose)" },
};
