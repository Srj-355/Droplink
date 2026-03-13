export default function Branding({ onGoHome, style }) {
  return (
    <div 
      className="room-logo" 
      onClick={onGoHome} 
      style={{ 
        cursor: "pointer", 
        display: "flex", 
        alignItems: "center", 
        gap: "0.4rem",
        userSelect: "none",
        ...style 
      }}
    >
      <span>⚡</span>
      <span style={{ fontWeight: 800 }}>DROPLINK</span>
    </div>
  );
}
