import { useState, useRef, useEffect } from 'react';
import { useMedia } from '../context/MediaContext';

function VideoStream({ stream, username, isLocal = false, isAudioEnabled = true, isVideoEnabled = true }) {
  const videoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="relative w-full h-full bg-black/60 rounded-xl overflow-hidden shadow-lg border border-white/10 group flex items-center justify-center">
      {/* Video Element */}
      {isVideoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-white space-y-2">
          <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xl font-bold uppercase">
            {username.slice(0, 2)}
          </div>
          <span className="text-sm font-medium text-gray-300">Camera Off</span>
        </div>
      )}

      {/* Top Left info overlay */}
      <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 border border-white/5">
        <span className={`w-1.5 h-1.5 rounded-full ${isAudioEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
        {username} {isLocal && '(You)'}
      </div>

      {/* Control overlay */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
        {/* Fullscreen control */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-black/55 hover:bg-black/80 text-white backdrop-blur-md transition-colors"
          title="Fullscreen"
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l4-1m-4 1v4m16-4l-5 5m5-5l-4-1m4 1v4m-16 16l5-5m-5 5l4 1m-4-1v-4m16 4l-5-5m5 5l-4 1m4-1v-4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          )}
        </button>
      </div>

      {/* Indicator for Muted Microphone */}
      {!isAudioEnabled && (
        <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/80 text-white shadow-md">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2.5} />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function VideoGrid({ localUsername }) {
  const {
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    localStream,
    remoteStreams,
    pinnedPeer,
    setPinnedPeer,
  } = useMedia();

  if (!isInCall) return null;

  // Convert map to array for display
  const remotes = Array.from(remoteStreams.entries()).map(([peerId, data]) => ({
    id: peerId,
    ...data,
  }));

  const pinnedStream = pinnedPeer
    ? pinnedPeer === 'local'
      ? { id: 'local', stream: localStream, username: localUsername, isLocal: true, audioEnabled: isAudioEnabled, videoEnabled: isVideoEnabled }
      : remotes.find((r) => r.id === pinnedPeer)
    : null;

  const normalStreams = pinnedPeer
    ? [
        ...(pinnedPeer !== 'local' ? [{ id: 'local', stream: localStream, username: localUsername, isLocal: true, audioEnabled: isAudioEnabled, videoEnabled: isVideoEnabled }] : []),
        ...remotes.filter((r) => r.id !== pinnedPeer),
      ]
    : [
        { id: 'local', stream: localStream, username: localUsername, isLocal: true, audioEnabled: isAudioEnabled, videoEnabled: isVideoEnabled },
        ...remotes,
      ];

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in">
      {pinnedStream ? (
        /* Pinned Layout: Main stream full size, mini grid beneath/aside */
        <div className="flex flex-col lg:flex-row gap-4 h-[500px]">
          {/* Main Pinned Video */}
          <div className="flex-1 relative h-full">
            <VideoStream
              stream={pinnedStream.stream}
              username={pinnedStream.username}
              isLocal={pinnedStream.isLocal}
              isAudioEnabled={pinnedStream.audioEnabled !== false}
              isVideoEnabled={pinnedStream.videoEnabled !== false}
            />
            <button
              onClick={() => setPinnedPeer(null)}
              className="absolute top-3 right-12 bg-black/50 hover:bg-black/75 text-white backdrop-blur-md px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              Unpin
            </button>
          </div>

          {/* Sidebar Grid */}
          <div className="w-full lg:w-60 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[140px] lg:max-h-full p-1">
            {normalStreams.map((s) => (
              <div
                key={s.id}
                className="w-40 lg:w-full h-24 lg:h-32 flex-shrink-0 cursor-pointer border-2 border-transparent hover:border-brand-500/50 rounded-xl overflow-hidden transition-all"
                onClick={() => setPinnedPeer(s.id)}
              >
                <VideoStream
                  stream={s.stream}
                  username={s.username}
                  isLocal={s.isLocal}
                  isAudioEnabled={s.audioEnabled !== false}
                  isVideoEnabled={s.videoEnabled !== false}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Normal Equal Grid Layout */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div
            className="aspect-video cursor-pointer border-2 border-transparent hover:border-brand-500/50 rounded-xl overflow-hidden transition-all"
            onClick={() => setPinnedPeer('local')}
          >
            <VideoStream
              stream={localStream}
              username={localUsername}
              isLocal={true}
              isAudioEnabled={isAudioEnabled}
              isVideoEnabled={isVideoEnabled}
            />
          </div>
          {remotes.map((s) => (
            <div
              key={s.id}
              className="aspect-video cursor-pointer border-2 border-transparent hover:border-brand-500/50 rounded-xl overflow-hidden transition-all"
              onClick={() => setPinnedPeer(s.id)}
            >
              <VideoStream
                stream={s.stream}
                username={s.username}
                isLocal={false}
                isAudioEnabled={s.audioEnabled !== false}
                isVideoEnabled={s.videoEnabled !== false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
