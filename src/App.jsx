// Triggering redeploy after rollback
import "./styles/global.css";
import { useCallback, useRef } from "react";
import { usePeer } from "./hooks/usePeer";
import { useHistory } from "./hooks/useHistory";
import HomeScreen from "./screens/HomeScreen";
import HostScreen from "./screens/HostScreen";
import JoinScreen from "./screens/JoinScreen";
import RoomScreen from "./screens/RoomScreen";
import FAQScreen from "./screens/FAQScreen";
import Branding from "./components/Branding";
import { useState, useEffect } from "react";

export default function App() {
  const {
    history, loading: historyLoading,
    rooms,
    addRecord, removeRecord,
    clearHistory, clearRoomHistory,
  } = useHistory();

  // Use a ref so onTransferComplete always reads the latest roomCode
  // without causing a circular dependency (roomCode comes from usePeer)
  const roomCodeRef = useRef("");

  const onTransferComplete = useCallback((t) => {
    addRecord({ ...t, roomCode: roomCodeRef.current });
  }, [addRecord]);

  const {
    screen, setScreen,
    roomCode, shareUrl,
    joinCode, setJoinCode,
    connected, reconnecting,
    messages,
    transfers, setTransfers,
    fileQueue,
    peerError, setPeerError,
    libsReady, isJoining,
    createRoom, joinRoom, joinStatus,
    queueFile, sendChat, sendTyping, leaveRoom,
    pauseTransfer, resumeTransfer, pauseReceive, resumeReceive,
    cancelTransfer, cancelReceive, retryTransfer, downloadAgain,
    removeFromQueue,
    connStats, signalMode, maxParallel, setMaxParallel,
    peerTyping, completedBlobs,
  } = usePeer({ onTransferComplete });

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  // Remember the last non-FAQ screen so Back never loops faq -> faq,
  // even if screen changes underneath (e.g. host -> room auto-transition).
  const [prevScreen, setPrevScreen] = useState("home");
  const lastNonFaqRef = useRef("home");
  useEffect(() => {
    if (screen !== "faq") lastNonFaqRef.current = screen;
  }, [screen]);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("droplink-theme");
      if (saved) return saved;
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch { return "light"; }
  });
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("droplink-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const navigateTo = (newScreen) => {
    if (newScreen === screen) return;
    // Never record faq as the return target — otherwise Back loops faq -> faq.
    if (screen !== "faq") setPrevScreen(screen);
    setScreen(newScreen);
  };

  const goBackFromFaq = () => {
    const target =
      prevScreen && prevScreen !== "faq" ? prevScreen : lastNonFaqRef.current;
    setScreen(target && target !== "faq" ? target : "home");
  };

  // Logo click: from FAQ just go back (don't kill an active room/host session);
  // otherwise leave the room as before.
  const handleLogoClick = () => {
    if (screen === "faq") goBackFromFaq();
    else leaveRoom();
  };

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <>
      <div className="bg-wrap" />

      {/* ── App shell topbar ── */}
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Branding onGoHome={handleLogoClick} compact />
          <div className="app-topbar-center">
            {screen === "room" && roomCode && (
              <>
                <span
                  className="room-code-badge"
                  title="Copy room code"
                  onClick={() => navigator.clipboard?.writeText(roomCode).catch(() => {})}
                >
                  #{roomCode}
                </span>
                <span className={`status-badge ${reconnecting ? "retry" : connected ? "live" : "wait"}`} style={{ boxShadow: "none" }}>
                  <span className={connected && !reconnecting ? "dot-live" : "dot-pulse"} />
                  {reconnecting ? "Reconnecting" : connected ? "Live" : "Connecting"}
                </span>
              </>
            )}
            {screen === "host" && roomCode && (
              <span className="room-code-badge">#{roomCode} · waiting for peer</span>
            )}
          </div>
          <div className="app-topbar-right">
            {shareUrl && (screen === "host" || screen === "room") && (
              <button className="btn btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: "0.74rem" }} onClick={copyShareLink} title="Copy invite link">
                {linkCopied ? "✓ Copied" : "Copy link"}
              </button>
            )}
            <button className="topbar-link" onClick={() => navigateTo("faq")} aria-label="Open FAQ">FAQ</button>
            <button
              className="btn-icon"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ width: 34, height: 34 }}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </header>

      <div className="layer" style={{ paddingBottom: "2.5rem" }}>
        {screen === "home" && (
          <HomeScreen
            onHost={createRoom}
            onJoin={() => { setPeerError(""); setScreen("join"); }}
            onLogoClick={leaveRoom}
            peerError={peerError}
            libsReady={libsReady}
          />
        )}

        {screen === "host" && (
          <HostScreen
            roomCode={roomCode}
            shareUrl={shareUrl}
            peerError={peerError}
            onLeave={leaveRoom}
          />
        )}

        {screen === "join" && (
          <JoinScreen
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onJoin={joinRoom}
            onBack={leaveRoom}
            peerError={peerError}
            libsReady={libsReady}
            isJoining={isJoining}
            joinStatus={joinStatus}
          />
        )}

        {screen === "room" && (
          <RoomScreen
            roomCode={roomCode}
            connected={connected}
            reconnecting={reconnecting}
            messages={messages}
            peerTyping={peerTyping}
            transfers={transfers}
            fileQueue={fileQueue}
            peerError={peerError}
            history={history}
            historyLoading={historyLoading}
            rooms={rooms}
            connStats={connStats}
            signalMode={signalMode}
            maxParallel={maxParallel}
            completedBlobs={completedBlobs}
            onQueueFile={queueFile}
            onSendChat={sendChat}
            onTyping={sendTyping}
            onLeave={leaveRoom}
            onClearTransfers={() => setTransfers([])}
            onPause={pauseTransfer}
            onResume={resumeTransfer}
            onPauseReceive={pauseReceive}
            onResumeReceive={resumeReceive}
            onCancelTransfer={cancelTransfer}
            onCancelReceive={cancelReceive}
            onRetry={retryTransfer}
            onDownloadAgain={downloadAgain}
            onParallelChange={setMaxParallel}
            onRemoveFromQueue={removeFromQueue}
            onClearHistory={clearHistory}
            onClearRoomHistory={clearRoomHistory}
            onRemoveHistory={removeRecord}
          />
        )}

        {screen === "faq" && (
          <FAQScreen onBack={goBackFromFaq} />
        )}

      </div>

      {screen !== "room" && (
        <footer style={{ textAlign: "center", padding: "0 1rem 1.25rem", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 500 }}>
            © 2026 droplink · Private peer-to-peer sharing · No uploads, no accounts
          </div>
        </footer>
      )}
    </>
  );
}