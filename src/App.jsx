// import "./styles/global.css";
// import { usePeer } from "./hooks/usePeer";
// import HomeScreen from "./screens/HomeScreen";
// import HostScreen from "./screens/HostScreen";
// import JoinScreen from "./screens/JoinScreen";
// import RoomScreen from "./screens/RoomScreen";

// export default function App() {
//   const {
//     screen, setScreen,
//     roomCode, shareUrl,
//     joinCode, setJoinCode,
//     connected,
//     messages,
//     transfers, setTransfers,
//     peerError, setPeerError,
//     libsReady,
//     createRoom,
//     joinRoom,
//     sendFile,
//     sendChat,
//     leaveRoom,
//   } = usePeer();

//   return (
//     <>
//       {/* Animated background */}
//       <div className="bg-wrap">
//         <div className="bg-grid" />
//         <div className="bg-orb bg-orb-1" />
//         <div className="bg-orb bg-orb-2" />
//         <div className="bg-orb bg-orb-3" />
//       </div>

//       <div className="layer">
//         {screen === "home" && (
//           <HomeScreen
//             onHost={createRoom}
//             onJoin={() => { setPeerError(""); setScreen("join"); }}
//             peerError={peerError}
//             libsReady={libsReady}
//           />
//         )}

//         {screen === "host" && (
//           <HostScreen
//             roomCode={roomCode}
//             shareUrl={shareUrl}
//             peerError={peerError}
//             onLeave={leaveRoom}
//           />
//         )}

//         {screen === "join" && (
//           <JoinScreen
//             joinCode={joinCode}
//             setJoinCode={setJoinCode}
//             onJoin={joinRoom}
//             onBack={() => { setPeerError(""); setScreen("home"); }}
//             peerError={peerError}
//             libsReady={libsReady}
//           />
//         )}

//         {screen === "room" && (
//           <RoomScreen
//             roomCode={roomCode}
//             connected={connected}
//             messages={messages}
//             transfers={transfers}
//             peerError={peerError}
//             onSendFile={sendFile}
//             onSendChat={sendChat}
//             onLeave={leaveRoom}
//             onClearTransfers={() => setTransfers([])}
//           />
//         )}
//       </div>
//     </>
//   );
// }

// import "./styles/global.css";
// import { useCallback } from "react";
// import { usePeer }    from "./hooks/usePeer";
// import { useHistory } from "./hooks/useHistory";
// import HomeScreen from "./screens/HomeScreen";
// import HostScreen from "./screens/HostScreen";
// import JoinScreen from "./screens/JoinScreen";
// import RoomScreen from "./screens/RoomScreen";

// export default function App() {
//   const { history, loading: histLoading, addRecord, removeRecord, clearHistory } = useHistory();

//   // Pass addRecord into usePeer so completed transfers auto-save
//   const onTransferComplete = useCallback((t) => {
//     addRecord(t);
//   }, [addRecord]);

//   const {
//     screen, setScreen,
//     roomCode, shareUrl,
//     joinCode, setJoinCode,
//     connected, reconnecting,
//     messages,
//     transfers, setTransfers,
//     fileQueue,
//     peerError, setPeerError,
//     libsReady,
//     createRoom, joinRoom,
//     queueFile, sendChat, leaveRoom,
//     pauseTransfer, resumeTransfer,
//     cancelTransfer, cancelReceive,
//     removeFromQueue,
//   } = usePeer({ onTransferComplete });

//   return (
//     <>
//       {/* Animated background */}
//       <div className="bg-wrap">
//         <div className="bg-orb bg-orb-1" />
//         <div className="bg-orb bg-orb-2" />
//         <div className="bg-orb bg-orb-3" />
//         <div className="bg-orb bg-orb-4" />
//       </div>

//       <div className="layer">
//         {screen === "home" && (
//           <HomeScreen
//             onHost={createRoom}
//             onJoin={() => { setPeerError(""); setScreen("join"); }}
//             peerError={peerError}
//             libsReady={libsReady}
//           />
//         )}

//         {screen === "host" && (
//           <HostScreen
//             roomCode={roomCode}
//             shareUrl={shareUrl}
//             peerError={peerError}
//             onLeave={leaveRoom}
//           />
//         )}

//         {screen === "join" && (
//           <JoinScreen
//             joinCode={joinCode}
//             setJoinCode={setJoinCode}
//             onJoin={joinRoom}
//             onBack={() => { setPeerError(""); setScreen("home"); }}
//             peerError={peerError}
//             libsReady={libsReady}
//           />
//         )}

//         {screen === "room" && (
//           <RoomScreen
//             roomCode={roomCode}
//             connected={connected}
//             reconnecting={reconnecting}
//             messages={messages}
//             transfers={transfers}
//             fileQueue={fileQueue}
//             peerError={peerError}
//             history={history}
//             onQueueFile={queueFile}
//             onSendChat={sendChat}
//             onLeave={leaveRoom}
//             onClearTransfers={() => setTransfers([])}
//             onPause={pauseTransfer}
//             onResume={resumeTransfer}
//             onCancelTransfer={cancelTransfer}
//             onCancelReceive={cancelReceive}
//             onRemoveFromQueue={removeFromQueue}
//             onClearHistory={clearHistory}
//             onRemoveHistory={removeRecord}
//           />
//         )}
//       </div>
//     </>
//   );
// }
import "./styles/global.css";
import { useCallback, useRef } from "react";
import { usePeer }    from "./hooks/usePeer";
import { useHistory } from "./hooks/Usehistory";
import HomeScreen from "./screens/HomeScreen";
import HostScreen from "./screens/HostScreen";
import JoinScreen from "./screens/JoinScreen";
import RoomScreen from "./screens/RoomScreen";

export default function App() {
  const {
    history,
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
    libsReady,
    createRoom, joinRoom,
    queueFile, sendChat, leaveRoom,
    pauseTransfer, resumeTransfer,
    cancelTransfer, cancelReceive,
    removeFromQueue,
  } = usePeer({ onTransferComplete });

  // Keep ref in sync with roomCode state
  roomCodeRef.current = roomCode;

  return (
    <>
      {/* Animated background */}
      <div className="bg-wrap">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="bg-orb bg-orb-4" />
      </div>

      <div className="layer">
        {screen === "home" && (
          <HomeScreen
            onHost={createRoom}
            onJoin={() => { setPeerError(""); setScreen("join"); }}
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
            onBack={() => { setPeerError(""); setScreen("home"); }}
            peerError={peerError}
            libsReady={libsReady}
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
      </div>
    </>
  );
}