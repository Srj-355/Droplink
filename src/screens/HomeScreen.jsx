// export default function HomeScreen({ onHost, onJoin, peerError, libsReady }) {
//   return (
//     <div style={styles.home}>
//       {/* Brand */}
//       <div style={styles.brand}>
//         <div style={styles.brandIcon}>⚡</div>
//         <div style={styles.brandName}>DROPLINK</div>
//         <div style={styles.brandTag}>Peer-to-peer · Zero servers · Instant</div>
//       </div>

//       {/* Action cards */}
//       <div style={styles.grid}>
//         <ActionCard
//           icon="📡"
//           label="Host Room"
//           desc="Create a room and share the code or QR with your peer"
//           onClick={onHost}
//           accent="#3b82f6"
//         />
//         <ActionCard
//           icon="🔗"
//           label="Join Room"
//           desc="Enter a room code or scan a QR to connect instantly"
//           onClick={onJoin}
//           accent="#818cf8"
//         />
//       </div>

//       {/* Feature pills */}
//       <div style={styles.pills}>
//         {FEATURES.map((f) => (
//           <span key={f} style={styles.pill}>{f}</span>
//         ))}
//       </div>

//       {!libsReady && (
//         <div style={styles.loading}>
//           <span className="dot-pulse" style={{ marginRight: 8 }} />
//           Loading libraries…
//         </div>
//       )}

//       {peerError && <div className="err" style={{ maxWidth: 400 }}>{peerError}</div>}
//     </div>
//   );
// }

// function ActionCard({ icon, label, desc, onClick, accent }) {
//   return (
//     <div
//       style={styles.card}
//       onClick={onClick}
//       onMouseEnter={(e) => {
//         e.currentTarget.style.borderColor = accent;
//         e.currentTarget.style.transform = "translateY(-3px)";
//         e.currentTarget.style.boxShadow = `0 8px 32px ${accent}20`;
//       }}
//       onMouseLeave={(e) => {
//         e.currentTarget.style.borderColor = "#1a2540";
//         e.currentTarget.style.transform = "translateY(0)";
//         e.currentTarget.style.boxShadow = "none";
//       }}
//     >
//       <div style={styles.cardIcon}>{icon}</div>
//       <div style={styles.cardLabel}>{label}</div>
//       <div style={styles.cardDesc}>{desc}</div>
//     </div>
//   );
// }

// const FEATURES = [
//   "🔒 E2E Encrypted", "📁 Any File Type", "💬 Live Chat",
//   "📱 QR Pairing", "⚡ WebRTC P2P", "🚫 No Upload Limit",
//   "📊 Adaptive Chunking",
// ];

// const styles = {
//   home: {
//     minHeight: "100vh",
//     display: "flex", flexDirection: "column",
//     alignItems: "center", justifyContent: "center",
//     padding: "2rem", gap: "2.5rem",
//   },
//   brand: { textAlign: "center" },
//   brandIcon: {
//     width: 80, height: 80,
//     background: "linear-gradient(135deg, #3b82f6 0%, #818cf8 100%)",
//     borderRadius: 22,
//     display: "flex", alignItems: "center", justifyContent: "center",
//     margin: "0 auto 1.5rem",
//     boxShadow: "0 0 60px rgba(59,130,246,0.25), 0 0 20px rgba(59,130,246,0.15)",
//     fontSize: "2.2rem",
//   },
//   brandName: {
//     fontFamily: "'Syne', sans-serif",
//     fontSize: "clamp(2.2rem, 6vw, 4rem)",
//     fontWeight: 800,
//     letterSpacing: "-0.03em",
//     background: "linear-gradient(130deg, #e2e8f0 30%, #3b82f6 100%)",
//     WebkitBackgroundClip: "text",
//     WebkitTextFillColor: "transparent",
//     backgroundClip: "text",
//     lineHeight: 1,
//   },
//   brandTag: {
//     color: "#6b7fa3", fontSize: "0.78rem",
//     letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "0.6rem",
//   },
//   grid: {
//     display: "grid", gridTemplateColumns: "1fr 1fr",
//     gap: "0.85rem", width: "100%", maxWidth: 460,
//   },
//   card: {
//     background: "#0c1220", border: "1px solid #1a2540",
//     borderRadius: 12, padding: "1.5rem",
//     cursor: "pointer", transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
//     userSelect: "none",
//   },
//   cardIcon: { fontSize: "2rem", marginBottom: "0.7rem" },
//   cardLabel: {
//     fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0",
//   },
//   cardDesc: { fontSize: "0.72rem", color: "#6b7fa3", marginTop: "0.2rem", lineHeight: 1.6 },
//   pills: {
//     display: "flex", flexWrap: "wrap", gap: "0.35rem",
//     justifyContent: "center", maxWidth: 460,
//   },
//   pill: {
//     background: "#0c1220", border: "1px solid #1a2540",
//     borderRadius: 20, padding: "0.22rem 0.65rem",
//     fontSize: "0.65rem", color: "#6b7fa3",
//   },
//   loading: { fontSize: "0.7rem", color: "#6b7fa3", display: "flex", alignItems: "center" },
// };

