import { formatBytes, formatSpeed } from "../constants";
import EmptyState from "./EmptyState";

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function AnalyticsPanel({ history, transfers }) {
  const list = history || [];
  const done = list.filter((r) => r.status === "done");

  const totalBytes = list.reduce((a, r) => a + (r.size || 0), 0);
  const sentBytes = list.filter((r) => r.direction === "out").reduce((a, r) => a + (r.size || 0), 0);
  const recvBytes = list.filter((r) => r.direction === "in").reduce((a, r) => a + (r.size || 0), 0);
  const savedBytes = list.reduce((a, r) => a + (r.savedBytes || 0), 0);

  const speeds = list.map((r) => r.avgSpeed).filter((v) => typeof v === "number" && v > 0);
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const best = speeds.length > 0 ? Math.max(...speeds) : 0;

  const successRate = list.length > 0 ? Math.round((done.length / list.length) * 100) : 0;
  const largest = list.length > 0 ? list.reduce((m, r) => (r.size || 0) > (m.size || 0) ? r : m, list[0]) : null;
  const activeNow = (transfers || []).filter((t) => t.status === "sending" || t.status === "receiving").length;

  // Last 7 days buckets (oldest → newest)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const perDay = days.map((d) => {
    const k = dayKey(d.getTime());
    const recs = list.filter((r) => dayKey(r.timestamp) === k);
    return {
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      bytes: recs.reduce((a, r) => a + (r.size || 0), 0),
      count: recs.length,
    };
  });
  const maxDay = Math.max(...perDay.map((d) => d.bytes), 1);

  const cards = [
    { label: "Files logged", value: String(list.length), sub: `${done.length} completed` },
    { label: "Data moved", value: formatBytes(totalBytes), sub: `↑ ${formatBytes(sentBytes)} ↓ ${formatBytes(recvBytes)}` },
    { label: "Avg speed", value: avgSpeed > 0 ? formatSpeed(avgSpeed) : "--", sub: best > 0 ? `best ${formatSpeed(best)}` : "no samples yet" },
    { label: "Compression saved", value: formatBytes(savedBytes), sub: `${successRate}% success${activeNow > 0 ? ` · ${activeNow} live` : ""}` },
  ];

  return (
    <div style={s.wrap} className="glass-sm">
      <div style={s.head}>
        <span style={s.title}>Session analytics</span>
        <span style={s.count}>{list.length > 0 ? `${list.length} records` : "no data yet"}</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="📊" title="No stats yet" sub="Completed transfers appear here with totals, speeds and compression savings." />
      ) : (
        <>
          <div style={s.cards}>
            {cards.map((c) => (
              <div key={c.label} style={s.card}>
                <div style={s.cardLabel}>{c.label}</div>
                <div style={s.cardValue}>{c.value}</div>
                <div style={s.cardSub}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div style={s.chartTitle}>Last 7 days</div>
          <div style={s.bars}>
            {perDay.map((d, i) => (
              <div key={i} style={s.barCol} title={`${d.count} files · ${formatBytes(d.bytes)}`}>
                <div style={s.barTrack}>
                  <div style={{ ...s.barFill, height: `${Math.max(4, Math.round((d.bytes / maxDay) * 100))}%` }} />
                </div>
                <span style={s.barLabel}>{d.label}</span>
              </div>
            ))}
          </div>

          {largest && (
            <div style={s.foot}>Largest: <b style={s.footB}>{largest.name}</b> · {formatBytes(largest.size)}</div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  wrap: { borderRadius: 16, padding: "0.75rem 0.9rem", background: "var(--surface)", border: "1px solid var(--border)", flexShrink: 0 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.55rem" },
  title: { fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2)" },
  count: { fontSize: "0.6rem", color: "var(--text-dim)", fontFamily: "'Geist Mono', monospace" },
  empty: { fontSize: "0.68rem", color: "var(--text-dim)", lineHeight: 1.6 },
  cards: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem", marginBottom: "0.6rem" },
  card: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.5rem 0.6rem", minWidth: 0 },
  cardLabel: { fontSize: "0.58rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.15rem" },
  cardValue: { fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", fontFamily: "'Geist Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardSub: { fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chartTitle: { fontSize: "0.62rem", color: "var(--text-dim)", marginBottom: "0.35rem" },
  bars: { display: "flex", alignItems: "flex-end", gap: "0.35rem", height: 72 },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", minWidth: 0, height: "100%" },
  barTrack: { flex: 1, width: "100%", maxWidth: 26, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden", minHeight: 0 },
  barFill: { width: "100%", background: "var(--receive)", borderRadius: 0 },
  barLabel: { fontSize: "0.58rem", color: "var(--text-dim)" },
  foot: { fontSize: "0.64rem", color: "var(--text-muted)", marginTop: "0.55rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  footB: { color: "var(--text)" },
};
