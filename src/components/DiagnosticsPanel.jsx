import { formatBytes } from "../constants";

export default function DiagnosticsPanel({ connected, connStats, signalMode }) {
  if (!connected) {
    return (
      <div style={s.wrap} className="glass-sm">
        <div style={s.head}><span style={s.title}>Connection</span><span style={s.badgeWait}>waiting</span></div>
        <div style={s.hint}>ICE diagnostics appear once the peer connects.</div>
      </div>
    );
  }

  if (!connStats) {
    return (
      <div style={s.wrap} className="glass-sm">
        <div style={s.head}><span style={s.title}>Connection</span><span style={s.badgeWait}>probing…</span></div>
        <div style={s.hint}>Gathering ICE stats…</div>
      </div>
    );
  }

  const isRelay = Boolean(connStats.isRelay);
  const pathLabel = !connStats.connType || connStats.connType === "--"
    ? "resolving…"
    : isRelay ? "TURN relay" : `direct (${connStats.connType})`;

  const rows = [
    { k: "Path", v: pathLabel, tone: isRelay ? "amber" : "green" },
    { k: "RTT", v: connStats.rttMs != null ? `${connStats.rttMs} ms` : "--", tone: null },
    { k: "ICE", v: connStats.iceState || "--", tone: connStats.iceState === "connected" || connStats.iceState === "completed" ? "green" : null },
    { k: "Signaling", v: (connStats.signaling || signalMode) === "public" ? "public cloud" : "private server", tone: null },
    { k: "Buffered", v: connStats.bufferedAmount != null ? formatBytes(connStats.bufferedAmount) : "--", tone: connStats.bufferedAmount > 4 * 1024 * 1024 ? "amber" : null },
    { k: "P2P bytes", v: connStats.bytesSent != null || connStats.bytesReceived != null
      ? `↑ ${formatBytes(connStats.bytesSent || 0)} ↓ ${formatBytes(connStats.bytesReceived || 0)}` : "--", tone: null },
  ];

  return (
    <div style={s.wrap} className="glass-sm">
      <div style={s.head}>
        <span style={s.title}>Connection</span>
        <span style={isRelay ? s.badgeRelay : s.badgeDirect}>
          {isRelay ? "↻ relayed" : "⇄ direct P2P"}
        </span>
      </div>
      <div style={s.grid}>
        {rows.map((r) => (
          <div key={r.k} style={s.row}>
            <span style={s.k}>{r.k}</span>
            <span style={{ ...s.v, ...(r.tone === "green" ? s.vGreen : r.tone === "amber" ? s.vAmber : {}) }}>{r.v}</span>
          </div>
        ))}
      </div>
      {isRelay && (
        <div style={s.note}>Relayed via TURN — slower than direct, but works behind strict NAT.</div>
      )}
    </div>
  );
}

const s = {
  wrap: { borderRadius: 12, padding: "0.7rem 0.85rem", background: "var(--surface)", border: "1px solid var(--border)", flexShrink: 0 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" },
  title: { fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2)" },
  badgeDirect: { fontSize: "0.6rem", fontWeight: 700, color: "var(--green)", background: "#f0f7f3", borderRadius: 20, padding: "0.12rem 0.55rem" },
  badgeRelay: { fontSize: "0.6rem", fontWeight: 700, color: "var(--amber)", background: "#fef7ed", borderRadius: 20, padding: "0.12rem 0.55rem" },
  badgeWait: { fontSize: "0.6rem", fontWeight: 700, color: "var(--text-dim)", background: "var(--bg)", borderRadius: 20, padding: "0.12rem 0.55rem" },
  grid: { display: "flex", flexDirection: "column", gap: "0.28rem" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  k: { fontSize: "0.64rem", color: "var(--text-dim)" },
  v: { fontSize: "0.66rem", color: "var(--text)", fontFamily: "'Geist Mono', monospace", fontWeight: 500, textAlign: "right" },
  vGreen: { color: "var(--green)", fontWeight: 700 },
  vAmber: { color: "var(--amber)", fontWeight: 700 },
  hint: { fontSize: "0.68rem", color: "var(--text-dim)" },
  note: { fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "0.45rem", lineHeight: 1.5 },
};
