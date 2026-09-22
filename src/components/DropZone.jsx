import { useState, useRef, useEffect } from "react";

async function entryToFiles(entry, path = "") {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    const prefixed = path ? `${path}/${file.name}` : file.name;
    try {
      return [new File([file], prefixed, { type: file.type, lastModified: file.lastModified })];
    } catch {
      return [file];
    }
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const allEntries = [];
    const readAll = async () => {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (batch.length === 0) return;
      allEntries.push(...batch);
      await readAll();
    };
    await readAll();
    const out = [];
    for (const e of allEntries) {
      const sub = await entryToFiles(e, path ? `${path}/${entry.name}` : entry.name);
      out.push(...sub);
    }
    return out;
  }
  return [];
}

async function dataTransferToFiles(dt) {
  const items = dt.items ? Array.from(dt.items) : [];
  const entries = items.map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length === 0) return Array.from(dt.files || []);
  const out = [];
  for (const en of entries) {
    try {
      const files = await entryToFiles(en);
      out.push(...files);
    } catch { /* ignore entry */ }
  }
  if (out.length === 0) return Array.from(dt.files || []);
  return out;
}

export default function DropZone({ connected, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const folderRef = useRef(null);

  useEffect(() => {
    const onPaste = (e) => {
      if (!connected) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length > 0) {
        e.preventDefault();
        files.forEach(onFiles);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [connected, onFiles]);

  const handleDrop = async (e) => {
    e.preventDefault(); setDragging(false);
    if (!connected) return;
    try {
      const files = await dataTransferToFiles(e.dataTransfer);
      files.forEach(onFiles);
    } catch {
      Array.from(e.dataTransfer.files || []).forEach(onFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (connected) setDragging(true);
  };

  const handleDragLeave = (e) => {
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
      <div style={{ ...s.iconWrap, ...(dragging ? s.iconDrag : {}) }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 16l-4-4-4 4M12 12v9" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
      </div>

      {connected ? (
        <>
          <div style={s.text}>
            <strong>{dragging ? "Drop to send" : "Drop files or folders here"}</strong>
            <span style={{ color: "var(--text-muted)" }}> or </span>
            <span style={s.browse}>browse</span>
          </div>
          <div style={s.btnRow} onClick={(e) => e.stopPropagation()}>
            <button style={s.miniBtn} onClick={() => inputRef.current?.click()}>Files</button>
            <button style={s.miniBtn} onClick={() => folderRef.current?.click()}>Folder</button>
          </div>
          <div style={s.sub}>Folders are flattened with paths · Paste with Ctrl+V works too · Encrypted</div>
        </>
      ) : (
        <>
          <div style={s.text}><strong style={{ color: "var(--text-dim)" }}>Waiting for peer…</strong></div>
          <div style={s.sub}>Sharing unlocks once connected</div>
        </>
      )}

      <input ref={inputRef} type="file" multiple style={{ display: "none" }}
        onChange={(e) => { Array.from(e.target.files || []).forEach(onFiles); e.target.value = ""; }} />
      <input ref={folderRef} type="file" style={{ display: "none" }} webkitdirectory=""
        onChange={(e) => { Array.from(e.target.files || []).forEach(onFiles); e.target.value = ""; }} />
    </div>
  );
}

const s = {
  zone: {
    borderRadius: 18, padding: "1.6rem 1.4rem",
    textAlign: "center", cursor: "pointer",
    transition: "all 0.18s ease", flexShrink: 0,
    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.55rem",
    border: "1.5px dashed var(--border-hover)",
    background: "var(--surface)",
  },
  zoneDrag: {
    background: "var(--send-light)",
    borderColor: "var(--primary)",
    borderStyle: "dashed",
    boxShadow: "var(--shadow-brand)",
    transform: "scale(1.01)",
  },
  zoneOff: { opacity: 0.6, cursor: "not-allowed", borderStyle: "solid", pointerEvents: "none", background: "var(--surface-hover)" },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18,
    background: "var(--brand-gradient)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "var(--shadow-brand)",
  },
  iconDrag: { transform: "scale(1.08)" },
  text: { fontSize: "0.86rem" },
  browse: { color: "var(--primary)", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 3 },
  btnRow: { display: "flex", gap: "0.4rem" },
  miniBtn: {
    background: "var(--surface-hover)", border: "1px solid var(--border)",
    borderRadius: 999, padding: "0.3rem 0.8rem", fontSize: "0.72rem", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", color: "var(--text-2)",
  },
  sub: { fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500, lineHeight: 1.5 },
};
