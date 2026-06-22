import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { MediaProvider, useMedia } from '../context/MediaContext';
import YouTubePlayer from '../components/YouTubePlayer';
import SharedQueue from '../components/SharedQueue';
import Chat from '../components/Chat';
import ParticipantsList from '../components/ParticipantsList';
import ShareModal from '../components/ShareModal';
import FileShare from '../components/FileShare';
import VideoGrid from '../components/VideoGrid';
import Whiteboard from '../components/Whiteboard';
import GameManager from '../components/GameManager';
import ErrorBoundary from '../components/ErrorBoundary';

function RoomContent({
  room,
  setRoom,
  username,
  participants,
  messages,
  videoId,
  videoTitle,
  isAdmin,
  activeTab,
  setActiveTab,
  showShare,
  setShowShare,
  sidebarOpen,
  setSidebarOpen,
  handleLeave,
  handleKickUser,
  unreadMessages,
  queue,
}) {
  console.log('[VibeSync RoomContent] Rendering RoomContent component. Room name:', room?.roomName, 'Participants:', participants.length);
  const {
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    joinCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    isCameraLoading,
    isMicLoading,
  } = useMedia();

  const { socket } = useSocket();
  const { addToast } = useToast();
  const [activeMainView, setActiveMainView] = useState('youtube');

  // When video ends, signal server to advance queue
  const handleVideoEnd = useCallback(() => {
    if (!socket || !room?.roomId) return;
    socket.emit('queue:next', { roomId: room.roomId });
  }, [socket, room]);

  // Auto-join WebRTC call upon mounting and room details set
  useEffect(() => {
    if (!isInCall && room) {
      joinCall(false).catch((err) => {
        console.warn('[VibeSync] Auto WebRTC call join failed:', err.message);
      });
    }
  }, [isInCall, joinCall, room]);

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-[#0a0118] text-white flex flex-col relative pb-24">
      {/* ===== TOP BAR ===== */}
      <header className="bg-white/5 border-b border-white/10 backdrop-blur-xl px-4 py-3 z-30">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand & Room Info */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleLeave}
                className="flex items-center gap-2 group"
              >
                <div className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-blue-500 to-cyan-400 p-[1px] shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                  <div className="w-full h-full bg-[#0a0118] rounded-[11px] flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12h1.5l2-5 3 10 3-10 2 6 1.5-2H21" className="stroke-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                      <polygon points="10 8 16 12 10 16" className="fill-violet-400 stroke-none drop-shadow-[0_0_4px_rgba(167,139,250,0.6)]" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm sm:text-lg font-black bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent tracking-widest uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                  VibeSync
                </span>
              </button>
              <div className="w-px h-6 bg-white/10 hidden sm:block" />
              <div className="hidden sm:block min-w-0">
                <h2 className="text-sm font-bold text-gray-200 truncate">
                  {room?.roomName || 'Room'}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[11px] text-gray-400 font-medium">{participants.length} online</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Sidebar & Menu Trigger */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                title="Toggle Sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Room Code, Copy, Share, Admin Badge */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
            {/* Room Code Pill */}
            <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 px-3 py-1.5 rounded-2xl shadow-[0_0_12px_rgba(139,92,246,0.15)]">
              <span className="text-[10px] text-violet-400 uppercase tracking-widest font-bold">Room Code:</span>
              <span className="text-sm font-bold font-mono text-white tracking-widest select-all">{room?.roomId}</span>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room?.roomId || '');
                  addToast({ type: 'success', message: 'Room code copied!' });
                }}
                className="p-1 hover:bg-white/10 rounded-lg text-violet-400 hover:text-white transition-colors"
                title="Copy Room Code"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>

            {/* Share Room Button */}
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all text-xs font-semibold"
              title="Share Room Link"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Invite</span>
            </button>

            {/* Admin Badge */}
            {isAdmin && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-400 text-xs font-semibold shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                </svg>
                <span>Admin</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN LAYOUT CONTAINER ===== */}
      <div className="flex-1 flex overflow-hidden max-w-[1600px] w-full mx-auto p-4 gap-4">
        {/* 1. LEFT: Mode switcher vertical menu (desktop) */}
        <nav className="hidden lg:flex flex-col gap-4 bg-white/5 border border-white/10 p-3 rounded-3xl w-20 items-center justify-start py-6 shrink-0">
          <button
            onClick={() => setActiveMainView('youtube')}
            className={`p-3.5 rounded-2xl transition-all duration-300 group relative ${
              activeMainView === 'youtube'
                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                : 'border border-transparent text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Watch Party"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="absolute left-24 px-2 py-1 rounded bg-gray-950 border border-white/10 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
              Watch Party
            </span>
          </button>

          <button
            onClick={() => setActiveMainView('whiteboard')}
            className={`p-3.5 rounded-2xl transition-all duration-300 group relative ${
              activeMainView === 'whiteboard'
                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                : 'border border-transparent text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Whiteboard"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="absolute left-24 px-2 py-1 rounded bg-gray-950 border border-white/10 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
              Whiteboard
            </span>
          </button>

          <button
            onClick={() => setActiveMainView('games')}
            className={`p-3.5 rounded-2xl transition-all duration-300 group relative ${
              activeMainView === 'games'
                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                : 'border border-transparent text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Arcade Games"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="absolute left-24 px-2 py-1 rounded bg-gray-950 border border-white/10 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
              Arcade Games
            </span>
          </button>
        </nav>

        {/* 2. CENTER: Video/Stage area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pr-1 space-y-4">
          {/* Mobile responsive mode switcher (horizontal) */}
          <div className="flex lg:hidden bg-white/5 border border-white/10 p-1 rounded-2xl w-full shrink-0">
            <button
              onClick={() => setActiveMainView('youtube')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeMainView === 'youtube'
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-gray-400'
              }`}
            >
              📺 Watch Party
            </button>
            <button
              onClick={() => setActiveMainView('whiteboard')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeMainView === 'whiteboard'
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-gray-400'
              }`}
            >
              ✏️ Whiteboard
            </button>
            <button
              onClick={() => setActiveMainView('games')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeMainView === 'games'
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-gray-400'
              }`}
            >
              🎮 Arcade
            </button>
          </div>

          {/* WebRTC Video call streams grid */}
          <div className="flex flex-col gap-2 shrink-0">
            <VideoGrid localUsername={username} />
          </div>

          {/* Main Stage Viewports */}
          {activeMainView === 'youtube' && (
            <div className="flex flex-col lg:flex-row gap-4 flex-1">
              {/* Left: Player + Search */}
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                {/* Currently Playing title pill */}
                {videoTitle && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 border border-red-500/20 rounded-2xl shrink-0 animate-fade-in">
                    <svg className="w-4 h-4 text-red-400 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
                    </svg>
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest shrink-0">Now Playing</span>
                    <span className="text-xs text-gray-300 font-semibold truncate">{videoTitle}</span>
                  </div>
                )}

                {/* YouTube Player (with inline search for admin) */}
                <div className="flex-1 min-h-[280px]">
                  <YouTubePlayer
                    videoId={videoId}
                    socket={room ? socket : null}
                    roomId={room?.roomId}
                    isAdmin={isAdmin}
                    onVideoEnd={handleVideoEnd}
                  />
                </div>
              </div>

              {/* Right: Shared Queue sidebar (desktop) */}
              <div className="lg:w-72 xl:w-80 shrink-0 bg-gray-900/80 border border-white/10 rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: '420px', maxHeight: '700px' }}>
                <SharedQueue
                  queue={queue}
                  socket={socket}
                  roomId={room?.roomId}
                  videoId={videoId}
                  username={username}
                />
              </div>
            </div>
          )}

          {activeMainView === 'whiteboard' && (
            <div className="flex-1 flex flex-col min-h-[450px]">
              <Whiteboard roomId={room?.roomId} />
            </div>
          )}

          {activeMainView === 'games' && (
            <div className="flex-1 flex flex-col">
              <GameManager roomId={room?.roomId} />
            </div>
          )}
        </div>

        {/* 3. RIGHT: Sidebar tabs panel (Chat/People/Files) */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-40 w-80 lg:w-96 bg-gray-900 border-l lg:border border-white/10 lg:rounded-3xl flex flex-col transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:flex'
          } shrink-0`}
        >
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 left-4 p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white z-10"
            title="Close Panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Tab Selector */}
          <div className="flex border-b border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-bold transition-all relative ${
                activeTab === 'chat'
                  ? 'text-violet-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span>Chat</span>
                {unreadMessages > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] text-white font-black animate-pulse">
                    {unreadMessages}
                  </span>
                )}
              </span>
              {activeTab === 'chat' && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-3 text-sm font-bold transition-all relative ${
                activeTab === 'participants'
                  ? 'text-violet-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              People ({participants.length})
              {activeTab === 'participants' && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 py-3 text-sm font-bold transition-all relative ${
                activeTab === 'files'
                  ? 'text-violet-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Files
              {activeTab === 'files' && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? (
              <Chat
                messages={messages}
                socket={socket}
                roomId={room?.roomId}
                username={username}
              />
            ) : activeTab === 'participants' ? (
              <ParticipantsList
                participants={participants}
                adminId={room?.adminId}
                currentSocketId={socket?.id}
                onKick={handleKickUser}
              />
            ) : (
              <FileShare isAdmin={isAdmin} />
            )}
          </div>
        </aside>

        {/* Mobile sidebar backdrop overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* ===== BOTTOM FLOATING MEDIA CONTROLS BAR ===== */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/10 dark:bg-black/45 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-2xl z-40 shadow-violet-500/10">
        {/* Microphone Toggle */}
        <button
          onClick={toggleAudio}
          disabled={isMicLoading}
          className={`p-3 rounded-full border transition-all duration-300 ${
            isMicLoading ? 'opacity-50 cursor-wait' : ''
          } ${
            isAudioEnabled
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 hover:bg-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
              : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
          }`}
          title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
        >
          {isMicLoading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isAudioEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
            </svg>
          )}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={toggleVideo}
          disabled={isCameraLoading}
          className={`p-3 rounded-full border transition-all duration-300 ${
            isCameraLoading ? 'opacity-50 cursor-wait' : ''
          } ${
            isVideoEnabled
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 hover:bg-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
              : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
          }`}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraLoading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isVideoEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
            </svg>
          )}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`p-3 rounded-full border transition-all duration-300 ${
            isScreenSharing
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'
          }`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* End Call / Leave Room */}
        <button
          onClick={handleLeave}
          className="p-3 rounded-full border border-red-500/40 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all duration-300"
          title="End Call & Leave Room"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2 2m0 0l2 2m-2-2l-2 2m2-2l2-2M5 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          </svg>
        </button>
      </div>

      {/* Share Invite Modal */}
      {showShare && (
        <ShareModal
          roomId={room?.roomId}
          roomName={room?.roomName}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

function RoomInner() {
  const { roomCode } = useParams();
  const roomId = roomCode;
  console.log('[VibeSync RoomInner] Initializing RoomInner. useParams roomCode:', roomCode, 'roomId:', roomId);

  const navigate = useNavigate();
  const location = useLocation();
  const { socket, isConnected } = useSocket();
  const { addToast } = useToast();

  const [room, setRoom] = useState(null);
  const [username, setUsername] = useState('');
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [videoId, setVideoId] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [showShare, setShowShare] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default on mobile
  const [joined, setJoined] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [queue, setQueue] = useState([]);
  const lastSocketId = useRef(null);

  // Clear unread count when chat tab is focused
  useEffect(() => {
    if (activeTab === 'chat') {
      setUnreadMessages(0);
    }
  }, [activeTab]);

  // Join room on mount and auto-rejoin on reconnect
  useEffect(() => {
    console.log('[VibeSync RoomInner] join-room useEffect triggered. isConnected:', isConnected, 'socket:', socket?.id);
    if (!socket || !isConnected) return;
    if (socket.id === lastSocketId.current) {
      console.log('[VibeSync RoomInner] Already joined with this socket ID:', socket.id);
      return;
    }

    const storedUsername =
      location.state?.username || localStorage.getItem('vibesync-username') || 'Guest';
    const password =
      location.state?.password || localStorage.getItem(`vibesync-password-${roomId}`) || '';

    setUsername(storedUsername);
    console.log('[VibeSync RoomInner] Emitting join-room. roomId:', roomId, 'username:', storedUsername);

    socket.emit('join-room', { roomId, username: storedUsername, password }, (response) => {
      console.log('[VibeSync RoomInner] join-room callback response:', response);
      if (response?.error) {
        console.error('[VibeSync RoomInner] join-room callback returned error:', response.error);
        navigate('/', { state: { joinRoomCode: roomId, error: response.error } });
        return;
      }
      lastSocketId.current = socket.id;
      setJoined(true);
      console.log('[VibeSync RoomInner] Successfully set joined to true.');
    });
  }, [socket, isConnected, roomId, location.state, navigate]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = (data) => {
      console.log('[VibeSync RoomInner] Socket event: room-joined. data:', data);
      if (!data || !data.roomId) {
        console.error('[VibeSync RoomInner] Verify Firestore query result failed: invalid/missing room data!');
        addToast({ type: 'error', message: 'Failed to load valid room from database.' });
        navigate('/');
        return;
      }
      setRoom(data);
      setParticipants(data.participants || []);
      setVideoId(data.videoId || null);
      setVideoTitle(data.videoTitle || '');
      setIsAdmin(data.adminId === socket.id);
      if (data.messages) {
        setMessages(data.messages);
      }
      // Hydrate queue from room-joined payload
      if (data.queue) {
        setQueue(data.queue);
      }
    };

    const handleRoomCreated = (data) => {
      console.log('[VibeSync RoomInner] Socket event: room-created. data:', data);
      if (!data || !data.roomId) {
        console.error('[VibeSync RoomInner] Verify Firestore query result failed: invalid/missing created room data!');
        addToast({ type: 'error', message: 'Failed to initialize room in database.' });
        navigate('/');
        return;
      }
      setRoom(data);
      setIsAdmin(true);
    };

    const handleSyncState = ({ videoId: vid, videoTitle: title, queue: syncQueue }) => {
      console.log('[VibeSync RoomInner] Socket event: sync-state. videoId:', vid, 'title:', title);
      if (vid) setVideoId(vid);
      if (title) setVideoTitle(title);
      if (syncQueue) setQueue(syncQueue);
    };

    const handleQueueUpdated = ({ queue: updatedQueue }) => {
      console.log('[VibeSync RoomInner] Socket event: queue:updated. length:', updatedQueue?.length);
      setQueue(updatedQueue || []);
    };

    const handleUserJoined = (user) => {
      console.log('[VibeSync RoomInner] Socket event: user-joined. user:', user);
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === user.socketId)) return prev;
        return [...prev, user];
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          username: 'System',
          text: `${user.username} joined the room`,
          timestamp: new Date().toISOString(),
          reactions: {},
        },
      ]);
    };

    const handleUserLeft = ({ socketId, username: leftUser, reason }) => {
      console.log('[VibeSync RoomInner] Socket event: user-left. user:', leftUser, 'reason:', reason);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          username: 'System',
          text: `${leftUser} ${reason === 'kicked' ? 'was kicked from' : 'left'} the room`,
          timestamp: new Date().toISOString(),
          reactions: {},
        },
      ]);
    };

    const handleAdminTransferred = ({ newAdminId, newAdminUsername }) => {
      console.log('[VibeSync RoomInner] Socket event: admin-transferred. new admin:', newAdminUsername);
      setIsAdmin(socket.id === newAdminId);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          username: 'System',
          text: `${newAdminUsername} is now the room admin`,
          timestamp: new Date().toISOString(),
          reactions: {},
        },
      ]);
    };

    const handleVideoChanged = ({ videoId: vid, videoTitle: title }) => {
      console.log('[VibeSync RoomInner] Socket event: video-changed. videoId:', vid, 'title:', title);
      setVideoId(vid);
      setVideoTitle(title || '');
    };

    const handleNewMessage = (message) => {
      console.log('[VibeSync RoomInner] Socket event: new-message. message:', message);
      setMessages((prev) => [...prev, message]);
      setActiveTab((currTab) => {
        if (currTab !== 'chat') {
          setUnreadMessages((prevCount) => prevCount + 1);
        }
        return currTab;
      });
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      console.log('[VibeSync RoomInner] Socket event: reaction-updated. messageId:', messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    };

    const handleUserKicked = ({ reason }) => {
      console.log('[VibeSync RoomInner] Socket event: user-kicked. reason:', reason);
      addToast({ type: 'warning', message: reason || 'You have been kicked by the admin.' });
      navigate('/');
    };

    const handleError = ({ error: errMsg }) => {
      console.error('[VibeSync RoomInner] Socket event: error-occurred. error:', errMsg);
      addToast({ type: 'error', message: errMsg || 'Something went wrong.' });
    };

    socket.on('room-joined', handleRoomJoined);
    socket.on('room-created', handleRoomCreated);
    socket.on('sync-state', handleSyncState);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('admin-transferred', handleAdminTransferred);
    socket.on('video-changed', handleVideoChanged);
    socket.on('new-message', handleNewMessage);
    socket.on('reaction-updated', handleReactionUpdated);
    socket.on('user-kicked', handleUserKicked);
    socket.on('error-occurred', handleError);
    socket.on('queue:updated', handleQueueUpdated);

    return () => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('room-created', handleRoomCreated);
      socket.off('sync-state', handleSyncState);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('admin-transferred', handleAdminTransferred);
      socket.off('video-changed', handleVideoChanged);
      socket.off('new-message', handleNewMessage);
      socket.off('reaction-updated', handleReactionUpdated);
      socket.off('user-kicked', handleUserKicked);
      socket.off('error-occurred', handleError);
      socket.off('queue:updated', handleQueueUpdated);
    };
  }, [socket, navigate, addToast]);

  const handleLeave = useCallback(() => {
    console.log('[VibeSync RoomInner] Leaving room...');
    if (socket) socket.emit('leave-room');
    navigate('/');
  }, [socket, navigate]);

  const handleKickUser = useCallback(
    (targetSocketId) => {
      if (!socket) return;
      console.log('[VibeSync RoomInner] Admin kicking user:', targetSocketId);
      socket.emit('kick-user', { roomId, targetSocketId });
    },
    [socket, roomId]
  );

  if (!joined || !room) {
    console.log('[VibeSync RoomInner] Room state missing or not joined yet. Showing loading state.');
    return (
      <div className="min-h-screen bg-gray-900 dark:bg-[#0a0118] text-white flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-bold text-violet-400">Room Loading...</h2>
          <p className="text-gray-400 text-sm max-w-xs">
            Connecting to your synchronized watch party. If this takes too long, check if the room code is valid.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold text-gray-300"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  console.log('[VibeSync RoomInner] Rendering main room view. Room ID:', room.roomId);
  return (
    <MediaProvider socket={socket} roomId={roomId} username={username}>
      <RoomContent
        room={room}
        setRoom={setRoom}
        username={username}
        setUsername={setUsername}
        participants={participants}
        setParticipants={setParticipants}
        messages={messages}
        setMessages={setMessages}
        videoId={videoId}
        setVideoId={setVideoId}
        videoTitle={videoTitle}
        setVideoTitle={setVideoTitle}
        videoUrl={videoUrl}
        setVideoUrl={setVideoUrl}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showShare={showShare}
        setShowShare={setShowShare}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        joined={joined}
        setJoined={setJoined}
        handleLeave={handleLeave}
        handleKickUser={handleKickUser}
        unreadMessages={unreadMessages}
        queue={queue}
      />
    </MediaProvider>
  );
}

export default function Room() {
  console.log('[VibeSync Room] Rendering ErrorBoundary wrapped Room page');
  return (
    <ErrorBoundary>
      <RoomInner />
    </ErrorBoundary>
  );
}
