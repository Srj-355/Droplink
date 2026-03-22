export default function ContactScreen({ onBack }) {
  return (
    <div style={s.page}>
      <div className="setup-card glass" style={s.card}>
        <div style={s.header}>
          <button className="back-btn" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 style={s.title}>Contact Us</h1>
        </div>

        <p style={s.sub}>Have a question or feedback? We'd love to hear from you.</p>

        <form style={s.form} onSubmit={(e) => e.preventDefault()}>
          <div style={s.inputGroup}>
            <label style={s.label}>Name</label>
            <input type="text" className="inp" placeholder="Your Name" />
          </div>
          <div style={s.inputGroup}>
            <label style={s.label}>Email</label>
            <input type="email" className="inp" placeholder="you@example.com" />
          </div>
          <div style={s.inputGroup}>
            <label style={s.label}>Message</label>
            <textarea
              className="inp"
              placeholder="How can we help?"
              style={{ minHeight: 120, resize: "vertical" }}
            />
          </div>
          <button className="btn btn-primary" style={{ height: 48, marginTop: "0.5rem" }}>
            Send Message
          </button>
        </form>

        <div style={s.socials}>
          <div style={s.socialTitle}>Follow us</div>
          <div style={s.socialGrid}>
            <SocialIcon label="Twitter" icon="🐦" />
            <SocialIcon label="GitHub" icon="💻" />
            <SocialIcon label="Discord" icon="💬" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialIcon({ label, icon }) {
  return (
    <div
      className="btn-icon"
      style={{
        width: "auto",
        padding: "0.4rem 0.8rem",
        gap: "0.4rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        height: 34,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    boxSizing: "border-box",
  },
  card: {
    maxWidth: 500,
    width: "100%",
    padding: "2.2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.2rem",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: 800,
    background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
  },
  sub: {
    fontSize: "0.9rem",
    color: "#475569",
    textAlign: "center",
    marginBottom: "0.5rem",
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginLeft: "0.2rem",
  },
  socials: {
    marginTop: "1rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid rgba(255,255,255,0.4)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.8rem",
  },
  socialTitle: {
    fontSize: "0.7rem",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  socialGrid: {
    display: "flex",
    gap: "0.6rem",
  }
};
