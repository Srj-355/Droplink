export default function HomeScreen({ onHost, onJoin, peerError, libsReady }) {
  return (
    <div style={styles.home}>
      {/* Brand */}
      <div style={styles.brand}>
        <div style={styles.brandIcon}>⚡</div>
        <div style={styles.brandName}>DROPLINK</div>
        <div style={styles.brandTag}>Peer-to-peer · Zero servers · Instant</div>
      </div>

      {/* Action cards */}
      <div style={styles.grid}>
        <ActionCard
          icon="📡"
          label="Host Room"
          desc="Create a room and share the code or QR with your peer"
          onClick={onHost}
          accent="#3b82f6"
        />
        <ActionCard
          icon="🔗"
          label="Join Room"
          desc="Enter a room code or scan a QR to connect instantly"
          onClick={onJoin}
          accent="#818cf8"
        />
      </div>

      {/* Feature pills */}
      <div style={styles.pills}>
        {FEATURES.map((f) => (
          <span key={f} style={styles.pill}>{f}</span>
        ))}
      </div>

      {!libsReady && (
        <div style={styles.loading}>
          <span className="dot-pulse" style={{ marginRight: 8 }} />
          Loading libraries…
        </div>
      )}

      {peerError && <div className="err" style={{ maxWidth: 400 }}>{peerError}</div>}
    </div>
  );
}

function ActionCard({ icon, label, desc, onClick, accent }) {
  return (
    <div
      style={styles.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = `0 8px 32px ${accent}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#1a2540";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={styles.cardIcon}>{icon}</div>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardDesc}>{desc}</div>
    </div>
  );
}

const FEATURES = [
  "🔒 E2E Encrypted", "📁 Any File Type", "💬 Live Chat",
  "📱 QR Pairing", "⚡ WebRTC P2P", "🚫 No Upload Limit",
  "📊 Adaptive Chunking",
];

const styles = {
  home: {
    minHeight: "100vh",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "2rem", gap: "2.5rem",
  },
  brand: { textAlign: "center" },
  brandIcon: {
    width: 80, height: 80,
    background: "linear-gradient(135deg, #3b82f6 0%, #818cf8 100%)",
    borderRadius: 22,
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 1.5rem",
    boxShadow: "0 0 60px rgba(59,130,246,0.25), 0 0 20px rgba(59,130,246,0.15)",
    fontSize: "2.2rem",
  },
  brandName: {
    fontFamily: "'Syne', sans-serif",
    fontSize: "clamp(2.2rem, 6vw, 4rem)",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    background: "linear-gradient(130deg, #e2e8f0 30%, #3b82f6 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    lineHeight: 1,
  },
  brandTag: {
    color: "#6b7fa3", fontSize: "0.78rem",
    letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "0.6rem",
  },
  grid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "0.85rem", width: "100%", maxWidth: 460,
  },
  card: {
    background: "#0c1220", border: "1px solid #1a2540",
    borderRadius: 12, padding: "1.5rem",
    cursor: "pointer", transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
    userSelect: "none",
  },
  cardIcon: { fontSize: "2rem", marginBottom: "0.7rem" },
  cardLabel: {
    fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0",
  },
  cardDesc: { fontSize: "0.72rem", color: "#6b7fa3", marginTop: "0.2rem", lineHeight: 1.6 },
  pills: {
    display: "flex", flexWrap: "wrap", gap: "0.35rem",
    justifyContent: "center", maxWidth: 460,
  },
  pill: {
    background: "#0c1220", border: "1px solid #1a2540",
    borderRadius: 20, padding: "0.22rem 0.65rem",
    fontSize: "0.65rem", color: "#6b7fa3",
  },
  loading: { fontSize: "0.7rem", color: "#6b7fa3", display: "flex", alignItems: "center" },
};