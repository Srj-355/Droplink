import { useState, useEffect, useMemo } from "react";
import { formatBytes, formatSpeed } from "../constants";
import EmptyState from "./EmptyState";

function fileType(name = "") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "heic"].includes(ext)) return "images";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "txt", "md", "xls", "xlsx", "ppt", "pptx", "csv"].includes(ext)) return "documents";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archives";
  return "other";
}

const TYPE_OPTIONS = ["all", "images", "video", "audio", "documents", "archives", "other"];
const DIR_OPTIONS = ["all", "out", "in"];

function toCSV(rows) {
  const header = ["name", "size_bytes", "direction", "status", "timestamp", "room", "duration_s", "avg_speed_bps", "compressed", "saved_bytes"];
  const esc = (v) => {
    const str = String(v ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      esc(r.name), r.size ?? "", r.direction ?? "", r.status ?? "",
      r.timestamp ? new Date(r.timestamp).toISOString() : "",
      esc(r.room ?? ""), r.duration ?? "", r.avgSpeed ?? "",
      r.compressed ? "1" : "0", r.savedBytes ?? "",
    ].join(","));
  }
  return lines.join("\n");
}

export default function HistoryPanel({
  history, loading, rooms,
  onClear, onClearRoom, onRemove,
  currentRoom,
}) {
  const [filter, setFilter] = useState(currentRoom || "all");
  const [userChanged, setUserChanged] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dirFilter, setDirFilter] = useState("all");
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    if (!userChanged && currentRoom && rooms.includes(currentRoom)) {
      setFilter(currentRoom);
    }
  }, [currentRoom, rooms, userChanged]);

  // Browser storage estimate for the meter (quota vs usage)
  useEffect(() => {
    let alive = true;
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => {
        if (alive) setQuota({ usage: e.usage || 0, quota: e.quota || 0 });
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  const handleFilterChange = (val) => {
    setFilter(val);
    setUserChanged(true);
  };

  const storageStats = useMemo(() => {
    const totalBytes = history.reduce((a, r) => a + (r.size || 0), 0);
    const savedBytes = history.reduce((a, r) => a + (r.savedBytes || 0), 0);
    return { totalBytes, savedBytes, count: history.length };
  }, [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((r) => {
      if (filter !== "all" && r.room !== filter) return false;
      if (dirFilter !== "all" && r.direction !== dirFilter) return false;
      if (typeFilter !== "all" && fileType(r.name) !== typeFilter) return false;
      if (q && !(r.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [history, filter, dirFilter, typeFilter, query]);

  const exportCSV = () => {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `droplink-history-${filter === "all" ? "all" : filter}.csv`,
    });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  if (loading) return (
    <div style={s.wrap}>
      <div style={s.head}><span>History</span></div>
      <div className="empty-hint">Loading…</div>
    </div>
  );

  const quotaPct = quota?.quota ? Math.min(100, Math.round((quota.usage / quota.quota) * 100)) : null;

  return (
    <div style={s.wrap}>

      <div style={s.head}>
        <span style={s.headTitle}>History</span>
        <div style={s.headR}>
          {filtered.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: "0.65rem" }} onClick={exportCSV} title="Download filtered history as CSV">
              ⬇ CSV
            </button>
          )}
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

      {/* Storage meter */}
      <div style={s.meter} title={`${storageStats.count} records · ${formatBytes(storageStats.totalBytes)} logged · ${formatBytes(storageStats.savedBytes)} saved by compression`}>
        <div style={s.meterTop}>
          <span style={s.meterLabel}>
            {storageStats.count}/200 records · {formatBytes(storageStats.totalBytes)} logged
          </span>
          {quotaPct != null && <span style={s.meterQuota}>{formatBytes(quota.usage)} of {formatBytes(quota.quota)} browser storage</span>}
        </div>
        <div style={s.meterBarBg}>
          <div style={{ ...s.meterBarFill, width: `${Math.min(100, Math.round((storageStats.count / 200) * 100))}%` }} />
        </div>
      </div>

      {/* Search + type/direction filters */}
      <div style={s.searchRow}>
        <input
          style={s.search}
          placeholder="Search by file name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={s.select} title="Filter by file type">
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All types" : t}</option>
          ))}
        </select>
        <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)} style={s.select} title="Filter by direction">
          <option value="all">Sent + received</option>
          <option value="out">Sent</option>
          <option value="in">Received</option>
        </select>
      </div>

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

      <div style={s.resultLine}>
        {filtered.length} of {history.length} shown
        {(query || typeFilter !== "all" || dirFilter !== "all") && (
          <button
            style={s.resetBtn}
            onClick={() => { setQuery(""); setTypeFilter("all"); setDirFilter("all"); }}
          >
            Reset
          </button>
        )}
      </div>

      <div style={s.list}>
        {filtered.length === 0 && (
          <EmptyState
            icon="🕘"
            title={history.length === 0 ? "No history yet" : "No matches"}
            sub={history.length === 0 ? "Completed transfers appear here." : "Try a different search or filter."}
          />
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
        <span style={s.rName} title={`${r.name} · ${fileType(r.name)}`}>{r.name}</span>
        <span style={s.typeTag}>{fileType(r.name)}</span>
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
        {r.compressed && (
          <span style={{ ...s.meta, color: "var(--text-muted)", fontWeight: 600 }} title="Compressed">CMP</span>
        )}
        <span style={s.metaTime}>{date} · {time}</span>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", flex: "none", gap: "0.45rem" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.3rem 0.1rem", flexShrink: 0 },
  headTitle: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)" },
  headR: { display: "flex", alignItems: "center", gap: "0.25rem" },

  meter: { background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.5rem 0.65rem", flexShrink: 0 },
  meterTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.35rem" },
  meterLabel: { fontSize: "0.64rem", fontWeight: 700, color: "var(--text-2)" },
  meterQuota: { fontSize: "0.6rem", color: "var(--text-dim)", fontFamily: "'Geist Mono', monospace" },
  meterBarBg: { height: 5, background: "var(--bg-alt)", borderRadius: 99, overflow: "hidden" },
  meterBarFill: { height: "100%", background: "linear-gradient(90deg, var(--primary), var(--primary-2))", borderRadius: 99, transition: "width 0.3s" },

  searchRow: { display: "flex", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap" },
  search: {
    flex: "1 1 200px", minWidth: 0, background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 999, padding: "0.5rem 0.9rem", fontSize: "0.76rem", outline: "none",
    fontFamily: "inherit", color: "var(--text)", transition: "border-color 0.15s, box-shadow 0.15s",
  },
  select: {
    background: "var(--surface-hover)", border: "1.5px solid var(--border)", borderRadius: 999,
    padding: "0.5rem 0.7rem", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-2)",
    fontFamily: "inherit", cursor: "pointer", flexShrink: 0, flex: "1 1 auto", minWidth: 110,
    outline: "none", transition: "border-color 0.15s",
  },

  filterRow: { display: "flex", gap: "0.3rem", flexWrap: "wrap", flexShrink: 0 },
  filterBtn: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 20, padding: "0.18rem 0.55rem",
    fontSize: "0.62rem", color: "var(--text-muted)", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "0.3rem",
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500,
    transition: "all 0.15s",
  },
  filterActive: {
    background: "var(--surface)", borderColor: "var(--border-hover)",
    color: "var(--text)", fontWeight: 600,
  },
  filterCount: {
    background: "var(--bg)", borderRadius: 10,
    padding: "0.02rem 0.35rem", fontSize: "0.58rem", color: "var(--text-dim)",
  },

  resultLine: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.64rem", color: "var(--text-dim)", padding: "0 0.15rem", flexShrink: 0 },
  resetBtn: { background: "none", border: "none", color: "var(--primary)", fontSize: "0.64rem", fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" },

  list: { flex: "none", overflow: "visible", display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: 0, paddingBottom: "0.5rem" },
  row: { borderRadius: 12, padding: "0.6rem 0.75rem", overflow: "hidden", minWidth: 0, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)" },
  rowTop: { display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.28rem", minWidth: 0, overflow: "hidden" },
  dir: { fontSize: "0.58rem", fontWeight: 700, fontFamily: "'Geist Mono', monospace", flexShrink: 0 },
  dirOut: { color: "var(--send)" },
  dirIn: { color: "var(--receive)" },
  rName: { fontSize: "0.74rem", color: "var(--text)", fontWeight: 500, flex: 1, minWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  typeTag: { fontSize: "0.56rem", fontWeight: 700, background: "var(--surface-hover)", color: "var(--text-muted)", borderRadius: 999, padding: "0.08rem 0.45rem", flexShrink: 0 },
  roomTag: {
    fontSize: "0.56rem", fontFamily: "'Geist Mono', monospace",
    background: "var(--bg)", color: "var(--text-muted)",
    border: "1px solid var(--border)",
    borderRadius: 4, padding: "0.08rem 0.35rem", flexShrink: 0,
  },
  status: { fontSize: "0.68rem", fontWeight: 700, flexShrink: 0 },
  stDone: { color: "var(--green)" },
  stErr: { color: "var(--rose)" },
  removeBtn: { background: "none", border: "none", color: "var(--rose)", fontSize: "0.85rem", cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 },
  rowFoot: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  meta: { fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" },
  metaTime: { fontSize: "0.6rem", color: "var(--text-dim)", marginLeft: "auto" },
};
