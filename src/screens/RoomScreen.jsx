import DropZone from "../components/DropZone";
import TransferItem from "../components/TransferItem";
import ChatPanel from "../components/ChatPanel";

export default function RoomScreen({
  roomCode, connected, messages, transfers, peerError,
  onSendFile, onSendChat, onLeave, onClearTransfers,
}) {
  return (
    <div className="room-wrap">

      {/* ── Header ── */}
      <div className="room-header">
        <div className="room-header-l">
          <span className="room-logo">⚡ DROPLINK</span>
          {roomCode && <span className="room-code-badge">#{roomCode}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div className={`status-badge ${connected ? "live" : "wait"}`}>
            <div className="status-dot" />
            {connected ? "Connected" : "Connecting…"}
          </div>
          <button className="btn btn-outline" onClick={onLeave} style={{ fontSize: "0.72rem" }}>
            Leave
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="room-body">

        {/* File panel */}
        <div style={s.filePanel}>
          <DropZone connected={connected} onFiles={onSendFile} />

          <div style={s.txHead}>
            <span style={s.txLabel}>
              TRANSFERS{transfers.length > 0 && ` (${transfers.length})`}
            </span>
            {transfers.length > 0 && (
              <button className="btn btn-ghost" style={{ fontSize: "0.68rem" }} onClick={onClearTransfers}>
                Clear
              </button>
            )}
          </div>

          <div style={s.txList}>
            {transfers.length === 0 && (
              <div className="empty-hint">No transfers yet</div>
            )}
            {[...transfers].reverse().map((t) => (
              <TransferItem key={t.id} transfer={t} />
            ))}
          </div>

          {peerError && <div className="err">{peerError}</div>}
        </div>

        {/* Chat panel */}
        <ChatPanel
          messages={messages}
          connected={connected}
          onSend={onSendChat}
        />
      </div>

    </div>
  );
}

const s = {
  filePanel: {
    display: "flex", flexDirection: "column", gap: "0.75rem", overflow: "hidden",
  },
  txHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
  },
  txLabel: { fontSize: "0.68rem", color: "#6b7fa3", letterSpacing: "0.08em" },
  txList: {
    display: "flex", flexDirection: "column", gap: "0.45rem",
    overflowY: "auto", flex: 1,
  },
};