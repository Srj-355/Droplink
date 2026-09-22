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

  const copyDebug = () => {
    const payload = {
      ts: new Date().toISOString(),
      signalMode: connStats.signaling || signalMode,
      ...connStats,
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
  };

  return (
    <div style={s.wrap} className="glass-sm">
      <div style={s.head}>
        <span style={s.title}>Connection</span>
        <span style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          <button onClick={copyDebug} title="Copy debug JSON for bug reports" style={s.copyBtn}>⧉ Debug</button>
          <span style={isRelay ? s.badgeRelay : s.badgeDirect}>
            {isRelay ? "↻ relayed" : "⇄ direct P2P"}
          </span>
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
      <div style={s.note}>
        {isRelay
          ? "↻ Relayed via TURN — slower than direct, but works on office / college WiFi & mobile data."
          : "⇄ Direct P2P — fastest path. If slow, both peers should stay on the same network."}
      </div>
    </div>
  );
}

const s = {
  wrap: { borderRadius: 16, padding: "0.75rem 0.9rem", background: "var(--surface)", border: "1px solid var(--border)", flexShrink: 0 },
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
  note: { fontSize: "0.66rem", color: "var(--text-muted)", marginTop: "0.5rem", lineHeight: 1.55, background: "var(--surface-hover)", borderRadius: 8, padding: "0.45rem 0.6rem" },
  copyBtn: { background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.15rem 0.55rem", fontSize: "0.6rem", fontWeight: 700, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" },
};
