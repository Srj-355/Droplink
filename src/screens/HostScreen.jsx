import { useEffect, useRef, useState } from "react";

export default function HostScreen({ roomCode, shareUrl, peerError, onLeave }) {
  const qrRef       = useRef(null);
  const qrDone      = useRef(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied,  setUrlCopied]  = useState(false);

  // Generate QR with polling retry (lib may still be loading)
  useEffect(() => {
    if (!shareUrl || qrDone.current) return;
    const tryGen = () => {
      if (!qrRef.current) return;
      if (!window.QRCode) { setTimeout(tryGen, 200); return; }
      qrRef.current.innerHTML = "";
      new window.QRCode(qrRef.current, {
        text: shareUrl, width: 160, height: 160,
        colorDark: "#0f172a", colorLight: "#f0f9ff",
      });
      qrDone.current = true;
    };
    tryGen();
  }, [shareUrl]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };
  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-head">
          <span className="setup-title">Your Room</span>
          <button className="back-btn" onClick={onLeave}>← back</button>
        </div>

        {/* Room code */}
        <div style={s.codeBox}>
          <span style={s.codeVal}>{roomCode}</span>
          <button className="btn-icon" onClick={copyCode} title="Copy code">
            {codeCopied ? "✓" : "⎘"}
          </button>
        </div>

        {/* QR code */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
          <div ref={qrRef} style={s.qrWrap} />
          <span style={s.qrLabel}>Scan to join</span>
        </div>

        {/* Share URL */}
        <div style={s.urlBox} onClick={copyUrl}>
          <span style={s.urlText}>{shareUrl}</span>
          <span style={s.urlAction}>{urlCopied ? "✓ Copied" : "Copy link"}</span>
        </div>

        {/* Waiting */}
        <div style={s.waitRow}>
          <span className="dot-pulse" />
          Waiting for peer to connect…
        </div>

        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}

const s = {
  codeBox: {
    background: "#111827", border: "1px solid #1a2540",
    borderRadius: 8, padding: "0.9rem 1.1rem",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
  },
  codeVal: {
    fontFamily: "'Syne', sans-serif", fontSize: "1.9rem", fontWeight: 800,
    letterSpacing: "0.25em", color: "#3b82f6",
  },
  qrWrap: {
    background: "#f0f9ff", borderRadius: 8, padding: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    minWidth: 184, minHeight: 184,
  },
  qrLabel: { fontSize: "0.66rem", color: "#6b7fa3" },
  urlBox: {
    background: "#111827", border: "1px solid #1a2540",
    borderRadius: 8, padding: "0.55rem 0.8rem",
    display: "flex", alignItems: "center", gap: "0.5rem",
    cursor: "pointer",
  },
  urlText: {
    flex: 1, fontSize: "0.68rem", color: "#6b7fa3",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  urlAction: { fontSize: "0.68rem", color: "#3b82f6", whiteSpace: "nowrap", flexShrink: 0 },
  waitRow: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    fontSize: "0.75rem", color: "#6b7fa3",
  },
};