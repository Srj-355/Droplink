import { useMemo, useState } from "react";
import DropZone from "../components/DropZone";
import TransferItem from "../components/TransferItem";
import ChatPanel from "../components/ChatPanel";
import HistoryPanel from "../components/HistoryPanel";
import QueuePanel from "../components/QueuePanel";
import SpeedGraph from "../components/SpeedGraph";
import DiagnosticsPanel from "../components/DiagnosticsPanel";
import AnalyticsPanel from "../components/AnalyticsPanel";
import { formatBytes } from "../constants";

function useTotalProgress(transfers, fileQueue) {
  return useMemo(() => {
    const all = [...(transfers || [])];
    const totalBytes = all.reduce((a, t) => a + (t.size || 0), 0);
    const doneBytes = all.reduce((a, t) => a + ((t.size || 0) * ((t.progress || 0) / 100)), 0);
    const pct = totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 0;
    const active = all.filter((t) => t.status === "sending" || t.status === "receiving").length;
    const queued = (fileQueue || []).filter((q) => q.status === "queued").length;
    const doneCount = all.filter((t) => t.status === "done").length;
    return { totalBytes, doneBytes, pct, active, queued, doneCount, total: all.length };
  }, [transfers, fileQueue]);
}

export default function RoomScreen({
  roomCode, connected, reconnecting,
  messages, peerTyping, transfers, fileQueue,
  peerError, history, historyLoading, rooms,
  connStats, signalMode, maxParallel, completedBlobs,
  onQueueFile, onSendChat, onTyping, onLeave,
  onClearTransfers, onPause, onResume, onPauseReceive, onResumeReceive,
  onCancelTransfer, onCancelReceive, onRetry, onDownloadAgain, onParallelChange,
  onRemoveFromQueue,
  onClearHistory, onClearRoomHistory, onRemoveHistory,
}) {
  const [tab, setTab] = useState("transfers");
  const [mobileTab, setMobileTab] = useState("files");
  const total = useTotalProgress(transfers, fileQueue);

  const handleCancel = (id, direction) => {
    if (direction === "out") onCancelTransfer?.(id);
    else onCancelReceive?.(id);
  };
  const handlePause = (t) => {
    if (t.direction === "out") onPause?.(t.id);
    else onPauseReceive?.(t.id);
  };
  const handleResume = (t) => {
    if (t.direction === "out") onResume?.(t.id);
    else onResumeReceive?.(t.id);
  };

  const chatCount = messages.filter((m) => m.type === "chat").length;
  const showTotal = total.total > 0 || total.queued > 0;

  const lifetime = useMemo(() => {
    const list = history || [];
    const totalBytes = list.reduce((a, r) => a + (r.size || 0), 0);
    const sentBytes = list.filter((r) => r.direction === "out").reduce((a, r) => a + (r.size || 0), 0);
    const recvBytes = list.filter((r) => r.direction === "in").reduce((a, r) => a + (r.size || 0), 0);
    const savedBytes = list.reduce((a, r) => a + (r.savedBytes || 0), 0);
    return { totalBytes, sentBytes, recvBytes, savedBytes, count: list.length };
  }, [history]);

  const headerTooltip =
    lifetime.count === 0
      ? "No transfers logged yet — completed transfers appear in Stats with a 7-day chart."
      : `Data moved: ${formatBytes(lifetime.totalBytes)} (↑ ${formatBytes(lifetime.sentBytes)} ↓ ${formatBytes(lifetime.recvBytes)}) · Saved by compression: ${formatBytes(lifetime.savedBytes)} · ${lifetime.count} files logged — see Stats tab for 7-day chart.`;

  const filesPanel = (
    <div style={s.leftPanel}>
      <DropZone connected={connected} onFiles={onQueueFile} />

      {showTotal && (
        <div style={s.totalCard} className="glass-sm">
          <div style={s.totalTop}>
            <span style={s.totalLabel}>
              {total.doneCount}/{total.total} files
              {total.queued > 0 && ` · ${total.queued} queued`}
              {total.active > 0 && ` · ${total.active} active`}
            </span>
            <span style={s.totalPct}>{total.pct}%</span>
          </div>
          <div style={s.totalBarBg}>
            <div className="bar-shimmer" style={{ ...s.totalBarFill, width: `${total.pct}%` }} />
          </div>
          <div style={s.totalFoot}>
            <span style={s.totalSub}>{formatBytes(total.doneBytes)} of {formatBytes(total.totalBytes)}</span>
            <label style={s.parallelToggle} title="Send multiple files at once (faster, uses more bandwidth)">
              <input
                type="checkbox"
                checked={(maxParallel || 1) > 1}
                onChange={(e) => onParallelChange?.(e.target.checked ? 3 : 1)}
                style={{ accentColor: "var(--primary)" }}
              />
              3× parallel
            </label>
          </div>
        </div>
      )}

      <QueuePanel queue={fileQueue} onRemove={onRemoveFromQueue} />

      <div style={s.tabRow}>
        <div className="tab-bar" style={{ flex: 1 }}>
          <button
            className={`tab-btn${tab === "transfers" ? " active" : ""}`}
            onClick={() => setTab("transfers")}
          >
            📁 Files {transfers.length > 0 && `· ${transfers.length}`}
          </button>
          <button
            className={`tab-btn${tab === "history" ? " active" : ""}`}
            onClick={() => setTab("history")}
          >
            🕘 History
          </button>
          <button
            className={`tab-btn${tab === "insights" ? " active" : ""}`}
            onClick={() => setTab("insights")}
          >
            📊 Stats
          </button>
        </div>
        {tab === "transfers" && transfers.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: "0.7rem", fontWeight: 700 }}
            onClick={onClearTransfers}
          >
            Clear
          </button>
        )}
      </div>

      <div style={s.tabContent} data-scrollable>
        {tab === "transfers" && (
          <div style={s.list}>
            {transfers.length === 0 && (
              <div className="empty-hint">
                <div className="empty-illust">📂</div>
                No transfers yet.<br />Drop files above to get started.
              </div>
            )}
            {[...transfers].reverse().map((t) => (
              <TransferItem
                key={t.id} transfer={t}
                canDownloadAgain={Boolean(completedBlobs?.[t.id])}
                onPause={() => handlePause(t)} onResume={() => handleResume(t)}
                onCancel={(id) => handleCancel(id, t.direction)}
                onRetry={onRetry}
                onDownloadAgain={onDownloadAgain}
              />
            ))}
          </div>
        )}
        {tab === "history" && (
          <HistoryPanel
            history={history} loading={historyLoading}
            rooms={rooms}
            currentRoom={roomCode}
            onClear={onClearHistory}
            onClearRoom={onClearRoomHistory}
            onRemove={onRemoveHistory}
          />
        )}
        {tab === "insights" && (
          <div style={s.list}>
            <SpeedGraph transfers={transfers} />
            <DiagnosticsPanel connected={connected} connStats={connStats} signalMode={signalMode} />
            <AnalyticsPanel history={history} transfers={transfers} />
          </div>
        )}
      </div>

      {peerError && (
        <div className={connected ? "warn" : "err"} style={{ flexShrink: 0, marginTop: "0.5rem" }}>
          {connected ? `Signalling: ${peerError}` : peerError}
        </div>
      )}
    </div>
  );

  return (
    <div className="room-wrap">

      <div className="room-header">
        <div className="room-header-card" title={headerTooltip}>
          <div className="avatar-stack">
            <span className="avatar me">Y</span>
            <span className={`avatar ${connected ? "peer" : "off"}`}>{connected ? "P" : "…"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, letterSpacing: "-0.01em" }}>
              Room {roomCode ? `#${roomCode}` : ""}
            </span>
            <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 600 }}>
              {reconnecting ? "Reconnecting…" : connected ? "2 online · encrypted" : "Waiting for peer…"}
            </span>
          </div>
          {roomCode && (
            <button
              className="room-code-badge"
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => navigator.clipboard?.writeText(roomCode).catch(() => {})}
              title="Copy code"
            >
              Copy code
            </button>
          )}
          <span
            style={{ fontSize: "0.85rem", cursor: "help", color: "var(--text-dim)" }}
            title={headerTooltip}
          >
            ⓘ
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {reconnecting ? (
            <div className="status-badge retry">
              <div className="spinner" />Reconnecting…
            </div>
          ) : (
            <div className={`status-badge ${connected ? "live" : "wait"}`}>
              <div className={connected ? "dot-live" : "dot-pulse"} />
              {connected ? "Connected" : "Waiting…"}
            </div>
          )}
          <button
            className="btn btn-outline btn-leave"
            onClick={onLeave}
            style={{ fontSize: "0.76rem", borderRadius: 999 }}
          >
            Leave
          </button>
        </div>
      </div>

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
            💬 Chat {chatCount > 0 && `· ${chatCount}`}
          </button>
        </div>
      </div>

      <div className="room-body">

        <div className="desktop-only">{filesPanel}</div>
        <div className="desktop-only">
          <ChatPanel messages={messages} peerTyping={peerTyping} connected={connected} onSend={onSendChat} onTyping={onTyping} />
        </div>

        <div className={`mobile-only${mobileTab === "files" ? "" : " mob-hidden"}`}>
          {filesPanel}
        </div>
        <div className={`mobile-only${mobileTab === "chat" ? "" : " mob-hidden"}`}>
          <ChatPanel messages={messages} peerTyping={peerTyping} connected={connected} onSend={onSendChat} onTyping={onTyping} />
        </div>

      </div>
    </div>
  );
}

const s = {
  leftPanel: { display: "flex", flexDirection: "column", gap: "0.75rem", overflow: "hidden", minHeight: 0, height: "100%", minWidth: 0 },
  totalCard: { borderRadius: 14, padding: "0.7rem 0.85rem", flexShrink: 0 },
  totalTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" },
  totalLabel: { fontSize: "0.74rem", fontWeight: 800 },
  totalPct: { fontSize: "0.74rem", fontWeight: 800, color: "var(--primary)", fontFamily: "'Geist Mono', monospace" },
  totalBarBg: { height: 8, background: "var(--surface-hover)", borderRadius: 99, overflow: "hidden", marginBottom: "0.4rem" },
  totalBarFill: { height: "100%", borderRadius: 99, transition: "width 0.3s ease" },
  totalFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  totalSub: { fontSize: "0.66rem", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" },
  parallelToggle: { display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", cursor: "pointer", userSelect: "none" },
  tabRow: { display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 },
  tabContent: { flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "0.75rem", boxShadow: "var(--shadow)" },
  list: { display: "flex", flexDirection: "column", gap: "0.55rem", overflowY: "auto", flex: 1, minWidth: 0 },
};
