import { formatBytes, formatSpeed, formatETA } from "../constants";

export default function TransferItem({ transfer: t, onPause, onResume, onCancel }) {
  const isOut = t.direction === "out";
  const isDone = t.status === "done";
  const isErr = t.status === "error";
  const isPaused = t.status === "paused";
  const isCancelled = t.status === "cancelled";
  const isReconnecting = t.status === "reconnecting";

  const barClass =
    isDone ? "bar-done" :
      isErr ? "bar-error" :
        isPaused ? "bar-paused" :
          isCancelled ? "bar-cancelled" :
            isReconnecting ? "bar-reconnecting" :
              isOut ? "bar-shimmer" : "bar-receive";

  const statusLabel =
    isDone ? <span style={{ ...s.badge, ...s.badgeDone }}>Done</span> :
      isErr ? <span style={{ ...s.badge, ...s.badgeErr }}>Failed</span> :
        isPaused ? <span style={{ ...s.badge, ...s.badgePaused }}>Paused</span> :
          isCancelled ? <span style={{ ...s.badge, ...s.badgeCancelled }}>Cancelled</span> :
            isReconnecting ? <span style={{ ...s.badge, ...s.badgeRetry }}>Reconnecting…</span> :
              <span style={s.pct}>{t.progress}%</span>;

  const canAct = !isDone && !isErr && !isCancelled && !isReconnecting && isOut;

  return (
    <div style={s.item} className="glass-sm">
      {/* Top row */}
      <div style={s.top}>
        <span style={{ ...s.dir, ...(isOut ? s.dirOut : s.dirIn) }}>
          {isOut ? "↑ OUT" : "↓ IN"}
        </span>
        <span style={s.name} title={t.name}>{t.name}</span>
        <span style={s.size}>{formatBytes(t.size)}</span>
      </div>

      {/* Progress bar */}
      <div style={s.barBg}>
        <div className={barClass} style={{ ...s.barFill, width: `${t.progress}%` }} />
      </div>

      {/* Footer */}
      <div style={s.foot}>
        <div style={s.footL}>
          {statusLabel}
          {t.chunkSize && !isDone && !isErr && !isCancelled && (
            <span style={s.chunkLbl}>
              {t.chunkSize >= 1024 * 1024 ? `${t.chunkSize / (1024 * 1024)}MB` : `${t.chunkSize / 1024}KB`} chunks
            </span>
          )}
          {t.compressed && !isDone && !isErr && !isCancelled && (
            <span style={{ ...s.badge, color: "var(--text-muted)", background: "var(--bg)" }}>
              compressed
            </span>
          )}
        </div>

        <div style={s.footR}>
          {/* Speed / ETA */}
          {!isDone && !isErr && !isCancelled && !isPaused && !isReconnecting && (
            <>
              {t.speed > 0 && <span style={s.speed}>{formatSpeed(t.speed)}</span>}
              {t.eta > 0 && <span style={s.eta}>ETA {formatETA(t.eta)}</span>}
            </>
          )}

          {/* Action buttons */}
          {canAct && (
            <div style={s.actions}>
              {isPaused ? (
                <button className="btn-icon" title="Resume" onClick={() => onResume?.(t.id)} style={s.btnGreen}>▶</button>
              ) : (
                <button className="btn-icon" title="Pause" onClick={() => onPause?.(t.id)}>⏸</button>
              )}
              <button className="btn-icon" title="Cancel" onClick={() => onCancel?.(t.id)} style={s.btnRed}>✕</button>
            </div>
          )}
          {/* Receiver cancel */}
          {!isOut && !isDone && !isErr && !isCancelled && (
            <button className="btn-icon" title="Cancel" onClick={() => onCancel?.(t.id)} style={s.btnRed}>✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  item: { borderRadius: 10, padding: "0.7rem 0.85rem", overflow: "hidden", minWidth: 0, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)" },
  top: { display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem", minWidth: 0, overflow: "hidden" },
  dir: { fontSize: "0.58rem", padding: "0.1rem 0.42rem", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "'Geist Mono', monospace" },
  dirOut: { background: "var(--send-light)", color: "var(--send)" },
  dirIn: { background: "var(--receive-light)", color: "var(--receive)" },
  name: { fontSize: "0.78rem", color: "var(--text)", fontWeight: 500, flex: 1, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  size: { fontSize: "0.66rem", color: "var(--text-muted)", flexShrink: 0 },
  barBg: { height: 3, background: "var(--bg)", borderRadius: 2, overflow: "hidden", marginBottom: "0.4rem" },
  barFill: { height: "100%", borderRadius: 2, transition: "width 0.3s ease" },
  foot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", minWidth: 0 },
  footL: { display: "flex", alignItems: "center", gap: "0.45rem", flex: 1, minWidth: 0 },
  footR: { display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 },
  pct: { fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" },
  chunkLbl: { fontSize: "0.58rem", color: "var(--text-dim)", fontStyle: "italic" },
  speed: { fontSize: "0.62rem", color: "var(--send)", fontFamily: "'Geist Mono', monospace" },
  eta: { fontSize: "0.62rem", color: "var(--text-dim)" },
  badge: { fontSize: "0.62rem", padding: "0.1rem 0.42rem", borderRadius: 4, fontWeight: 600 },
  badgeDone: { background: "#f0f7f3", color: "var(--green)" },
  badgeErr: { background: "#fef2f2", color: "var(--rose)" },
  badgePaused: { background: "#fef7ed", color: "var(--amber)" },
  badgeCancelled: { background: "var(--bg)", color: "var(--text-dim)" },
  badgeRetry: { background: "#edf6fa", color: "#0d6b8c" },
  actions: { display: "flex", gap: "0.25rem" },
  btnGreen: { color: "var(--green)" },
  btnRed: { color: "var(--rose)" },
};