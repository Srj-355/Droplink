import { useRef, useState, useEffect } from "react";
import Branding from "../components/Branding";
import EssenceField from "../components/EssenceField";
import { ROOM_CODE_LENGTH } from "../constants";

function extractRoomCode(text = "") {
  if (!text) return "";
  try {
    const u = new URL(text);
    const r = u.searchParams.get("room");
    if (r) return r.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
  } catch { /* not a URL */ }
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

// Keep ?sig= in the address bar so the joiner starts on the same
// signal server as the host (room codes only exist on one server).
function syncSigFromInvite(text = "") {
  try {
    const u = new URL(text);
    const sig = u.searchParams.get("sig");
    const room = u.searchParams.get("room");
    if ((sig === "public" || sig === "custom") && room) {
      const url = `${window.location.origin}${window.location.pathname}?room=${room.toUpperCase()}&sig=${sig}`;
      window.history.replaceState({}, "", url);
    }
  } catch { /* plain code, nothing to sync */ }
}

export default function JoinScreen({ joinCode, setJoinCode, onJoin, onBack, peerError, libsReady, isJoining, joinStatus }) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [detectorSupported] = useState(() => typeof window !== "undefined" && "BarcodeDetector" in window);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimer = useRef(null);
  const fileRef = useRef(null);

  const stopScan = () => {
    if (scanTimer.current) { clearInterval(scanTimer.current); scanTimer.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScanning(false);
  };

  useEffect(() => () => {
    if (scanTimer.current) clearInterval(scanTimer.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const startScan = async () => {
    setScanError("");
    if (!detectorSupported) {
      setScanError("Camera scanning isn't supported in this browser — type the code or upload a QR image.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanTimer.current = setInterval(async () => {
        try {
          if (!videoRef.current || videoRef.current.readyState !== 4) return;
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const code = extractRoomCode(codes[0].rawValue);
            if (code) {
              syncSigFromInvite(codes[0].rawValue);
              setJoinCode(code);
              stopScan();
            }
          }
        } catch { /* keep scanning */ }
      }, 500);
    } catch {
      setScanError("Camera blocked. Allow camera access or upload a QR screenshot instead.");
    }
  };

  const handleQrFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      if (!detectorSupported) { setScanError("QR decode not supported here — type the code manually."); return; }
      const bmp = await createImageBitmap(f);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(bmp);
      if (codes.length > 0) {
        const code = extractRoomCode(codes[0].rawValue);
        if (code) { syncSigFromInvite(codes[0].rawValue); setJoinCode(code); setScanError(""); return; }
      }
      setScanError("No QR found in that image.");
    } catch {
      setScanError("Couldn't read that image.");
    }
  };

  return (
    <div className="setup">
      <EssenceField />
      <div className="glass setup-card" style={{ maxWidth: 440 }}>
        <div className="setup-head">
          <Branding onGoHome={onBack} compact />
          <button className="back-btn" onClick={() => { stopScan(); onBack(); }} disabled={isJoining}>← Back</button>
        </div>

        <div className="stepper">
          <span className="step-dot done"><span className="step-num">✓</span> Get code</span>
          <span className="step-line done" />
          <span className="step-dot active"><span className="step-num">2</span> Join</span>
          <span className="step-line" />
          <span className="step-dot"><span className="step-num">3</span> Transfer</span>
        </div>

        <div>
          <div style={s.title}>Join a room</div>
          <div style={s.sub}>Ask the sender for the 6-character code or scan their QR.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="shimmer-input-wrap">
            <input
              className="inp"
              placeholder="e.g. AB3X9K"
              value={joinCode}
              onChange={(e) => {
                const raw = e.target.value;
                // Allow pasting full invite link — preserve ?sig= for server matching.
                if (raw.includes("room=") || raw.includes("http")) {
                  syncSigFromInvite(raw);
                  setJoinCode(extractRoomCode(raw));
                } else {
                  setJoinCode(raw.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && !isJoining && onJoin()}
              maxLength={ROOM_CODE_LENGTH} autoFocus
              disabled={isJoining}
              style={{ textTransform: "uppercase", letterSpacing: "0.3em", fontSize: "1.6rem", textAlign: "center", fontFamily: "'Geist Mono', monospace", fontWeight: 700, color: "var(--primary)", padding: "0.9rem", borderRadius: 16, opacity: isJoining ? 0.6 : 1 }}
            />
          </div>

          {!scanning ? (
            <div style={s.scanRow}>
              <button className="btn btn-outline" style={{ flex: 1, fontSize: "0.8rem" }} onClick={startScan} disabled={isJoining}>
                📷 Scan QR
              </button>
              <button className="btn btn-outline" style={{ flex: 1, fontSize: "0.8rem" }} onClick={() => fileRef.current?.click()} disabled={isJoining}>
                🖼 Upload QR
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleQrFile} />
            </div>
          ) : (
            <div style={s.scanBox}>
              <video ref={videoRef} style={s.video} playsInline muted />
              <div style={s.scanHint}>Point at the sender's QR…</div>
              <button className="btn btn-ghost" style={{ fontSize: "0.75rem", fontWeight: 700 }} onClick={stopScan}>Cancel scan</button>
            </div>
          )}
          {scanError && <div className="warn">{scanError}</div>}

          <button
            className="btn btn-connect"
            onClick={() => { stopScan(); onJoin(); }}
            disabled={!joinCode.trim() || !libsReady || isJoining}
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.92rem" }}
          >
            {isJoining ? (
               <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.55rem" }}>
                 <span className="spinner-mini" /> Connecting…
               </span>
            ) : "Join room →"}
          </button>
          <div style={s.hint}>🔒 Direct encrypted connection · Nothing uploaded</div>
        </div>

        {isJoining && joinStatus && <div className="warn">{joinStatus}</div>}
        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}

const s = {
  title: { fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em" },
  sub: { fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55, marginTop: "0.25rem" },
  hint: { fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "center", fontWeight: 500 },
  scanRow: { display: "flex", gap: "0.5rem" },
  scanBox: { display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 16, padding: "0.75rem" },
  video: { width: "100%", maxHeight: 240, borderRadius: 12, background: "#000", objectFit: "cover" },
  scanHint: { fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 },
};
