import { useState, useMemo } from "react";
import Branding from "../components/Branding";
import EssenceField from "../components/EssenceField";
import EmptyState from "../components/EmptyState";

export default function FAQScreen({ onBack }) {
  const [openIndex, setOpenIndex] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS.map((f, i) => ({ ...f, i }));
    return FAQS
      .map((f, i) => ({ ...f, i }))
      .filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q));
  }, [query]);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="setup">
      <EssenceField />
      <div className="glass setup-card" style={{ maxWidth: 560 }}>
        <div className="setup-head">
          <Branding onGoHome={onBack} compact />
          <button className="back-btn" onClick={onBack} aria-label="Go back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div style={s.hero}>
          <span className="brand-tile" style={{ width: 48, height: 48, borderRadius: 15 }} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <div>
            <h1 style={s.title}>Help & FAQ</h1>
            <p style={s.sub}>How droplink works, plus fixes for slow or stuck transfers.</p>
          </div>
        </div>

        <div className="shimmer-input-wrap">
          <input
            className="inp"
            placeholder="Search questions… e.g. QR, limit, secure"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search frequently asked questions"
            style={{ borderRadius: 999, padding: "0.7rem 1.1rem" }}
          />
        </div>

        <div style={s.list} role="list">
          {filtered.length === 0 && (
            <EmptyState
              icon="🔍"
              title="No matches"
              sub="Try a different search — or go back and start a room."
            />
          )}
          {filtered.map((faq) => {
            const open = openIndex === faq.i;
            return (
              <div
                key={faq.i}
                role="listitem"
                style={{
                  ...s.item,
                  borderColor: open ? "var(--send-border)" : "var(--border)",
                  background: open ? "var(--surface)" : "var(--surface-hover)",
                  boxShadow: open ? "var(--shadow)" : "none",
                }}
              >
                <button
                  style={s.question}
                  onClick={() => toggle(faq.i)}
                  aria-expanded={open}
                  aria-label={faq.q}
                >
                  <span style={s.qText}>{faq.q}</span>
                  <span
                    style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "rotate(0)" }}
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {open && <div style={s.answer}>{faq.a}</div>}
              </div>
            );
          })}
        </div>

        <div style={s.helpCard}>
          <span style={s.helpIcon} aria-hidden="true">⚡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.helpTitle}>Still stuck?</div>
            <div style={s.helpSub}>Connection stats live under Room → Stats → Connection, with a ⧉ Debug copy button for bug reports.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "How does Droplink work?",
    a: "Droplink uses WebRTC to open a direct, encrypted peer-to-peer connection between your devices. Files go straight from sender to receiver — nothing is uploaded or stored on any server."
  },
  {
    q: "Is there a file size limit?",
    a: "No artificial limits. The only constraints are your device's memory and connection stability. Very large files stream straight to disk in supported browsers."
  },
  {
    q: "Do I need to create an account?",
    a: "No accounts or registration. Create a room, share the 6-character code, link, or QR — the other side joins instantly."
  },
  {
    q: "How do I join with QR?",
    a: "On the Join screen tap Scan QR and point your camera at the sender's code — or upload a QR screenshot. The room code fills in automatically."
  },
  {
    q: "Is my data secure?",
    a: "Yes. All transfers are end-to-end encrypted via WebRTC's built-in DTLS/SRTP. Signalling only exchanges connection info; your file bytes never touch our servers."
  },
  {
    q: "Why is my transfer relayed or slow?",
    a: "Strict office, college, or mobile networks can block direct connections, so traffic relays via TURN. It still works, just slower. Same WiFi and the 3× parallel toggle help with many files."
  },
  {
    q: "Can I pause, retry, or re-download?",
    a: "Yes. Either side can pause or cancel. Failed sends show a Retry button, and received files can be saved again from the transfer card. Completion also triggers a sound and notification."
  },
  {
    q: "Can I use it on mobile?",
    a: "Absolutely — it's fully responsive and installable. Scan the QR to connect, and enable notifications to know when files arrive."
  }
];

const s = {
  hero: { display: "flex", gap: "0.85rem", alignItems: "center" },
  title: { fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 },
  sub: { fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.55, marginTop: "0.2rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.55rem" },
  item: {
    borderRadius: 16,
    border: "1.5px solid",
    transition: "all 0.18s ease",
    overflow: "hidden",
  },
  question: {
    width: "100%",
    padding: "0.85rem 1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    cursor: "pointer",
    userSelect: "none",
    background: "transparent",
    border: "none",
    fontFamily: "inherit",
    textAlign: "left",
    minHeight: 48,
  },
  qText: { fontSize: "0.86rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.45 },
  chevron: {
    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
    background: "var(--surface-hover)", border: "1px solid var(--border)",
    color: "var(--text-muted)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "transform 0.2s ease",
  },
  answer: {
    padding: "0 1rem 0.95rem 1rem",
    fontSize: "0.82rem",
    color: "var(--text-muted)",
    lineHeight: 1.65,
  },
  helpCard: {
    display: "flex", gap: "0.7rem", alignItems: "flex-start",
    background: "var(--brand-gradient-soft)", border: "1px solid var(--send-border)",
    borderRadius: 16, padding: "0.8rem 0.95rem",
  },
  helpIcon: {
    width: 34, height: 34, borderRadius: 12, flexShrink: 0,
    background: "var(--brand-gradient)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
  },
  helpTitle: { fontSize: "0.8rem", fontWeight: 800 },
  helpSub: { fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.55, marginTop: "0.15rem" },
};
