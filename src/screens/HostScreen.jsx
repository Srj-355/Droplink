// import { useEffect, useRef, useState } from "react";

// export default function HostScreen({ roomCode, shareUrl, peerError, onLeave }) {
//   const qrRef       = useRef(null);
//   const qrDone      = useRef(false);
//   const [codeCopied, setCodeCopied] = useState(false);
//   const [urlCopied,  setUrlCopied]  = useState(false);

//   // Generate QR with polling retry (lib may still be loading)
//   useEffect(() => {
//     if (!shareUrl || qrDone.current) return;
//     const tryGen = () => {
//       if (!qrRef.current) return;
//       if (!window.QRCode) { setTimeout(tryGen, 200); return; }
//       qrRef.current.innerHTML = "";
//       new window.QRCode(qrRef.current, {
//         text: shareUrl, width: 160, height: 160,
//         colorDark: "#0f172a", colorLight: "#f0f9ff",
//       });
//       qrDone.current = true;
//     };
//     tryGen();
//   }, [shareUrl]);

//   const copyCode = () => {
//     navigator.clipboard.writeText(roomCode).then(() => {
//       setCodeCopied(true);
//       setTimeout(() => setCodeCopied(false), 2000);
//     });
//   };
//   const copyUrl = () => {
//     navigator.clipboard.writeText(shareUrl).then(() => {
//       setUrlCopied(true);
//       setTimeout(() => setUrlCopied(false), 2000);
//     });
//   };

//   return (
//     <div className="setup">
//       <div className="setup-card">
//         <div className="setup-head">
//           <span className="setup-title">Your Room</span>
//           <button className="back-btn" onClick={onLeave}>← back</button>
//         </div>

//         {/* Room code */}
//         <div style={s.codeBox}>
//           <span style={s.codeVal}>{roomCode}</span>
//           <button className="btn-icon" onClick={copyCode} title="Copy code">
//             {codeCopied ? "✓" : "⎘"}
//           </button>
//         </div>

//         {/* QR code */}
//         <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
//           <div ref={qrRef} style={s.qrWrap} />
//           <span style={s.qrLabel}>Scan to join</span>
//         </div>

//         {/* Share URL */}
//         <div style={s.urlBox} onClick={copyUrl}>
//           <span style={s.urlText}>{shareUrl}</span>
//           <span style={s.urlAction}>{urlCopied ? "✓ Copied" : "Copy link"}</span>
//         </div>

//         {/* Waiting */}
//         <div style={s.waitRow}>
//           <span className="dot-pulse" />
//           Waiting for peer to connect…
//         </div>

//         {peerError && <div className="err">{peerError}</div>}
//       </div>
//     </div>
//   );
// }

// const s = {
//   codeBox: {
//     background: "#111827", border: "1px solid #1a2540",
//     borderRadius: 8, padding: "0.9rem 1.1rem",
//     display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
//   },
//   codeVal: {
//     fontFamily: "'Syne', sans-serif", fontSize: "1.9rem", fontWeight: 800,
//     letterSpacing: "0.25em", color: "#3b82f6",
//   },
//   qrWrap: {
//     background: "#f0f9ff", borderRadius: 8, padding: 12,
//     display: "flex", alignItems: "center", justifyContent: "center",
//     minWidth: 184, minHeight: 184,
//   },
//   qrLabel: { fontSize: "0.66rem", color: "#6b7fa3" },
//   urlBox: {
//     background: "#111827", border: "1px solid #1a2540",
//     borderRadius: 8, padding: "0.55rem 0.8rem",
//     display: "flex", alignItems: "center", gap: "0.5rem",
//     cursor: "pointer",
//   },
//   urlText: {
//     flex: 1, fontSize: "0.68rem", color: "#6b7fa3",
//     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
//   },
//   urlAction: { fontSize: "0.68rem", color: "#3b82f6", whiteSpace: "nowrap", flexShrink: 0 },
//   waitRow: {
//     display: "flex", alignItems: "center", gap: "0.5rem",
//     fontSize: "0.75rem", color: "#6b7fa3",
//   },
// };

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export default function HostScreen({ roomCode, shareUrl, peerError, onLeave }) {
  const canvasRef = useRef(null);
  const [cc, setCc] = useState(false);
  const [uc, setUc] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  useEffect(() => {
    // shareUrl may be empty on first render — wait until it's populated
    if (!shareUrl) return;

    const render = () => {
      if (!canvasRef.current) {
        // Canvas not in DOM yet — retry on next frame
        requestAnimationFrame(render);
        return;
      }
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 160,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then(() => setQrReady(true))
        .catch((err) => console.warn("QR render failed:", err));
    };

    render();
  }, [shareUrl]);

  const copy = (text, set) =>
    navigator.clipboard.writeText(text)
      .then(() => { set(true); setTimeout(() => set(false), 2000); })
      .catch(() => {});

  return (
    <div className="setup">
      <div className="glass setup-card">
        <div className="setup-head">
          <span className="setup-title">Your Room</span>
          <button className="back-btn" onClick={onLeave}>← Leave</button>
        </div>

        {/* Room code */}
        <div style={s.codeBox} className="glass-sm">
          <div>
            <div style={s.codeLabel}>Room Code</div>
            <div style={s.codeVal}>{roomCode}</div>
          </div>
          <button className="btn-icon" onClick={() => copy(roomCode, setCc)} title="Copy code">
            {cc ? "✓" : "⎘"}
          </button>
        </div>

        {/* QR */}
        <div style={s.qrWrap}>
          {/* Canvas always in DOM so ref is never null */}
          <div style={{ ...s.qrBox, opacity: qrReady ? 1 : 0, transition: "opacity 0.3s" }}>
            <canvas ref={canvasRef} />
          </div>
          {/* Placeholder while QR renders */}
          {!qrReady && (
            <div style={s.qrPlaceholder}>
              <span className="dot-pulse" />
              <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Generating QR…</span>
            </div>
          )}
          <span style={s.qrLabel}>Scan to join instantly</span>
        </div>

        {/* Share URL */}
        <div style={s.urlRow} className="glass-sm" onClick={() => copy(shareUrl, setUc)}>
          <span style={s.urlText}>{shareUrl}</span>
          <span style={s.urlAction}>{uc ? "✓" : "Copy link"}</span>
        </div>

        {/* Waiting */}
        <div style={s.waitRow}>
          <span className="dot-pulse" />
          <span style={{ color: "#64748b", fontSize: "0.78rem" }}>Waiting for peer…</span>
        </div>

        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}

const s = {
  codeBox: {
    borderRadius: 12, padding: "0.9rem 1.1rem",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
  },
  codeLabel: { fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 },
  codeVal: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: "1.9rem", fontWeight: 700,
    letterSpacing: "0.22em", color: "#0ea5e9",
  },
  qrWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" },
  qrBox: {
    background: "rgba(255,255,255,0.9)", borderRadius: 14, padding: 12,
    boxShadow: "0 4px 20px rgba(14,165,233,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  qrPlaceholder: {
    position: "absolute",
    display: "flex", alignItems: "center", gap: "0.5rem",
  },
  qrLabel: { fontSize: "0.66rem", color: "#94a3b8" },
  urlRow: {
    borderRadius: 10, padding: "0.6rem 0.9rem",
    display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
    overflow: "hidden",
  },
  urlText: { flex: 1, fontSize: "0.68rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
  urlAction: { fontSize: "0.68rem", color: "#0ea5e9", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 600 },
  waitRow: { display: "flex", alignItems: "center", gap: "0.6rem" },
};