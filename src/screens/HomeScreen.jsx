import EssenceField from "../components/EssenceField";

export default function HomeScreen({ onHost, onJoin, onLogoClick, peerError, libsReady }) {
  return (
    <div style={s.page}>
      <EssenceField />
      <div style={s.hero}>
        <div className="hero-badge">
          <span className="dot-live" />
          Private · Peer-to-peer · No signup
        </div>

        <div style={s.logoWrap} onClick={onLogoClick}>
          <span className="brand-tile" style={{ width: 60, height: 60, borderRadius: 18 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
        </div>

        <div style={{ textAlign: "center" }}>
          <h1 style={s.title}>Share files in seconds</h1>
          <p style={s.sub}>Create a room, share the code, drop files.<br />Direct encrypted transfer — nothing stored online.</p>
        </div>

        <div style={s.grid} className="home-grid">
          <button className="action-card primary-card" onClick={onHost}>
            <span className="card-content">
              <span className="card-icon-wrap"><SendIcon /></span>
              <span className="card-label">Send files</span>
              <span className="card-desc">Create a room and invite someone with code or QR</span>
              <span className="card-arrow">Create room →</span>
            </span>
          </button>
          <button className="action-card" onClick={onJoin}>
            <span className="card-content">
              <span className="card-icon-wrap"><ReceiveIcon /></span>
              <span className="card-label">Receive files</span>
              <span className="card-desc">Have a code? Join a room and download instantly</span>
              <span className="card-arrow">Join room →</span>
            </span>
          </button>
        </div>

        <div style={s.steps} className="home-steps">
          {STEPS.map((st, i) => (
            <div key={st.t} style={s.step}>
              <span style={s.stepNum}>{i + 1}</span>
              <div>
                <div style={s.stepT}>{st.t}</div>
                <div style={s.stepD}>{st.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.pills}>
          {FEATURES.map((f) => (
            <span key={f} style={s.pill}>{f}</span>
          ))}
        </div>

        {!libsReady && (
          <div style={s.loading}>
            <span className="dot-pulse" style={{ marginRight: 8 }} />
            Preparing secure connection…
          </div>
        )}
        {peerError && <div className="err" style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>{peerError}</div>}
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

const STEPS = [
  { t: "Create", d: "One click, no account" },
  { t: "Share", d: "Code, link or QR" },
  { t: "Transfer", d: "Drag, chat & done" },
];

const FEATURES = [
  "End-to-end encrypted", "Any file type", "Live chat",
  "QR pairing", "Pause & resume", "History",
];

const s = {
  page: {
    minHeight: "calc(100dvh - 60px)", display: "flex",
    alignItems: "center", justifyContent: "center", padding: "2rem 1rem",
  },
  hero: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1.25rem", maxWidth: 560, width: "100%",
    animation: "card-enter 0.4s ease-out both",
  },
  logoWrap: { cursor: "pointer", marginTop: "0.25rem" },
  title: {
    fontSize: "clamp(2.1rem,6vw,3.1rem)", fontWeight: 800,
    letterSpacing: "-0.04em", lineHeight: 1.05,
    color: "var(--text)",
  },
  sub: { fontSize: "0.92rem", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "0.6rem" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", width: "100%" },
  steps: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem", width: "100%",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 18, padding: "0.9rem 1rem", boxShadow: "var(--shadow)",
  },
  step: { display: "flex", gap: "0.6rem", alignItems: "flex-start" },
  stepNum: {
    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
    background: "var(--brand-gradient-soft)", border: "1px solid var(--send-border)",
    color: "var(--primary)", fontSize: "0.75rem", fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  stepT: { fontSize: "0.8rem", fontWeight: 800 },
  stepD: { fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.4 },
  pills: { display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center" },
  pill: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 999, padding: "0.28rem 0.75rem",
    fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)",
    boxShadow: "var(--shadow)",
  },
  loading: { fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", alignItems: "center", fontWeight: 600 },
};
