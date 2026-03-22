import { useState, useEffect } from "react";
import { formatBytes, formatSpeed } from "../constants";

export default function HistoryPanel({
  history, loading, rooms,
  onClear, onClearRoom, onRemove,
  currentRoom,   // room code of current session — pre-selects the filter
}) {
  // Default to current room if it exists in history, else "all"
  const [filter, setFilter] = useState(currentRoom || "all");
  const [userChanged, setUserChanged] = useState(false);

  // If currentRoom changes (new session) update filter via useEffect — never during render
  useEffect(() => {
    if (!userChanged && currentRoom && rooms.includes(currentRoom)) {
      setFilter(currentRoom);
    }
  }, [currentRoom, rooms, userChanged]);

  const handleFilterChange = (val) => {
    setFilter(val);
    setUserChanged(true);
  };

  const filtered = filter === "all"
    ? history
    : history.filter((r) => r.room === filter);

  if (loading) return (
    <div style={s.wrap}>
      <div style={s.head}><span>📜 History</span></div>
      <div className="empty-hint">Loading…</div>
    </div>
  );

  return (
    <div style={s.wrap}>

      {/* ── Head ── */}
      <div style={s.head}>
        <span style={s.headTitle}>📜 History</span>
        <div style={s.headR}>
          {filtered.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.65rem" }}
              onClick={() => {
                if (filter === "all") onClear?.();
                else onClearRoom?.(filter);
              }}
            >
              {filter === "all" ? "Clear all" : `Clear #${filter}`}
            </button>
          )}
        </div>
      </div>

      {/* ── Room filter ── */}
      {rooms.length > 0 && (
        <div style={s.filterRow}>
          <button
            style={{ ...s.filterBtn, ...(filter === "all" ? s.filterActive : {}) }}
            onClick={() => handleFilterChange("all")}
          >
            All rooms
            <span style={s.filterCount}>{history.length}</span>
          </button>
          {rooms.map((r) => (
            <button
              key={r}
              style={{ ...s.filterBtn, ...(filter === r ? s.filterActive : {}) }}
              onClick={() => handleFilterChange(r)}
            >
              #{r}
              <span style={s.filterCount}>{history.filter((h) => h.room === r).length}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── List ── */}
      <div style={s.list}>
        {filtered.length === 0 && (
          <div className="empty-hint">
            {filter === "all"
              ? "No history yet — completed transfers appear here"
              : `No transfers for room #${filter}`}
          </div>
        )}
        {filtered.map((r) => (
          <HistoryRow key={r.id} record={r} onRemove={onRemove} showRoom={filter === "all"} />
        ))}
      </div>

    </div>
  );
}

function HistoryRow({ record: r, onRemove, showRoom }) {
  const isOut = r.direction === "out";
  const isDone = r.status === "done";
  const date = new Date(r.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={s.row} className="glass-sm">
      <div style={s.rowTop}>
        <span style={{ ...s.dir, ...(isOut ? s.dirOut : s.dirIn) }}>{isOut ? "↑" : "↓"}</span>
        <span style={s.rName} title={r.name}>{r.name}</span>
        {showRoom && r.room && r.room !== "unknown" && (
          <span style={s.roomTag}>#{r.room}</span>
        )}
        <span style={{ ...s.status, ...(isDone ? s.stDone : s.stErr) }}>
          {isDone ? "✓" : "✗"}
        </span>
        <button style={s.removeBtn} onClick={() => onRemove?.(r.id)} title="Remove">×</button>
      </div>
      <div style={s.rowFoot}>
        <span style={s.meta}>{formatBytes(r.size)}</span>
        {r.avgSpeed > 0 && <span style={s.meta}>{formatSpeed(r.avgSpeed)} avg</span>}
        {r.duration > 0 && <span style={s.meta}>{r.duration.toFixed(1)}s</span>}
        <span style={s.metaTime}>{date} · {time}</span>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "0.4rem" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.3rem 0.1rem", flexShrink: 0 },
  headTitle: { fontSize: "0.75rem", fontWeight: 600, color: "#334155" },
  headR: { display: "flex", alignItems: "center", gap: "0.4rem" },

  // Filter pills
  filterRow: { display: "flex", gap: "0.3rem", flexWrap: "wrap", flexShrink: 0 },
  filterBtn: {
    background: "rgba(255,255,255,0.45)",
    borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(255,255,255,0.65)",
    borderRadius: 20, padding: "0.18rem 0.55rem",
    fontSize: "0.62rem", color: "#64748b", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "0.3rem",
    fontFamily: "'Outfit', sans-serif", fontWeight: 500,
    transition: "all 0.15s",
  },
  filterActive: {
    background: "rgba(14,165,233,0.12)", borderColor: "rgba(14,165,233,0.35)",
    color: "#0ea5e9", fontWeight: 600,
  },
  filterCount: {
    background: "rgba(100,116,139,0.12)", borderRadius: 10,
    padding: "0.02rem 0.35rem", fontSize: "0.58rem", color: "#94a3b8",
  },

  list: { flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: 0, minHeight: 0, paddingBottom: "1.5rem" },
  row: { borderRadius: 10, padding: "0.6rem 0.75rem", overflow: "hidden", minWidth: 0, flexShrink: 0 },
  rowTop: { display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.28rem", minWidth: 0, overflow: "hidden" },
  dir: { fontSize: "0.58rem", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 },
  dirOut: { color: "#0ea5e9" },
  dirIn: { color: "#10b981" },
  rName: { fontSize: "0.74rem", color: "#0f172a", fontWeight: 500, flex: 1, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  roomTag: {
    fontSize: "0.56rem", fontFamily: "'JetBrains Mono', monospace",
    background: "rgba(139,92,246,0.1)", color: "#8b5cf6",
    border: "1px solid rgba(139,92,246,0.2)",
    borderRadius: 4, padding: "0.08rem 0.35rem", flexShrink: 0,
  },
  status: { fontSize: "0.68rem", fontWeight: 700, flexShrink: 0 },
  stDone: { color: "#059669" },
  stErr: { color: "#e11d48" },
  removeBtn: { background: "none", border: "none", color: "#e51515ff", fontSize: "0.85rem", cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 },
  rowFoot: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  meta: { fontSize: "0.6rem", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" },
  metaTime: { fontSize: "0.6rem", color: "#94a3b8", marginLeft: "auto" },
};