# VibeSync — Collaborative Watch Party, Live WebRTC Call & Arcade Platform

VibeSync is a production-ready, feature-rich full-stack web application designed for synchronized YouTube video watch parties, group voice/video calls, screen sharing, real-time whiteboards, and multiplayer arcade games. Built with a premium, responsive glassmorphic UI, it provides seamless real-time interactions with zero account registrations required.

---

## 🌟 Key Features

### 📺 Watch Party (Sync Engine)
- **Synchronized Playback**: Play, pause, and seek actions are synchronized frame-accurately across all connected participants.
- **YouTube Link Parser**: Automatically extracts YouTube IDs from all standard watch, youtu.be, shorts, embeds, and mobile links.
- **Auto-Sync**: New joiners automatically sync to the current timestamp and state of the video.
- **Custom Player Controls**: Floating custom layout for volume controls, progress bar seeking, and fullscreen toggles.
- **Anti-Feedback Loop**: Throttling and state validation prevent local sync adjustments from re-broadcasting, avoiding event loops.

### 🎙️ WebRTC Voice & Video Calls
- **Full Mesh Video Grid**: Supports group calls. Stream views adapt dynamically to fit participants.
- **Camera & Mic Muting**: Toggle states, instantly broadcasting mute status icons to all room members.
- **Screen Sharing**: Stream full desktop displays, specific app windows, or single browser tabs with automatic renegotiation when switching between camera and screen.
- **Device Selection Settings**: Configure active inputs for cameras and microphones.
- **Pin & Fullscreen Toggles**: Pin any participant's stream (webcam or screen share) to make it the prominent center focus, or expand any stream to native device fullscreen.

### ✏️ Collaborative Whiteboard
- **High-DPI Drawing Board**: Collaborative `<canvas>` with mouse/touch tracking.
- **Design Tools**: Pencil tool with continuous path stroke interpolation, eraser mode, brush sizing slider, and predefined color palettes with a custom color picker.
- **P2P History Synchronization**: New room joiners automatically fetch the full drawing board stroke history from active peers in the room.

### 🎮 Multiplayer Games
- **Multiplayer Hub**: Seamlessly switch between Watch Party, Whiteboard, and Arcade.
- **Tic Tac Toe**: Real-time board grid clicks, slot selections (Player X vs Player O), spectator support, win/draw state machine, and board resets.
- **Rock Paper Scissors**: Real-time choice submission, masks choices until both plays are entered, determines winners, increments scores, and handles resets.

### 💬 Real-Time Chat & File Sharing
- **Live Text Chat**: Real-time messaging with colored user indicators, auto-scroll focus, and timestamps.
- **Emoji Board**: 7-category emoji reaction picker with message reaction counter toggles.
- **File Transfer**: Sharing for images and PDF files (10MB maximum limit) using Base64 URI transfers.

### 🔒 Security & Optimization
- **Input Sanitization**: Filters and escapes all inputs (usernames, room names, messages) to prevent Cross-Site Scripting (XSS) injection.
- **WS Rate Limiting**: In-memory message bucket limits socket message frequencies to 35 messages per 5-seconds window to block DDoS/flood abuse.
- **Firestore Integrity**: Automatic schema validation, admin elevation promotion when creators leave, and complete room/message cleanup batches when rooms become empty.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|------|--------------|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, Socket.IO Client, HTML5 Canvas, WebRTC API |
| **Backend** | Node.js, Express 4, Socket.IO 4 |
| **Database** | Firebase Firestore (Admin SDK) |
| **Deployment** | Vercel (Frontend), Render (Backend) |

---

## 📁 Project Structure

```
vibesync/
├── vercel.json                 # Vercel SPA configuration
├── render.yaml                 # Render deployment configuration
├── client/                     # FRONTEND
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js      # Custom theme, glassmorphic shadows, animations
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx             # React routing & providers
│       ├── App.css
│       ├── index.css           # Global custom classes, blobs, scrollbars
│       ├── context/
│       │   ├── ThemeContext.jsx    # Light / Dark mode
│       │   ├── SocketContext.jsx   # Live WebSocket connection
│       │   ├── ToastContext.jsx    # Toast notification engine
│       │   └── MediaContext.jsx    # WebRTC connection mesh & devices
│       ├── components/
│       │   ├── Navbar.jsx          # Interactive global navbar
│       │   ├── Toast.jsx           # Animated alert banners
│       │   ├── ShareModal.jsx      # Copy code/link window
│       │   ├── Chat.jsx            # Emoji selector, reactions, messages
│       │   ├── ParticipantsList.jsx# Online list, Kick button
│       │   ├── YouTubePlayer.jsx   # Sync video frame controller
│       │   ├── VideoGrid.jsx       # Camera/Screen grids, Pinned focus
│       │   ├── MediaControls.jsx   # WebRTC control buttons
│       │   ├── DeviceSettingsModal.jsx # Mic/Camera selector
│       │   ├── FileShare.jsx       # Document/Image sharing list
│       │   ├── Whiteboard.jsx      # HTML5 canvas drawing
│       │   ├── TicTacToe.jsx       # Multiplayer TicTac Board
│       │   └── RockPaperScissors.jsx# Choice game with score sync
│       ├── pages/
│       │   ├── Home.jsx            # Landing, Join/Create room
│       │   └── Room.jsx            # Central workspace layout
│       └── utils/
│           └── youtube.js          # YouTube URL extractor
└── server/                     # BACKEND
    ├── package.json
    ├── server.js               # Express API and HTTP configuration
    ├── config/
    │   └── firebase.js         # Firebase Firestore Initialization
    └── handlers/
        └── socketHandlers.js   # Room lifecycle, WebRTC, Games, Security
```

