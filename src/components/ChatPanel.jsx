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
        <span style={s.headIcon}>💬</span>
        <span style={s.headTitle}>Live Chat</span>
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
                  m.sender === "me"   ? s.msgMe  : s.msgThem),
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
  panel: { display: "flex", flexDirection: "column", borderRadius: 18, overflow: "hidden", height: "100%" },
  head: {
    padding: "0.7rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.5)",
    display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0,
  },
  headIcon: { fontSize: "0.9rem" },
  headTitle: { fontSize: "0.78rem", fontWeight: 600, color: "#334155" },
  msgs: { flex: 1, overflowY: "auto", padding: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", minHeight: 0 },
  wrap: { display: "flex", flexDirection: "column" },
  msg: { maxWidth: "88%", padding: "0.42rem 0.7rem", borderRadius: 10, fontSize: "0.76rem", lineHeight: 1.55, wordBreak: "break-word" },
  msgMe: { background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)", color: "#fff", borderBottomRightRadius: 2 },
  msgThem: { background: "rgba(255,255,255,0.7)", color: "#0f172a", border: "1px solid rgba(255,255,255,0.8)", borderBottomLeftRadius: 2 },
  msgSys: { background: "transparent", color: "#94a3b8", fontSize: "0.66rem", textAlign: "center", padding: "0.18rem 0.5rem" },
  time: { fontSize: "0.58rem", color: "#94a3b8", marginTop: "0.1rem", padding: "0 0.2rem" },
  inputRow: { display: "flex", gap: "0.5rem", padding: "0.7rem 0.85rem", borderTop: "1px solid rgba(255,255,255,0.5)", flexShrink: 0 },
  inp: {
    flex: 1, background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.75)", borderRadius: 10,
    padding: "0.48rem 0.8rem", color: "#0f172a",
    fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", outline: "none",
    backdropFilter: "blur(8px)", transition: "border-color 0.15s",
  },
  sendBtn: {
    background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)",
    border: "none", borderRadius: 10,
    padding: "0.48rem 0.75rem", color: "#fff",
    cursor: "pointer", fontSize: "0.9rem", lineHeight: 1,
    boxShadow: "0 2px 8px rgba(14,165,233,0.3)",
  },
  sendOff: { opacity: 0.4, cursor: "not-allowed" },
};