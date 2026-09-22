import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages, peerTyping, connected, onSend, onTyping }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const typingSent = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, peerTyping]);

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    if (onSend(input) !== false) {
      setInput("");
      typingSent.current = false;
      onTyping?.(false);
    }
  };

  const handleChange = (v) => {
    setInput(v);
    if (!connected) return;
    const typing = v.trim().length > 0;
    if (typing && !typingSent.current) {
      typingSent.current = true;
      onTyping?.(true);
    } else if (!typing && typingSent.current) {
      typingSent.current = false;
      onTyping?.(false);
    }
  };

  return (
    <div style={s.panel} className="glass">
      <div style={s.head}>
        <span style={s.avatar}>💬</span>
        <span style={s.headTitle}>Messages</span>
        <span style={s.headPill}>{connected ? "Live" : "Offline"}</span>
      </div>

      <div style={s.msgs} data-scrollable>
        {messages.length === 0 && !peerTyping && (
          <div className="empty-hint">
            <div className="empty-illust">👋</div>
            Say hello — messages are<br />encrypted peer-to-peer.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{
            ...s.wrap,
            alignItems: m.type === "system" ? "center" : m.sender === "me" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              ...s.msg,
              ...(m.type === "system" ? s.msgSys :
                m.sender === "me" ? s.msgMe : s.msgThem),
            }}>
              {m.text}
            </div>
            {m.time && m.type !== "system" && (
              <div style={{ ...s.time, textAlign: m.sender === "me" ? "right" : "left" }}>
                {m.time}
                {m.sender === "me" && (
                  <span style={{ marginLeft: 4, opacity: 0.8 }}>
                    {m.status === "delivered" ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {peerTyping && (
          <div style={{ ...s.wrap, alignItems: "flex-start" }}>
            <div style={{ ...s.msg, ...s.msgThem, ...s.typing }} aria-label="Peer is typing">
              <span style={{ ...s.tdot, animationDelay: "0s" }} />
              <span style={{ ...s.tdot, animationDelay: "0.15s" }} />
              <span style={{ ...s.tdot, animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={s.inputRow}>
        <input
          style={s.inp}
          placeholder={connected ? "Type a message…" : "Waiting for peer…"}
          value={input} disabled={!connected}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          onBlur={() => { if (typingSent.current) { typingSent.current = false; onTyping?.(false); } }}
        />
        <button
          style={{ ...s.sendBtn, ...(!connected || !input.trim() ? s.sendOff : {}) }}
          onClick={handleSend} disabled={!connected || !input.trim()}
          title="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const s = {
  panel: { display: "flex", flexDirection: "column", borderRadius: 18, overflow: "hidden", height: "100%", minHeight: 0 },
  head: {
    padding: "0.7rem 1rem", borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0,
    background: "var(--surface)",
  },
  avatar: {
    width: 30, height: 30, borderRadius: "50%", background: "var(--brand-gradient-soft)",
    border: "1px solid var(--send-border)", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.85rem", flexShrink: 0,
  },
  headTitle: { fontSize: "0.85rem", fontWeight: 800, letterSpacing: "-0.01em" },
  headPill: {
    marginLeft: "auto", fontSize: "0.62rem", fontWeight: 800,
    background: "var(--surface-hover)", border: "1px solid var(--border)",
    color: "var(--text-muted)", borderRadius: 999, padding: "0.18rem 0.6rem",
  },
  msgs: { flex: 1, overflowY: "auto", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.45rem", minHeight: 0, background: "#FBFCFE" },
  wrap: { display: "flex", flexDirection: "column" },
  msg: { maxWidth: "min(86%, 520px)", padding: "0.55rem 0.85rem", borderRadius: 18, fontSize: "0.8rem", lineHeight: 1.5, wordBreak: "break-word", boxShadow: "var(--shadow)" },
  msgMe: { background: "var(--brand-gradient)", color: "#fff", borderBottomRightRadius: 6 },
  msgThem: { background: "#fff", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 6 },
  msgSys: { background: "var(--bg-alt)", color: "var(--text-muted)", fontSize: "0.68rem", fontWeight: 600, textAlign: "center", padding: "0.3rem 0.75rem", borderRadius: 999, boxShadow: "none" },
  typing: { display: "flex", gap: 4, alignItems: "center", padding: "0.7rem 0.9rem" },
  tdot: { width: 6, height: 6, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block", animation: "pulse-dot 1.2s infinite" },
  time: { fontSize: "0.6rem", color: "var(--text-dim)", marginTop: "0.15rem", padding: "0 0.3rem" },
  inputRow: { display: "flex", gap: "0.5rem", padding: "0.75rem 0.85rem", borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" },
  inp: {
    flex: 1, background: "var(--surface-hover)",
    border: "1.5px solid transparent", borderRadius: 999,
    padding: "0.6rem 1rem", color: "var(--text)",
    fontFamily: "inherit", fontSize: "0.82rem", outline: "none",
    transition: "all 0.15s",
  },
  sendBtn: {
    background: "var(--brand-gradient)",
    border: "none", borderRadius: "50%",
    width: 38, height: 38, color: "#fff",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "var(--shadow-brand)",
    transition: "all 0.15s", flexShrink: 0,
  },
  sendOff: { opacity: 0.4, cursor: "not-allowed", boxShadow: "none" },
};
