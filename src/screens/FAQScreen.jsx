import { useState } from "react";

export default function FAQScreen({ onBack }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

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
          <h1 style={s.title}>FAQ</h1>
        </div>

        <div style={s.list}>
          {FAQS.map((faq, i) => (
            <div 
              key={i} 
              style={{
                ...s.item,
                borderColor: openIndex === i ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.4)"
              }}
            >
              <div style={s.question} onClick={() => toggle(i)}>
                <span style={s.qText}>{faq.q}</span>
                <span style={{ 
                  ...s.arrow, 
                  transform: openIndex === i ? "rotate(180deg)" : "rotate(0)" 
                }}>▾</span>
              </div>
              {openIndex === i && (
                <div style={s.answer}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "How does Droplink work?",
    a: "Droplink uses WebRTC technology to establish a direct, peer-to-peer connection between your devices. No files are stored on any servers; they go straight from one device to the other, encrypted end-to-end."
  },
  {
    q: "Is there a file size limit?",
    a: "Nope! Since the files are transferred directly between peers, there are no artificial limits. The only limits are your device's memory and connection stability."
  },
  {
    q: "Do I need to create an account?",
    a: "No accounts or registration required. Just share the room link or code and start transferring immediately."
  },
  {
    q: "Is my data secure?",
    a: "Yes. All transfers are end-to-end encrypted via WebRTC's built-in security protocols (DTLS/SRTP). Your data never touches our servers."
  },
  {
    q: "Can I use it on mobile?",
    a: "Absolutely. Droplink is fully responsive and works on any modern mobile browser. You can even scan the QR code to connect instantly."
  }
];

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
    maxWidth: 600,
    width: "100%",
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.5rem",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: 800,
    background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  item: {
    background: "rgba(255,255,255,0.3)",
    borderRadius: "12px",
    border: "1px solid",
    transition: "all 0.2s ease",
    overflow: "hidden",
  },
  question: {
    padding: "1rem 1.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
  },
  qText: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#0f172a",
  },
  arrow: {
    fontSize: "1.2rem",
    color: "#64748b",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  answer: {
    padding: "0 1.25rem 1.25rem 1.25rem",
    fontSize: "0.88rem",
    color: "#475569",
    lineHeight: 1.6,
    animation: "card-enter 0.3s ease-out",
  }
};
