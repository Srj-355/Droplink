export default function JoinScreen({ joinCode, setJoinCode, onJoin, onBack, peerError, libsReady }) {
  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-head">
          <span className="setup-title">Join Room</span>
          <button className="back-btn" onClick={onBack}>← back</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <span style={{ fontSize: "0.72rem", color: "#6b7fa3" }}>Enter room code</span>
          <input
            className="inp"
            placeholder="e.g. AB3X9K"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onJoin()}
            maxLength={24}
            autoFocus
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontSize: "1.3rem",
              textAlign: "center",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
            }}
          />
          <button
            className="btn btn-primary"
            onClick={onJoin}
            disabled={!joinCode.trim() || !libsReady}
            style={{ width: "100%", padding: "0.75rem" }}
          >
            Connect →
          </button>
        </div>

        {peerError && <div className="err">{peerError}</div>}
      </div>
    </div>
  );
}