import { formatBytes, formatSpeed, formatETA } from "../constants";

export default function TransferItem({ transfer: t }) {
  const isOut  = t.direction === "out";
  const isDone = t.status === "done";
  const isErr  = t.status === "error";

  const barClass =
    isDone ? "done" :
    isErr  ? "error" :
    isOut  ? "sending" : "receiving";

  return (
    <div style={s.item}>
      {/* Top row: direction badge + name + size */}
      <div style={s.top}>
        <span style={{ ...s.dir, ...(isOut ? s.dirOut : s.dirIn) }}>
          {isOut ? "↑ SEND" : "↓ RECV"}
        </span>
        <span style={s.name} title={t.name}>{t.name}</span>
        <span style={s.size}>{formatBytes(t.size)}</span>
      </div>

      {/* Progress bar */}
      <div style={s.barBg}>
        <div style={{ ...s.barFill, width: `${t.progress}%`, ...barColors[barClass] }} />
      </div>

      {/* Bottom row: status + chunk info + speed + ETA */}
      <div style={s.foot}>
        <div style={s.footLeft}>
          {isDone && <span style={s.done}>✓ Complete</span>}
          {isErr  && <span style={s.err}>✗ Failed</span>}
          {!isDone && !isErr && (
            <span style={s.pct}>{t.progress}%</span>
          )}
          {t.chunkSize && !isDone && !isErr && (
            <span style={s.chunk}>
              {t.chunkSize >= 1024 * 1024
                ? `${t.chunkSize / (1024 * 1024)}MB`
                : `${t.chunkSize / 1024}KB`} chunks
            </span>
          )}
          {t.streamMode && t.direction === "in" && (
            <span style={s.streamBadge}>💾 stream</span>
          )}
        </div>

        {/* Speed and ETA — only while transferring */}
        {!isDone && !isErr && (
          <div style={s.footRight}>
            {t.speed > 0 && (
              <span style={s.speed}>{formatSpeed(t.speed)}</span>
            )}
            {t.eta != null && t.eta > 0 && (
              <span style={s.eta}>ETA {formatETA(t.eta)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const barColors = {
  sending:   { background: "linear-gradient(90deg, #3b82f6, #06b6d4)" },
  receiving: { background: "linear-gradient(90deg, #10b981, #06b6d4)" },
  done:      { background: "#10b981" },
  error:     { background: "#f87171" },
};

const s = {
  item: {
    background: "#0c1220", border: "1px solid #1a2540",
    borderRadius: 8, padding: "0.65rem 0.85rem",
  },
  top: {
    display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem",
  },
  dir: {
    fontSize: "0.6rem", padding: "0.12rem 0.38rem",
    borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0,
  },
  dirOut: { background: "rgba(59,130,246,0.15)", color: "#3b82f6" },
  dirIn:  { background: "rgba(16,185,129,0.15)", color: "#10b981" },
  name: {
    fontSize: "0.75rem", color: "#e2e8f0",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
  },
  size: { fontSize: "0.66rem", color: "#6b7fa3", whiteSpace: "nowrap", flexShrink: 0 },
  barBg: { height: 3, background: "#111827", borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, transition: "width 0.25s ease" },
  foot: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginTop: "0.3rem", gap: "0.5rem",
  },
  footLeft: { display: "flex", alignItems: "center", gap: "0.5rem" },
  footRight: { display: "flex", alignItems: "center", gap: "0.5rem" },
  pct:   { fontSize: "0.62rem", color: "#6b7fa3" },
  chunk:       { fontSize: "0.58rem", color: "#2d3f5c", fontStyle: "italic" },
  done:        { fontSize: "0.62rem", color: "#10b981" },
  err:         { fontSize: "0.62rem", color: "#f87171" },
  speed:       { fontSize: "0.62rem", color: "#06b6d4" },
  eta:         { fontSize: "0.62rem", color: "#6b7fa3" },
  streamBadge: { fontSize: "0.58rem", color: "#818cf8", background: "rgba(129,140,248,0.1)", padding: "0.1rem 0.35rem", borderRadius: 4 },
};