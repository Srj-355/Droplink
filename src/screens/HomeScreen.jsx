import { useRef } from "react";
import EssenceField from "../components/EssenceField";

export default function HomeScreen({ onHost, onJoin, onLogoClick, peerError, libsReady }) {
  return (
    <div style={s.page}>
      <EssenceField />
      <div style={s.hero}>
        <div style={s.logoWrap} onClick={onLogoClick}>
          <div style={s.logoRing} />
          <div style={s.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>

        <h1 style={s.title}>droplink</h1>
        <p style={s.sub}>Peer-to-peer file sharing</p>

        <div style={s.grid}>
          <ActionCard
            icon={<SendIcon />} label="Send files"
            desc="Share a room code for others to connect"
            onClick={onHost}
          />
          <ActionCard
            icon={<ReceiveIcon />} label="Receive files"
            desc="Enter a code to connect and download"
            onClick={onJoin}
          />
        </div>

        <div style={s.pills}>
          {FEATURES.map((f) => (
            <span key={f} style={s.pill}>{f}</span>
          ))}
        </div>

        {!libsReady && (
          <div style={s.loading}>
            <span className="dot-pulse" style={{ marginRight: 8 }} />
            Loading libraries…
          </div>
        )}
        {peerError && <div className="err" style={{ maxWidth: 400 }}>{peerError}</div>}
      </div>
    </div>
  );
}

function ActionCard({ icon, label, desc, onClick }) {
  const clickedRef = useRef(false);

  const handleClick = (e) => {
    if (clickedRef.current) return;
    clickedRef.current = true;
    onClick(e);
    setTimeout(() => {
      clickedRef.current = false;
    }, 3000);
  };

  return (
    <div className="action-card" onClick={handleClick}>
      <div className="card-content">
        <div className="card-icon-wrap">{icon}</div>
        <div className="card-label">{label}</div>
        <div className="card-desc">{desc}</div>
        <div className="card-arrow">→</div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4V20M12 4L7 9M12 4L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20V4M12 20L7 15M12 20L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


const FEATURES = [
  "Any file type", "Live chat",
  "QR pairing", "No limits",
  "Adaptive chunks", "History",
  "Pause & cancel", "File queue",
];

const s = {
  page: {
    minHeight: "calc(100vh - 3.5rem)", display: "flex",
    alignItems: "center", justifyContent: "center", padding: "1rem",
  },
  hero: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1.8rem", maxWidth: 480, width: "100%",
    animation: "card-enter 0.4s ease-out both",
  },
  logoWrap: { position: "relative", width: 48, height: 48, cursor: "pointer" },
  logoRing: {
    position: "absolute", inset: 0, borderRadius: "50%",
    border: "2px solid var(--border)",
  },
  logoIcon: {
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--text)",
  },
  title: {
    fontSize: "clamp(2rem,6vw,3.2rem)", fontWeight: 700,
    letterSpacing: "-0.03em", lineHeight: 1,
    color: "var(--text)",
  },
  sub: { fontSize: "0.78rem", color: "var(--text-muted)" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", width: "100%" },
  pills: { display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "center" },
  pill: {
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 20, padding: "0.2rem 0.65rem",
    fontSize: "0.62rem", color: "var(--text-muted)",
  },
  loading: { fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center" },
};