---

## 💻 Local Setup & Development

### 1. Firebase Firestore Setup
1. Create a Firebase project at the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Cloud Firestore** database.
3. Generate service account credentials:
   - Navigate to **Project Settings** -> **Service Accounts**.
   - Click **Generate new private key** and download the JSON file.

### 2. Backend Installation
1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in the Firebase details:
   - Paste the service account values (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
   - *Note*: Ensure private key newlines (`\n`) are escaped correctly in a single string.
4. Install dependencies and start the server:
   ```bash
   npm install
   npm run dev
   ```

### 3. Frontend Installation
1. Open a new terminal and navigate to the `client/` directory:
   ```bash
   cd ../client
   ```
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Set the environment API link:
   ```env
   VITE_SERVER_URL=http://localhost:3001
   ```
4. Install dependencies and run in development mode:
   ```bash
   npm install
   npm run dev
   ```
5. Open **http://localhost:5173** to test!

---

## 🚀 Production Deployment Instructions

### 📦 Backend Deployment (Render)

Render is highly optimized for hosting Node/Socket.IO servers. We have provided a [render.yaml](file:///C:/Users/Halith/.gemini/antigravity/scratch/vibesync/render.yaml) file to automate this setup.

#### Web Dashboard Steps:
1. Push your codebase to a GitHub or GitLab repository.
2. Sign in to [Render](https://render.com/).
3. Click **New** -> **Web Service**.
4. Connect your repository.
5. Configure these fields:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
6. Add the following **Environment Variables** in the dashboard:
   - `PORT`: `3001`
   - `CLIENT_URL`: `https://your-frontend-domain.vercel.app`
   - `FIREBASE_PROJECT_ID`: *your-project-id*
   - `FIREBASE_CLIENT_EMAIL`: *your-service-account-email*
   - `FIREBASE_PRIVATE_KEY`: *your-private-key-with-escaped-newlines*
7. Deploy the service. Take note of the Render URL (e.g. `https://vibesync-backend.onrender.com`).

---

### 📦 Frontend Deployment (Vercel)

Vercel is optimized for React/Vite single page applications. We have provided a [vercel.json](file:///C:/Users/Halith/.gemini/antigravity/scratch/vibesync/vercel.json) file to route all path requests to `index.html` (SPA routing).

#### Dashboard Steps:
1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New** -> **Project**.
3. Select your codebase repository.
4. Configure these fields:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:
   - `VITE_SERVER_URL`: `https://vibesync-backend.onrender.com` (Your Render URL)
6. Click **Deploy**. Vercel will build and serve your static React client.

---

## ⚡ Free Hosting Optimizations

Hosting full-stack real-time WebRTC signaling on free plans requires smart performance boundaries. VibeSync implements several optimizations to guarantee smooth performance:

1. **Self-Cleanups**: Socket.IO automatically cleans up disconnected players. If the last user leaves a room, the server executes a Cloud Firestore batch delete to clear out the room document and message subcollection, keeping database storage usage at 0 when idle.
2. **WebSocket Fallback Transport**: Vite client initiates connections directly with `transports: ['websocket', 'polling']` to bypass free-tier proxy buffers and guarantee instantaneous signaling.
3. **No Heavy Binary Storage**: File sharing converts files directly to Base64 in-memory chunks and broadcasts them down socket pipelines. This removes the need for persistent cloud storage servers (like AWS S3 or Firebase Storage), bypassing storage limits.
4. **ICE Candidate Queuing**: WebRTC peer states queue ICE candidates in memory until the peer connection remote session description descriptions are parsed, ensuring connection handshakes don't fail due to slow free-tier server responses.
5. **Auto-Promote Admin**: If a room admin disconnects (e.g. Render server restarts or sleeps), the server immediately promotes the next oldest room participant, maintaining room state integrity.
