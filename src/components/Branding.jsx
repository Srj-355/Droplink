export default function Branding({ onGoHome, style, compact = false }) {
  return (
    <div
      className="room-logo"
      onClick={onGoHome}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        userSelect: "none",
        ...style,
      }}
    >
      <span className="brand-tile" style={compact ? { width: 32, height: 32, borderRadius: 10 } : {}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </span>
      <span style={{ fontWeight: 800, fontSize: compact ? "0.95rem" : "1rem", letterSpacing: "-0.02em" }}>droplink</span>
    </div>
  );
}
