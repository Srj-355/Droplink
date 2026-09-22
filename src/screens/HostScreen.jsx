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
    if (!shareUrl) return;
    let retries = 0;
    const MAX_RETRIES = 20;
    const render = () => {
      if (!canvasRef.current) {
        if (++retries > MAX_RETRIES) { console.warn("QR canvas not available after max retries"); return; }
        requestAnimationFrame(render);
        return;
      }
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 168,
        margin: 1,
        color: { dark: "#050505", light: "#ffffff" },
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
      <div className="glass setup-card" style={{ maxWidth: 460 }}>
        <div className="setup-head">
          <Branding onGoHome={onLeave} compact />
          <button className="back-btn back-btn-danger" onClick={onLeave}>← Cancel</button>
        </div>

        <div className="stepper">
          <span className="step-dot done"><span className="step-num">✓</span> Create</span>
          <span className="step-line done" />
          <span className="step-dot active"><span className="step-num">2</span> Share</span>
          <span className="step-line" />
          <span className="step-dot"><span className="step-num">3</span> Transfer</span>
        </div>

        <div>
          <div style={s.title}>Invite someone</div>
          <div style={s.sub}>Share this code or QR — they join instantly, no account needed.</div>
        </div>

        {/* Room code */}
        <div style={s.codeBox}>
          <div>
            <div style={s.codeLabel}>Room Code</div>
            <div style={s.codeVal}>{roomCode}</div>
          </div>
          <button className="btn btn-primary" style={{ padding: "0.55rem 1rem", fontSize: "0.78rem" }} onClick={() => copy(roomCode, setCc)} title="Copy code">
            {cc ? "✓ Copied" : "Copy"}
          </button>
        </div>

        {/* QR */}
        <div style={s.qrWrap}>
          <div style={{ ...s.qrBox, opacity: qrReady ? 1 : 0, transition: "opacity 0.3s" }}>
            <canvas ref={canvasRef} />
          </div>
          {!qrReady && (
            <div style={s.qrPlaceholder}>
              <span className="dot-pulse" />
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Generating QR…</span>
            </div>
          )}
          <span style={s.qrLabel}>Scan with phone camera to join instantly</span>
        </div>

        {/* Share URL */}
        <div style={s.urlRow} onClick={() => copy(shareUrl, setUc)}>
          <span style={s.urlText}>{shareUrl}</span>
          <span style={s.urlAction}>{uc ? "✓ Copied" : "Copy link"}</span>
        </div>

        {/* Waiting */}
        <div style={s.waitRow}>
          <span className="dot-pulse" />
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>Waiting for peer to join…</span>
        </div>

        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}

const s = {
  title: { fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em" },
  sub: { fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55, marginTop: "0.25rem" },
  codeBox: {
    borderRadius: 16, padding: "1rem 1.1rem",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
    background: "var(--brand-gradient-soft)", border: "1px solid var(--send-border)",
  },
  codeLabel: { fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 700 },
  codeVal: {
    fontFamily: "'Geist Mono', monospace", fontSize: "2rem", fontWeight: 700,
    letterSpacing: "0.2em", color: "var(--primary)",
  },
  qrWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.55rem", position: "relative" },
  qrBox: {
    background: "#fff", borderRadius: 18, padding: 14,
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-lg)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  qrPlaceholder: {
    position: "absolute", top: 40,
    display: "flex", alignItems: "center", gap: "0.5rem",
  },
  qrLabel: { fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 },
  urlRow: {
    borderRadius: 12, padding: "0.7rem 0.9rem",
    display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer",
    overflow: "hidden", background: "var(--surface-hover)", border: "1px solid var(--border)",
  },
  urlText: { flex: 1, fontSize: "0.72rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, fontFamily: "'Geist Mono', monospace" },
  urlAction: { fontSize: "0.75rem", color: "#fff", background: "var(--text)", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700, padding: "0.35rem 0.75rem", borderRadius: 999 },
  waitRow: { display: "flex", alignItems: "center", gap: "0.6rem", background: "var(--surface-hover)", borderRadius: 12, padding: "0.65rem 0.9rem" },
};
