export default function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="empty-hint" style={{ padding: "2.2rem 1rem" }}>
      <div className="empty-illust" aria-hidden="true">{icon}</div>
      <div style={{ fontWeight: 800, color: "var(--text-2)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>{title}</div>
      {sub && <div style={{ fontSize: "0.76rem", lineHeight: 1.6 }}>{sub}</div>}
      {action}
    </div>
  );
}
