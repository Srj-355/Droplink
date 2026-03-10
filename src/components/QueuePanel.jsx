// import { formatBytes } from "../constants";

// export default function QueuePanel({ queue, onRemove }) {
//   const pending = queue.filter((q) => q.status === "queued");
//   if (pending.length === 0) return null;

//   return (
//     <div style={s.wrap} className="glass-sm">
//       <div style={s.head}>
//         <span style={s.title}>📦 Queue <span style={s.badge}>{pending.length}</span></span>
//         <span style={s.hint}>Files waiting to send</span>
//       </div>
//       <div style={s.list}>
//         {pending.map((q) => (
//           <div key={q.id} style={s.item}>
//             <span style={s.icon}>📄</span>
//             <span style={s.name} title={q.name}>{q.name}</span>
//             <span style={s.size}>{formatBytes(q.size)}</span>
//             <button
//               style={s.removeBtn}
//               onClick={() => onRemove?.(q.id)}
//               title="Remove from queue"
//             >×</button>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// const s = {
//   wrap: { borderRadius: 12, padding: "0.7rem 0.85rem", flexShrink: 0 },
//   head: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.55rem" },
//   title: { fontSize: "0.74rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.35rem" },
//   badge: {
//     background: "rgba(14,165,233,0.15)", color: "#0ea5e9",
//     fontSize: "0.6rem", fontWeight: 700, padding: "0.05rem 0.4rem", borderRadius: 20,
//   },
//   hint: { fontSize: "0.62rem", color: "#94a3b8", marginLeft: "auto" },
//   list: { display: "flex", flexDirection: "column", gap: "0.3rem" },
//   item: {
//     display: "flex", alignItems: "center", gap: "0.4rem",
//     padding: "0.32rem 0.5rem",
//     background: "rgba(255,255,255,0.45)", borderRadius: 8,
//     border: "1px solid rgba(255,255,255,0.6)",
//   },
//   icon: { fontSize: "0.85rem", flexShrink: 0 },
//   name: { fontSize: "0.72rem", color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
//   size: { fontSize: "0.62rem", color: "#94a3b8", flexShrink: 0 },
//   removeBtn: {
//     background: "none", border: "none", color: "#cbd5e1",
//     fontSize: "0.85rem", cursor: "pointer", flexShrink: 0,
//     transition: "color 0.12s", lineHeight: 1, padding: "0 2px",
//   },
// };

import { formatBytes } from "../constants";

export default function QueuePanel({ queue, onRemove }) {
  const pending = queue.filter((q) => q.status === "queued");
  if (pending.length === 0) return null;

  return (
    <div style={s.wrap} className="glass-sm">
      <div style={s.head}>
        <span style={s.title}>📦 Queue <span style={s.badge}>{pending.length}</span></span>
        <span style={s.hint}>Files waiting to send</span>
      </div>
      <div style={s.list}>
        {pending.map((q) => (
          <div key={q.id} style={s.item}>
            <span style={s.icon}>📄</span>
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
  wrap: { borderRadius: 12, padding: "0.7rem 0.85rem", flexShrink: 0 },
  head: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.55rem" },
  title: { fontSize: "0.74rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.35rem" },
  badge: {
    background: "rgba(14,165,233,0.15)", color: "#0ea5e9",
    fontSize: "0.6rem", fontWeight: 700, padding: "0.05rem 0.4rem", borderRadius: 20,
  },
  hint: { fontSize: "0.62rem", color: "#94a3b8", marginLeft: "auto" },
  list: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  item: {
    display: "flex", alignItems: "center", gap: "0.4rem",
    padding: "0.32rem 0.5rem",
    background: "rgba(255,255,255,0.45)", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.6)",
    overflow: "hidden", minWidth: 0,
  },
  icon: { fontSize: "0.85rem", flexShrink: 0 },
  name: { fontSize: "0.72rem", color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  size: { fontSize: "0.62rem", color: "#94a3b8", flexShrink: 0 },
  removeBtn: {
    background: "none", border: "none", color: "#cbd5e1",
    fontSize: "0.85rem", cursor: "pointer", flexShrink: 0,
    transition: "color 0.12s", lineHeight: 1, padding: "0 2px",
  },
};