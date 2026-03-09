import { formatBytes, formatSpeed } from "../constants";

export default function HistoryPanel({ history, loading, onClear, onRemove }) {
  if (loading) return (
    <div style={s.wrap}>
      <div style={s.head}><span>📜 History</span></div>
      <div className="empty-hint">Loading…</div>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <span style={s.headTitle}>📜 Transfer History</span>
        {history.length > 0 && (
          <button className="btn btn-ghost" style={{ fontSize: "0.68rem" }} onClick={onClear}>Clear all</button>
        )}
      </div>

      <div style={s.list}>
        {history.length === 0 && (
          <div className="empty-hint">No history yet — completed transfers appear here</div>
        )}
        {history.map((r) => (
          <HistoryRow key={r.id} record={r} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ record: r, onRemove }) {
  const isOut  = r.direction === "out";
  const isDone = r.status === "done";
  const date   = new Date(r.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time   = new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={s.row} className="glass-sm">
      <div style={s.rowTop}>
        <span style={{ ...s.dir, ...(isOut ? s.dirOut : s.dirIn) }}>{isOut ? "↑" : "↓"}</span>
        <span style={s.rName} title={r.name}>{r.name}</span>
        <span style={{ ...s.status, ...(isDone ? s.stDone : s.stErr) }}>
          {isDone ? "✓" : "✗"}
        </span>
        <button
          style={s.removeBtn}
          onClick={() => onRemove?.(r.id)}
          title="Remove"
        >×</button>
      </div>
      <div style={s.rowFoot}>
        <span style={s.meta}>{formatBytes(r.size)}</span>
        {r.avgSpeed > 0 && <span style={s.meta}>{formatSpeed(r.avgSpeed)} avg</span>}
        {r.duration  > 0 && <span style={s.meta}>{r.duration.toFixed(1)}s</span>}
        <span style={s.metaTime}>{date} · {time}</span>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
  head: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.5rem 0.1rem", flexShrink: 0,
  },
  headTitle: { fontSize: "0.75rem", fontWeight: 600, color: "#334155" },
  list: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" },
  row: { borderRadius: 10, padding: "0.6rem 0.75rem" },
  rowTop: { display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.28rem" },
  dir: { fontSize: "0.58rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 },
  dirOut: { color: "#0ea5e9" },
  dirIn:  { color: "#10b981" },
  rName: { fontSize: "0.74rem", color: "#0f172a", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  status: { fontSize: "0.68rem", fontWeight: 700, flexShrink: 0 },
  stDone: { color: "#059669" },
  stErr:  { color: "#e11d48" },
  removeBtn: {
    background: "none", border: "none", color: "#cbd5e1",
    fontSize: "0.85rem", cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0,
    transition: "color 0.12s",
  },
  rowFoot: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  meta: { fontSize: "0.6rem", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" },
  metaTime: { fontSize: "0.6rem", color: "#cbd5e1", marginLeft: "auto" },
};