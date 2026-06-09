import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages, connected, onSend }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    if (onSend(input) !== false) setInput("");
  };

  return (
    <div style={s.panel} className="glass">
      <div style={s.head}>
        <span style={s.headIcon}>Chat</span>
        <span style={s.headTitle}>Messages</span>
      </div>

      <div style={s.msgs}>
        {messages.length === 0 && (
          <div className="empty-hint">Messages appear here once connected</div>
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
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={s.inputRow}>
        <input
          style={s.inp}
          placeholder={connected ? "Type a message…" : "Waiting for peer…"}
          value={input} disabled={!connected}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button
          style={{ ...s.sendBtn, ...(!connected || !input.trim() ? s.sendOff : {}) }}
          onClick={handleSend} disabled={!connected || !input.trim()}
        >↑</button>
      </div>
    </div>
  );
}

const s = {
  panel: { display: "flex", flexDirection: "column", borderRadius: 14, overflow: "hidden", height: "100%" },
  head: {
    padding: "0.65rem 1rem", borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0,
  },
  headIcon: { fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" },
  headTitle: { fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)" },
  msgs: { flex: 1, overflowY: "auto", padding: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", minHeight: 0 },
  wrap: { display: "flex", flexDirection: "column" },
  msg: { maxWidth: "88%", padding: "0.42rem 0.7rem", borderRadius: 10, fontSize: "0.76rem", lineHeight: 1.55, wordBreak: "break-word" },
  msgMe: { background: "var(--send)", color: "#fff", borderBottomRightRadius: 2 },
  msgThem: { background: "var(--bg)", color: "var(--text)", borderBottomLeftRadius: 2 },
  msgSys: { background: "transparent", color: "var(--text-dim)", fontSize: "0.66rem", textAlign: "center", padding: "0.18rem 0.5rem" },
  time: { fontSize: "0.58rem", color: "var(--text-dim)", marginTop: "0.1rem", padding: "0 0.2rem" },
  inputRow: { display: "flex", gap: "0.5rem", padding: "0.7rem 0.85rem", borderTop: "1px solid var(--border)", flexShrink: 0 },
  inp: {
    flex: 1, background: "var(--bg)",
    border: "1px solid var(--border)", borderRadius: 8,
    padding: "0.48rem 0.8rem", color: "var(--text)",
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.78rem", outline: "none",
    transition: "border-color 0.15s",
  },
  sendBtn: {
    background: "var(--send)",
    border: "none", borderRadius: 8,
    padding: "0.48rem 0.75rem", color: "#fff",
    cursor: "pointer", fontSize: "0.9rem", lineHeight: 1,
    transition: "background 0.15s",
  },
  sendOff: { opacity: 0.35, cursor: "not-allowed" },
};