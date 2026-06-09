import { formatBytes } from "../constants";

export default function QueuePanel({ queue, onRemove }) {
  const pending = queue.filter((q) => q.status === "queued");
  if (pending.length === 0) return null;

  return (
    <div style={s.wrap} className="glass-sm">
      <div style={s.head}>
        <span style={s.title}>Queue <span style={s.badge}>{pending.length}</span></span>
        <span style={s.hint}>Waiting to send</span>
      </div>
      <div style={s.list}>
        {pending.map((q) => (
          <div key={q.id} style={s.item}>
            <span style={s.icon}>⊡</span>
            <span style={s.name} title={q.name}>{q.name}</span>
            <span style={s.size}>{formatBytes(q.size)}</span>
            <button
              style={s.removeBtn}
              onClick={() => onRemove?.(q.id)}
              title="Remove from queue"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { borderRadius: 12, padding: "0.7rem 0.85rem", flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)" },
  head: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.55rem" },
  title: { fontSize: "0.74rem", fontWeight: 600, color: "var(--text-2)", display: "flex", alignItems: "center", gap: "0.35rem" },
  badge: {
    background: "var(--bg)", color: "var(--text-muted)",
    fontSize: "0.6rem", fontWeight: 600, padding: "0.05rem 0.4rem", borderRadius: 20,
  },
  hint: { fontSize: "0.62rem", color: "var(--text-dim)", marginLeft: "auto" },
  list: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  item: {
    display: "flex", alignItems: "center", gap: "0.4rem",
    padding: "0.32rem 0.5rem",
    background: "var(--bg)", borderRadius: 8,
    overflow: "hidden", minWidth: 0, flexShrink: 0,
  },
  icon: { fontSize: "0.75rem", flexShrink: 0, color: "var(--text-muted)" },
  name: { fontSize: "0.72rem", color: "var(--text-2)", flex: 1, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  size: { fontSize: "0.62rem", color: "var(--text-dim)", flexShrink: 0 },
  removeBtn: {
    background: "none", border: "none", color: "var(--text-dim)",
    fontSize: "0.85rem", cursor: "pointer", flexShrink: 0,
    transition: "color 0.12s", lineHeight: 1, padding: "0 2px",
  },
};