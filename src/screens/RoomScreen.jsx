import { useState } from "react";
import DropZone from "../components/DropZone";
import TransferItem from "../components/TransferItem";
import ChatPanel from "../components/ChatPanel";
import HistoryPanel from "../components/HistoryPanel";
import QueuePanel from "../components/QueuePanel";

export default function RoomScreen({
  roomCode, connected, reconnecting,
  messages, transfers, fileQueue,
  peerError, history, rooms,
  onQueueFile, onSendChat, onLeave,
  onClearTransfers, onPause, onResume,
  onCancelTransfer, onCancelReceive,
  onRemoveFromQueue,
  onClearHistory, onClearRoomHistory, onRemoveHistory,
}) {
  const [tab, setTab] = useState("transfers");
  const [mobileTab, setMobileTab] = useState("files");

  const handleCancel = (id, direction) => {
    if (direction === "out") onCancelTransfer?.(id);
    else onCancelReceive?.(id);
  };

  const chatCount = messages.filter((m) => m.type === "chat").length;

  const filesPanel = (
    <div style={s.leftPanel}>
      <DropZone connected={connected} onFiles={onQueueFile} />
      <QueuePanel queue={fileQueue} onRemove={onRemoveFromQueue} />

      <div style={s.tabRow}>
        <div className="tab-bar" style={{ flex: 1 }}>
          <button
            className={`tab-btn${tab === "transfers" ? " active" : ""}`}
            onClick={() => setTab("transfers")}
          >
            Transfers {transfers.length > 0 && `(${transfers.length})`}
          </button>
          <button
            className={`tab-btn${tab === "history" ? " active" : ""}`}
            onClick={() => setTab("history")}
          >
            History {history.length > 0 && `(${history.length})`}
          </button>
        </div>
        {tab === "transfers" && transfers.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: "0.68rem" }}
            onClick={onClearTransfers}
          >
            Clear
          </button>
        )}
      </div>

      <div style={s.tabContent}>
        {tab === "transfers" && (
          <div style={s.list}>
            {transfers.length === 0 && (
              <div className="empty-hint">No transfers yet</div>
            )}
            {[...transfers].reverse().map((t) => (
              <TransferItem
                key={t.id} transfer={t}
                onPause={onPause} onResume={onResume}
                onCancel={(id) => handleCancel(id, t.direction)}
              />
            ))}
          </div>
        )}
        {tab === "history" && (
          <HistoryPanel
            history={history} loading={false}
            rooms={rooms}
            currentRoom={roomCode}
            onClear={onClearHistory}
            onClearRoom={onClearRoomHistory}
            onRemove={onRemoveHistory}
          />
        )}
      </div>

      {peerError && <div className="err" style={{ flexShrink: 0 }}>{peerError}</div>}
    </div>
  );

  return (
    <div className="room-wrap">

      {/* Header */}
      <div className="room-header">
        <div className="room-header-l">
          <span className="room-logo">⚡ DROPLINK</span>
          {roomCode && <span className="room-code-badge">#{roomCode}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {reconnecting ? (
            <div className="status-badge retry">
              <div className="spinner" />Reconnecting…
            </div>
          ) : (
            <div className={`status-badge ${connected ? "live" : "wait"}`}>
              <div className={connected ? "dot-live" : "dot-pulse"} />
              {connected ? "Connected" : "Connecting…"}
            </div>
          )}
          <button
            className="btn btn-outline"
            onClick={onLeave}
            style={{ fontSize: "0.74rem" }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Mobile tab switcher — hidden on desktop via CSS */}
      <div className="mobile-tabs">
        <div className="tab-bar" style={{ width: "100%" }}>
          <button
            className={`tab-btn${mobileTab === "files" ? " active" : ""}`}
            onClick={() => setMobileTab("files")}
          >
            📁 Files
          </button>
          <button
            className={`tab-btn${mobileTab === "chat" ? " active" : ""}`}
            onClick={() => setMobileTab("chat")}
          >
            💬 Chat {chatCount > 0 && `(${chatCount})`}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="room-body">

        {/* Desktop: both columns always visible */}
        <div className="desktop-only">{filesPanel}</div>
        <div className="desktop-only">
          <ChatPanel messages={messages} connected={connected} onSend={onSendChat} />
        </div>

        {/* Mobile: one panel at a time */}
        <div className={`mobile-only${mobileTab === "files" ? "" : " mob-hidden"}`}>
          {filesPanel}
        </div>
        <div className={`mobile-only${mobileTab === "chat" ? "" : " mob-hidden"}`}>
          <ChatPanel messages={messages} connected={connected} onSend={onSendChat} />
        </div>

      </div>
    </div>
  );
}

const s = {
  leftPanel: { display: "flex", flexDirection: "column", gap: "0.75rem", overflow: "hidden", minHeight: 0, height: "100%" },
  tabRow: { display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 },
  tabContent: { flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" },
  list: { display: "flex", flexDirection: "column", gap: "0.45rem", overflowY: "auto", flex: 1 },
};