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
import { useState } from "react";

const footerStyle = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  padding: "0.8rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.2rem",
  zIndex: 100,
  pointerEvents: "none",
  background: "linear-gradient(to top, rgba(232,244,248,0.8), transparent)",
  backdropFilter: "blur(4px)",
};

const footerContentStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.8rem",
  pointerEvents: "auto",
};

const footerLinkStyle = {
  fontSize: "0.65rem",
  fontWeight: 700,
  color: "var(--text-dim)",
  cursor: "pointer",
  transition: "all 0.2s",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "0.2rem 0.5rem",
};

const footerCopyrightStyle = {
  fontSize: "0.55rem",
  color: "var(--text-dim)",
  opacity: 0.6,
  fontWeight: 500,
};

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
    createRoom, joinRoom,
    queueFile, sendChat, leaveRoom,
    pauseTransfer, resumeTransfer,
    cancelTransfer, cancelReceive,
    removeFromQueue,
  } = usePeer({ onTransferComplete });

  // Keep ref in sync with roomCode state
  roomCodeRef.current = roomCode;

  const [prevScreen, setPrevScreen] = useState("home");

  const navigateTo = (newScreen) => {
    setPrevScreen(screen);
    setScreen(newScreen);
  };

  return (
    <>
      {/* Animated background */}
      <div className="bg-wrap">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="bg-orb bg-orb-4" />
      </div>

      <div className="layer" style={{ paddingBottom: "3.5rem" }}>
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
          />
        )}

        {screen === "room" && (
          <RoomScreen
            roomCode={roomCode}
            connected={connected}
            reconnecting={reconnecting}
            messages={messages}
            transfers={transfers}
            fileQueue={fileQueue}
            peerError={peerError}
            history={history}
            historyLoading={historyLoading}
            rooms={rooms}
            onQueueFile={queueFile}
            onSendChat={sendChat}
            onLeave={leaveRoom}
            onClearTransfers={() => setTransfers([])}
            onPause={pauseTransfer}
            onResume={resumeTransfer}
            onCancelTransfer={cancelTransfer}
            onCancelReceive={cancelReceive}
            onRemoveFromQueue={removeFromQueue}
            onClearHistory={clearHistory}
            onClearRoomHistory={clearRoomHistory}
            onRemoveHistory={removeRecord}
          />
        )}

        {screen === "faq" && (
          <FAQScreen onBack={() => setScreen(prevScreen)} />
        )}

      </div>

      {screen !== "faq" && (
        <footer style={footerStyle}>
          <div style={footerContentStyle}>
            <span style={footerLinkStyle} onClick={() => navigateTo("faq")}>FAQ</span>
          </div>
          <div style={footerCopyrightStyle}>
            © 2026 Droplink • Secure P2P
          </div>
        </footer>
      )}
    </>
  );
}