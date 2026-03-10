import { useState, useRef } from "react";

export default function DropZone({ connected, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    if (!connected) return;
    Array.from(e.dataTransfer.files).forEach(onFiles);
  };

  return (
    <div
      className="glass"
      style={{
        ...s.zone,
        ...(dragging   ? s.zoneDrag : {}),
        ...(connected  ? {}         : s.zoneOff),
      }}
      onDragOver={(e) => { e.preventDefault(); if (connected) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => connected && inputRef.current?.click()}
    >
      <div style={s.iconWrap}>
        <span style={{ fontSize: "2rem" }}>{dragging ? "📂" : "📁"}</span>
        {dragging && <div style={s.iconRing} />}
      </div>

      {connected ? (
        <>
          <div style={s.text}>
            <strong style={{ color: "#0f172a" }}>Drop files here</strong>
            <span style={{ color: "#64748b" }}> or click to browse</span>
          </div>
          <div style={s.sub}>Multiple files queued automatically · Any size</div>
        </>
      ) : (
        <>
          <div style={s.text}><strong style={{ color: "#94a3b8" }}>Waiting for peer…</strong></div>
          <div style={s.sub}>Files available once connected</div>
        </>
      )}

      <input ref={inputRef} type="file" multiple style={{ display: "none" }}
        onChange={(e) => { Array.from(e.target.files || []).forEach(onFiles); e.target.value = ""; }} />
    </div>
  );
}

const s = {
  zone: {
    borderRadius: 16, padding: "1.8rem 1.5rem",
    textAlign: "center", cursor: "pointer",
    transition: "all 0.2s ease", flexShrink: 0,
    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
  },
  zoneDrag: {
    background: "rgba(14,165,233,0.1)",
    borderColor: "rgba(14,165,233,0.5)",
    boxShadow: "0 0 0 3px rgba(14,165,233,0.15), 0 8px 32px rgba(14,165,233,0.15)",
    transform: "scale(1.01)",
  },
  zoneOff: { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" },
  iconWrap: { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  iconRing: {
    position: "absolute", inset: -8, borderRadius: "50%",
    border: "2px solid rgba(14,165,233,0.4)",
    animation: "pulse-dot 1s ease-in-out infinite",
  },
  text: { fontSize: "0.82rem" },
  sub: { fontSize: "0.68rem", color: "#94a3b8" },
};