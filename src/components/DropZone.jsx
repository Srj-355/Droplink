import { useState, useRef } from "react";

export default function DropZone({ connected, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    if (!connected) return;
    Array.from(e.dataTransfer.files).forEach(onFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (connected) setDragging(true);
  };

  const handleDragLeave = (e) => {
    // Only clear if leaving the zone entirely (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };

  return (
    <div
      className="glass"
      style={{
        ...s.zone,
        ...(dragging ? s.zoneDrag : {}),
        ...(connected ? {} : s.zoneOff),
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
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
            <strong>Drop files here</strong>
            <span style={{ color: "var(--text-muted)" }}> or click to browse</span>
          </div>
          <div style={s.sub}>Multiple files queued automatically · Any size</div>
        </>
      ) : (
        <>
          <div style={s.text}><strong style={{ color: "var(--text-dim)" }}>Waiting for peer…</strong></div>
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
    borderRadius: 14, padding: "1.8rem 1.5rem",
    textAlign: "center", cursor: "pointer",
    transition: "all 0.2s ease", flexShrink: 0,
    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
  },
  zoneDrag: {
    background: "var(--bg)",
    borderColor: "var(--border-hover)",
    borderStyle: "dashed",
    boxShadow: "var(--shadow-lg)",
  },
  zoneOff: { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" },
  iconWrap: { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  iconRing: { display: "none" },
  text: { fontSize: "0.82rem" },
  sub: { fontSize: "0.68rem", color: "var(--text-dim)" },
};