export default function HomeScreen({ onHost, onJoin, peerError, libsReady }) {
  return (
    <div style={s.page}>
      <div style={s.hero}>
        {/* Logo mark */}
        <div style={s.logoWrap}>
          <div style={s.logoRing} />
          <div style={s.logoIcon}>⚡</div>
        </div>

        <h1 style={s.title}>DROPLINK</h1>
        <p style={s.sub}>Peer-to-peer · Zero servers · End-to-end encrypted</p>

        {/* Action cards */}
        <div style={s.grid}>
          <ActionCard
            icon="📡" label="Host a Room"
            desc="Create a private room and invite your peer via code or QR"
            accent="#0ea5e9" onClick={onHost}
          />
          <ActionCard
            icon="🔗" label="Join a Room"
            desc="Enter a room code or scan a QR to connect instantly"
            accent="#8b5cf6" onClick={onJoin}
          />
        </div>

        {/* Feature pills */}
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

function ActionCard({ icon, label, desc, accent, onClick }) {
  return (
    <div
      className="glass"
      style={s.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 16px 40px ${accent}25, 0 1px 0 rgba(255,255,255,0.9) inset`;
        e.currentTarget.style.borderColor = `${accent}60`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(100,130,200,0.12), 0 1px 0 rgba(255,255,255,0.9) inset";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.75)";
      }}
    >
      <div style={{ ...s.cardIcon, background: `${accent}18`, color: accent }}>{icon}</div>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardDesc}>{desc}</div>
      <div style={{ ...s.cardArrow, color: accent }}>→</div>
    </div>
  );
}

const FEATURES = [
  "🔒 E2E Encrypted","📁 Any File Type","💬 Live Chat",
  "📱 QR Pairing","⚡ WebRTC P2P","🚫 No Limits",
  "📊 Adaptive Chunks","♻️ Auto-Resume","📜 History",
  "⏸ Pause & Cancel","📦 File Queue",
];

const s = {
  page: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center", padding: "2rem",
  },
  hero: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "2rem", maxWidth: 520, width: "100%",
    animation: "card-enter 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
  },
  logoWrap: { position: "relative", width: 84, height: 84 },
  logoRing: {
    position: "absolute", inset: 0, borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(139,92,246,0.25))",
    border: "1px solid rgba(255,255,255,0.7)",
    backdropFilter: "blur(10px)",
    animation: "orb-drift 4s ease-in-out infinite alternate",
  },
  logoIcon: {
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "2.4rem",
  },
  title: {
    fontSize: "clamp(2.4rem,8vw,4.2rem)", fontWeight: 800,
    letterSpacing: "-0.04em", lineHeight: 1,
    background: "linear-gradient(135deg, #0f172a 0%, #0ea5e9 50%, #8b5cf6 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  },
  sub: { fontSize: "0.8rem", color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem", width: "100%" },
  card: {
    borderRadius: 18, padding: "1.6rem 1.3rem",
    cursor: "pointer", transition: "all 0.22s ease",
    display: "flex", flexDirection: "column", gap: "0.45rem",
    userSelect: "none",
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1.3rem", marginBottom: "0.2rem",
  },
  cardLabel: { fontSize: "1rem", fontWeight: 700, color: "#0f172a" },
  cardDesc:  { fontSize: "0.72rem", color: "#64748b", lineHeight: 1.6 },
  cardArrow: { fontSize: "1.1rem", fontWeight: 700, marginTop: "0.3rem" },
  pills: { display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center" },
  pill: {
    background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.75)",
    borderRadius: 20, padding: "0.22rem 0.7rem",
    fontSize: "0.64rem", color: "#475569", backdropFilter: "blur(8px)",
  },
  loading: { fontSize: "0.72rem", color: "#64748b", display: "flex", alignItems: "center" },
};