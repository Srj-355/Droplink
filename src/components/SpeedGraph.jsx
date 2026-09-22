import { useEffect, useRef, useState } from "react";
import { formatSpeed } from "../constants";

const MAX_POINTS = 60; // 30s at 500ms sampling

export default function SpeedGraph({ transfers }) {
  const histRef = useRef([]);
  const transfersRef = useRef(transfers);
  const [samples, setSamples] = useState([]);
  const [peak, setPeak] = useState(0);

  useEffect(() => { transfersRef.current = transfers; }, [transfers]);

  useEffect(() => {
    const id = setInterval(() => {
      const list = transfersRef.current || [];
      const total = list.reduce((acc, t) => {
        if ((t.status === "sending" || t.status === "receiving") && t.speed > 0) return acc + t.speed;
        return acc;
      }, 0);
      histRef.current = [...histRef.current, total].slice(-MAX_POINTS);
      setSamples([...histRef.current]);
      setPeak((p) => Math.max(p, total));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const active = (transfers || []).filter(
    (t) => t.status === "sending" || t.status === "receiving"
  ).length;
  const current = samples.length > 0 ? samples[samples.length - 1] : 0;
  const max = Math.max(...samples, peak, 1);

  // Build SVG path (100 x 36 viewBox)
  const W = 100;
  const H = 36;
  const step = W / Math.max(MAX_POINTS - 1, 1);
  const pts = samples.map((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (H - 2 - (v / max) * (H - 6)).toFixed(1);
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = samples.length > 1 ? `0,${H} ${line} ${(pts.length - 1) * step},${H}` : "";

  return (
    <div style={s.wrap} className="glass-sm">
      <div style={s.head}>
        <span style={s.title}>Live throughput</span>
        <span style={s.live}>
          <span style={{ ...s.dot, background: active > 0 ? "var(--green)" : "var(--text-dim)" }} />
          {active > 0 ? `${active} active` : "idle"}
        </span>
      </div>
      <div style={s.bigRow}>
        <span style={s.big}>{formatSpeed(current)}</span>
        <span style={s.peak}>peak {formatSpeed(peak)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={s.svg} preserveAspectRatio="none">
        {samples.length > 1 && <polygon points={area} fill="rgba(24,119,242,0.14)" stroke="none" />}
        {samples.length > 1 && (
          <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        )}
        {samples.length <= 1 && (
          <text x="50" y="20" textAnchor="middle" fontSize="5" fill="var(--text-dim)">
            {active > 0 ? "sampling…" : "start a transfer"}
          </text>
        )}
      </svg>
      <div style={s.scale}>
        <span>{formatSpeed(max)}</span>
        <span>last 30s</span>
      </div>
    </div>
  );
}

const s = {
  wrap: { borderRadius: 16, padding: "0.75rem 0.9rem", background: "var(--surface)", border: "1px solid var(--border)", flexShrink: 0 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" },
  title: { fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2)" },
  live: { fontSize: "0.62rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" },
  dot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  bigRow: { display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.35rem" },
  big: { fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", fontFamily: "'Geist Mono', monospace" },
  peak: { fontSize: "0.62rem", color: "var(--text-dim)", fontFamily: "'Geist Mono', monospace" },
  svg: { width: "100%", height: 64, display: "block", background: "var(--surface-hover)", borderRadius: 12, border: "1px solid var(--border)" },
  scale: { display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "var(--text-dim)", marginTop: "0.25rem", fontFamily: "'Geist Mono', monospace" },
};
