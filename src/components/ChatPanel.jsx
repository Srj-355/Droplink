import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages, connected, onSend }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    const sent = onSend(input);
    if (sent !== false) setInput("");
  };

  return (
    <div style={s.panel}>
      <div style={s.head}>
        <span>💬</span> Live Chat
      </div>

      <div style={s.msgs}>
        {messages.length === 0 && (
          <div className="empty-hint">Messages appear here once connected</div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...s.wrap,
              alignItems:
                m.type === "system" ? "center" :
                m.sender === "me"   ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                ...s.msg,
                ...(m.type === "system" ? s.msgSystem :
                    m.sender === "me"   ? s.msgMe : s.msgThem),
              }}
            >
              {m.text}
            </div>
            {m.time && m.type !== "system" && (
              <div
                style={{
                  ...s.time,
                  textAlign: m.sender === "me" ? "right" : "left",
                }}
              >
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
          value={input}
          disabled={!connected}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />
        <button
          style={{ ...s.sendBtn, ...((!connected || !input.trim()) ? s.sendDisabled : {}) }}
          onClick={handleSend}
          disabled={!connected || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

const s = {
  panel: {
    display: "flex", flexDirection: "column",
    background: "#0c1220", border: "1px solid #1a2540",
    borderRadius: 12, overflow: "hidden",
  },
  head: {
    padding: "0.65rem 0.9rem",
    borderBottom: "1px solid #1a2540",
    fontFamily: "'Syne', sans-serif", fontSize: "0.8rem", fontWeight: 600,
    color: "#6b7fa3",
    display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0,
  },
  msgs: {
    flex: 1, overflowY: "auto",
    padding: "0.7rem", display: "flex",
    flexDirection: "column", gap: "0.35rem",
    minHeight: 0,
  },
  wrap: { display: "flex", flexDirection: "column" },
  msg: {
    maxWidth: "88%", padding: "0.38rem 0.65rem",
    borderRadius: 9, fontSize: "0.75rem", lineHeight: 1.55,
    wordBreak: "break-word",
  },
  msgMe: {
    background: "#3b82f6", color: "#fff",
    borderBottomRightRadius: 2,
  },
  msgThem: {
    background: "#111827", color: "#e2e8f0",
    border: "1px solid #1a2540",
    borderBottomLeftRadius: 2,
  },
  msgSystem: {
    background: "transparent", color: "#6b7fa3",
    fontSize: "0.66rem", textAlign: "center",
    padding: "0.15rem 0.4rem",
  },
  time: { fontSize: "0.58rem", color: "#6b7fa3", marginTop: "0.1rem", padding: "0 0.2rem" },
  inputRow: {
    display: "flex", gap: "0.45rem",
    padding: "0.65rem 0.7rem",
    borderTop: "1px solid #1a2540", flexShrink: 0,
  },
  inp: {
    flex: 1,
    background: "#111827", border: "1px solid #1a2540",
    borderRadius: 8, padding: "0.45rem 0.7rem",
    color: "#e2e8f0", fontFamily: "'DM Mono', monospace", fontSize: "0.76rem",
    outline: "none",
  },
  sendBtn: {
    background: "#3b82f6", border: "none", borderRadius: 8,
    padding: "0.45rem 0.7rem", color: "#fff", cursor: "pointer",
    fontSize: "0.85rem", lineHeight: 1, transition: "background 0.15s",
  },
  sendDisabled: { opacity: 0.4, cursor: "not-allowed" },
};