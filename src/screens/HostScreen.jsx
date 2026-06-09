
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Branding from "../components/Branding";
import EssenceField from "../components/EssenceField";

export default function HostScreen({ roomCode, shareUrl, peerError, onLeave }) {
  const canvasRef = useRef(null);
  const [cc, setCc] = useState(false);
  const [uc, setUc] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  useEffect(() => {
    // shareUrl may be empty on first render — wait until it's populated
    if (!shareUrl) return;

    let retries = 0;
    const MAX_RETRIES = 20;

    const render = () => {
      if (!canvasRef.current) {
        if (++retries > MAX_RETRIES) { console.warn("QR canvas not available after max retries"); return; }
        // Canvas not in DOM yet — retry on next frame
        requestAnimationFrame(render);
        return;
      }
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 160,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then(() => setQrReady(true))
        .catch((err) => console.warn("QR render failed:", err));
    };

    render();
  }, [shareUrl]);

  const copy = (text, set) =>
    navigator.clipboard.writeText(text)
      .then(() => { set(true); setTimeout(() => set(false), 2000); })
      .catch(() => { });

  return (
    <div className="setup">
      <EssenceField />
      <div className="glass setup-card">
        <div className="setup-head">
          <Branding onGoHome={onLeave} />
          <button className="back-btn back-btn-danger" onClick={onLeave}>← Leave</button>
        </div>

        {/* Room code */}
        <div style={s.codeBox} className="glass-sm">
          <div>
            <div style={s.codeLabel}>Room Code</div>
            <div style={s.codeVal}>{roomCode}</div>
          </div>
          <button className="btn-icon" onClick={() => copy(roomCode, setCc)} title="Copy code">
            {cc ? "✓" : "⎘"}
          </button>
        </div>

        {/* QR */}
        <div style={s.qrWrap}>
          {/* Canvas always in DOM so ref is never null */}
          <div style={{ ...s.qrBox, opacity: qrReady ? 1 : 0, transition: "opacity 0.3s" }}>
            <canvas ref={canvasRef} />
          </div>
          {/* Placeholder while QR renders */}
          {!qrReady && (
            <div style={s.qrPlaceholder}>
              <span className="dot-pulse" />
              <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>Generating QR…</span>
            </div>
          )}
          <span style={s.qrLabel}>Scan to join instantly</span>
        </div>

        {/* Share URL */}
        <div style={s.urlRow} className="glass-sm" onClick={() => copy(shareUrl, setUc)}>
          <span style={s.urlText}>{shareUrl}</span>
          <span style={s.urlAction}>{uc ? "✓" : "Copy link"}</span>
        </div>

        {/* Waiting */}
        <div style={s.waitRow}>
          <span className="dot-pulse" />
          <span style={{ color: "#64748b", fontSize: "0.78rem" }}>Waiting for peer…</span>
        </div>

        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}

const s = {
  codeBox: {
    borderRadius: 12, padding: "0.9rem 1.1rem",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
    background: "var(--bg)", border: "1px solid var(--border)",
  },
  codeLabel: { fontSize: "0.62rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 },
  codeVal: {
    fontFamily: "'Geist Mono', monospace", fontSize: "1.9rem", fontWeight: 700,
    letterSpacing: "0.22em", color: "var(--send)",
  },
  qrWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", position: "relative" },
  qrBox: {
    background: "var(--surface)", borderRadius: 14, padding: 12,
    border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  qrPlaceholder: {
    position: "absolute",
    display: "flex", alignItems: "center", gap: "0.5rem",
  },
  qrLabel: { fontSize: "0.66rem", color: "var(--text-dim)" },
  urlRow: {
    borderRadius: 10, padding: "0.6rem 0.9rem",
    display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
    overflow: "hidden", background: "var(--bg)", border: "1px solid var(--border)",
  },
  urlText: { flex: 1, fontSize: "0.68rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  urlAction: { fontSize: "0.68rem", color: "var(--send)", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 600 },
  waitRow: { display: "flex", alignItems: "center", gap: "0.6rem" },
};