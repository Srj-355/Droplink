import { useState, useRef } from "react";

export default function DropZone({ connected, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!connected) return;
    Array.from(e.dataTransfer.files).forEach(onFiles);
  };

  return (
    <div
      style={{
        ...s.zone,
        ...(dragging ? s.zoneDrag : {}),
        ...(connected ? {} : s.zoneOff),
      }}
      onDragOver={(e) => { e.preventDefault(); if (connected) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => connected && inputRef.current?.click()}
    >
      <div style={s.icon}>{dragging ? "📂" : "📁"}</div>
      <div style={s.text}>
        {connected ? (
          <>
            <strong style={{ color: "#e2e8f0" }}>Drop files here</strong> or click to browse
            <br />
            <span style={{ fontSize: "0.7rem", color: "#6b7fa3" }}>
              Chunk size adapts automatically to file size
            </span>
          </>
        ) : (
          <>
            <strong style={{ color: "#e2e8f0" }}>Waiting for peer…</strong>
            <br />Files available once connected
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          Array.from(e.target.files || []).forEach(onFiles);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const s = {
  zone: {
    border: "2px dashed #1a2540",
    borderRadius: 12,
    padding: "2rem 1.25rem",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    flexShrink: 0,
  },
  zoneDrag: {
    borderColor: "#3b82f6",
    background: "rgba(59,130,246,0.04)",
  },
  zoneOff: {
    opacity: 0.4, cursor: "not-allowed", pointerEvents: "none",
  },
  icon: { fontSize: "1.8rem", marginBottom: "0.4rem" },
  text: { fontSize: "0.78rem", color: "#6b7fa3", lineHeight: 1.7 },
};