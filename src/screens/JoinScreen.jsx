import Branding from "../components/Branding";

export default function JoinScreen({ joinCode, setJoinCode, onJoin, onBack, peerError, libsReady, isJoining }) {
  return (
    <div className="setup">
      <div className="glass setup-card">
        <div className="setup-head">
          <Branding onGoHome={onBack} />
          <button className="back-btn" onClick={onBack} disabled={isJoining}>← Back</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={s.lbl}>Enter room code</label>
          <input
            className="inp"
            placeholder="e.g. AB3X9K"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && !isJoining && onJoin()}
            maxLength={24} autoFocus
            disabled={isJoining}
            style={{ textTransform: "uppercase", letterSpacing: "0.22em", fontSize: "1.4rem", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#0ea5e9", opacity: isJoining ? 0.6 : 1 }}
          />
          <button
            className="btn btn-primary btn-connect"
            onClick={onJoin}
            disabled={!joinCode.trim() || !libsReady || isJoining}
            style={{ width: "100%", padding: "0.8rem", fontSize: "0.88rem", position: "relative" }}
          >
            {isJoining ? (
               <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                 <span className="spinner-mini" /> Connecting...
               </span>
            ) : "Connect →"}
          </button>
        </div>

        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}

const s = {
  lbl: { fontSize: "0.72rem", color: "#64748b", fontWeight: 500 },
};