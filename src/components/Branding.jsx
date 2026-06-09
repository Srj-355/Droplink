export default function Branding({ onGoHome, style }) {
  return (
    <div
      className="room-logo"
      onClick={onGoHome}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        userSelect: "none",
        ...style,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>droplink</span>
    </div>
  );
}
