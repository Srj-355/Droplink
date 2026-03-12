# ⚡ Droplink

Droplink is a fast, secure, and modern peer-to-peer (P2P) file transfer and chat web application built using **React** and **WebRTC** (via PeerJS). 

By leveraging WebRTC DataChannels, Droplink allows users to transfer files of any size directly to one another without the data ever touching a central server. All connections are end-to-end encrypted by default, and modern browser APIs are utilized to handle massive files smoothly without crashing your browser tab.

---

## ✨ Features

- **Direct P2P Transfers:** Files go straight from the sender to the receiver. No middleman, no cloud storage limits.
- **Resumable & Fault-Tolerant:** If the connection drops mid-transfer, Droplink will automatically attempt to reconnect and resume the file transfer exactly where it left off.
- **Large File Support (Streaming):** Automatically detects if your browser supports the File System Access API (`showSaveFilePicker`). If supported, it streams the incoming chunks directly to your disk, ensuring your RAM never overloads—even for massive gigabyte transfers.
- **Intelligent Flow Control:** Implements back-pressure watermarks. If the sender is reading files from disk faster than the network can send them, Droplink automatically pauses reading to prevent out-of-memory crashes.
- **Pause & Cancel:** Fully bi-directional control. The sender can pause/resume or cancel a transfer, and the receiver can cancel incoming transfers. Both sides are kept perfectly in sync.
- **Real-Time Chat:** A built-in chat panel allows you to coordinate and talk with the peer you are connected to.
- **History Tracking:** Keeps a local history log of all completed, failed, and cancelled transfers across different room sessions.

---

## 🏗️ Architecture & Flow Structure

The application is structured into clearly defined React components and custom hooks for managing complex WebRTC logic.

### 1. User Journey Flow
- **Home Screen:** The entry point. The user can choose to either **Host** a room or **Join** a room.
- **Host Screen:** The app generates a unique, short Room Code and a shareable URL. The host waits on this screen until a peer connects.
- **Join Screen:** The peer enters the Room Code (or is automatically routed here via the shareable URL) to initiate the connection.
- **Room Screen:** Once the WebRTC connection is established, both users are taken to the active room. Here they can queue files via the `DropZone`, monitor active transfers, review history, and chat.

### 2. Core Technical Hooks
- **`usePeer.js` (The Engine):** This is the heart of Droplink. It handles WebRTC connections, STUN/TURN ICE candidate gathering, and the binary framing protocol used to send files over the DataChannel. It parses JSON control limits (like chat messages or metadata) and binary chunks (file data). It also handles the complex logic for streaming, pausing, resuming, and tracking real-time metrics (Speed and ETA).
- **`useHistory.js`:** Manages reading and writing transfer history to the browser's `localStorage`.

### 3. Application State
The state is highly localized within the hooks. `App.jsx` acts as the orchestrator, taking the state variables emitted by `usePeer` (like `connected`, `fileQueue`, `transfers`, `messages`) and passing them down as props to the UI screens.

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Srj-355/Droplink.git
   ```
2. Navigate into the project directory:
   ```bash
   cd droplink
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173` (or the port specified in your terminal).

---

## 🛠️ Configuration
Droplink defaults to utilizing standard public ICE servers (Google STUN) and the default PeerJS public matching cloud. 

If you wish to run a private signaling server or supply your own TURN servers for better strict-NAT bypassing, you can modify the configuration inside `src/constants.js`:
- Toggle `USE_CUSTOM_PEER_SERVER` to `true`.
- Update the `PEER_SERVER` object with your server's host, port, and path.
- Update the `ICE_SERVERS` array with your custom STUN/TURN credentials.

---

## 📱 Responsive & Mobile Friendly
The UI is fully responsive. On desktop, it features a dual-pane layout (Transfers + Chat side-by-side). On mobile devices, an intuitive tab bar allows users to seamlessly switch between the core file panel and the chat panel, making P2P transfers possible directly from your phone.
