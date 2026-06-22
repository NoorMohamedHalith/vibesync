import { useEffect, useRef, useState, useCallback } from 'react';

const SERVER_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://vibesync-wpoa.onrender.com');

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)/.test(url);
}

function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function YouTubePlayer({ videoId, socket, roomId, isAdmin, onVideoEnd }) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const isSyncing = useRef(false);
  const playerReady = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);
  const timeUpdateInterval = useRef(null);

  // Inline search bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchInputRef = useRef(null);
  const searchAbortRef = useRef(null);

  const formatTime = (seconds) => {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
  }, []);

  // Initialize player when videoId changes
  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        playerReady.current = false;
      }

      playerRef.current = new window.YT.Player('yt-player', {
        videoId,
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            playerReady.current = true;
            setDuration(event.target.getDuration());
            event.target.setVolume(volume);
            if (socket) socket.emit('sync-request', { roomId });
          },
          onStateChange: (event) => {
            if (isSyncing.current) return;
            const state = event.data;
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              const time = event.target.getCurrentTime();
              if (socket) socket.emit('play-video', { roomId, currentTime: time });
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              const time = event.target.getCurrentTime();
              if (socket) socket.emit('pause-video', { roomId, currentTime: time });
            } else if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (onVideoEnd) onVideoEnd();
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    };
  }, [videoId]);

  // Time tracking interval
  useEffect(() => {
    if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current && playerReady.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
        setDuration(playerRef.current.getDuration() || 0);
      }
    }, 500);
    return () => clearInterval(timeUpdateInterval.current);
  }, [videoId]);

  // Socket event listeners for sync
  useEffect(() => {
    if (!socket) return;

    const handleVideoPlayed = ({ currentTime: time }) => {
      if (!playerRef.current || !playerReady.current) return;
      isSyncing.current = true;
      playerRef.current.seekTo(time, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
      setCurrentTime(time);
      setTimeout(() => { isSyncing.current = false; }, 500);
    };

    const handleVideoPaused = ({ currentTime: time }) => {
      if (!playerRef.current || !playerReady.current) return;
      isSyncing.current = true;
      playerRef.current.seekTo(time, true);
      playerRef.current.pauseVideo();
      setIsPlaying(false);
      setCurrentTime(time);
      setTimeout(() => { isSyncing.current = false; }, 500);
    };

    const handleVideoSeeked = ({ currentTime: time }) => {
      if (!playerRef.current || !playerReady.current) return;
      isSyncing.current = true;
      playerRef.current.seekTo(time, true);
      setCurrentTime(time);
      setTimeout(() => { isSyncing.current = false; }, 500);
    };

    const handleSyncState = ({ videoState, currentTime: time }) => {
      if (!playerRef.current || !playerReady.current) return;
      isSyncing.current = true;
      playerRef.current.seekTo(time || 0, true);
      if (videoState === 'playing') {
        playerRef.current.playVideo();
        setIsPlaying(true);
      } else {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
      setCurrentTime(time || 0);
      setTimeout(() => { isSyncing.current = false; }, 500);
    };

    const handleVideoChanged = ({ videoId: newVideoId }) => {
      if (playerRef.current && playerReady.current) {
        isSyncing.current = true;
        playerRef.current.loadVideoById(newVideoId);
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        setCurrentTime(0);
        setTimeout(() => { isSyncing.current = false; }, 1000);
      }
    };

    socket.on('video-played', handleVideoPlayed);
    socket.on('video-paused', handleVideoPaused);
    socket.on('video-seeked', handleVideoSeeked);
    socket.on('sync-state', handleSyncState);
    socket.on('video-changed', handleVideoChanged);

    return () => {
      socket.off('video-played', handleVideoPlayed);
      socket.off('video-paused', handleVideoPaused);
      socket.off('video-seeked', handleVideoSeeked);
      socket.off('sync-state', handleSyncState);
      socket.off('video-changed', handleVideoChanged);
    };
  }, [socket, roomId]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current || !playerReady.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e) => {
    if (!playerRef.current || !playerReady.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;
    isSyncing.current = true;
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
    if (socket) socket.emit('seek-video', { roomId, currentTime: time });
    setTimeout(() => { isSyncing.current = false; }, 500);
  }, [duration, socket, roomId]);

  const skipForward = useCallback(() => {
    if (!playerRef.current || !playerReady.current) return;
    const time = Math.min((playerRef.current.getCurrentTime() || 0) + 5, duration);
    isSyncing.current = true;
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
    if (socket) socket.emit('seek-video', { roomId, currentTime: time });
    setTimeout(() => { isSyncing.current = false; }, 500);
  }, [duration, socket, roomId]);

  const skipBackward = useCallback(() => {
    if (!playerRef.current || !playerReady.current) return;
    const time = Math.max((playerRef.current.getCurrentTime() || 0) - 5, 0);
    isSyncing.current = true;
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
    if (socket) socket.emit('seek-video', { roomId, currentTime: time });
    setTimeout(() => { isSyncing.current = false; }, 500);
  }, [socket, roomId]);

  const replay = useCallback(() => {
    if (!playerRef.current || !playerReady.current) return;
    isSyncing.current = true;
    playerRef.current.seekTo(0, true);
    playerRef.current.playVideo();
    setCurrentTime(0);
    setIsPlaying(true);
    if (socket) socket.emit('seek-video', { roomId, currentTime: 0 });
    if (socket) socket.emit('play-video', { roomId, currentTime: 0 });
    setTimeout(() => { isSyncing.current = false; }, 500);
  }, [socket, roomId]);

  const handleVolumeChange = useCallback((e) => {
    const vol = parseInt(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (playerRef.current && playerReady.current) {
      playerRef.current.setVolume(vol);
      playerRef.current.unMute();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current || !playerReady.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume || 80);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── Inline Search ─────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setSearchError('');

    // Direct URL paste
    if (isYouTubeUrl(q)) {
      if (socket) {
        socket.emit('video-change', { roomId, videoUrl: q.trim(), videoTitle: 'YouTube Video' });
      }
      setSearchQuery('');
      setShowSearch(false);
      return;
    }

    if (searchAbortRef.current) searchAbortRef.current.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearchLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/youtube/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) setSearchError('No results found');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSearchError('Search failed. Try pasting a direct link.');
      }
    } finally {
      setSearchLoading(false);
    }
  }, [socket, roomId]);

  const selectSearchResult = useCallback((video) => {
    if (!socket) return;
    socket.emit('video-change', {
      roomId,
      videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoTitle: video.title,
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  }, [socket, roomId]);

  const handleSearchInput = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchError('');
    // Auto-load if YouTube URL pasted
    if (isYouTubeUrl(val)) {
      if (socket) {
        socket.emit('video-change', { roomId, videoUrl: val.trim(), videoTitle: 'YouTube Video' });
      }
      setSearchQuery('');
      setShowSearch(false);
    }
  }, [socket, roomId]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ── Inline Search Bar (always visible for admin) ── */}
      {isAdmin && (
        <div className="relative">
          <form
            onSubmit={(e) => { e.preventDefault(); doSearch(searchQuery); setShowSearch(searchResults.length > 0 || searchLoading); }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={() => searchResults.length > 0 && setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                placeholder="Search videos or Paste YouTube Link"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 rounded-2xl text-sm text-gray-200 placeholder-gray-500 outline-none transition-all"
                id="youtube-search-input"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading || !searchQuery.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-2xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
            >
              {searchLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
                </svg>
              )}
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {/* Search Dropdown */}
          {showSearch && (searchResults.length > 0 || searchError) && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-gray-950/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-80 overflow-y-auto">
              {searchError && (
                <p className="px-4 py-3 text-xs text-red-400">{searchError}</p>
              )}
              {searchResults.map((video) => (
                <button
                  key={video.videoId}
                  onMouseDown={() => selectSearchResult(video)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors text-left group"
                >
                  <div className="relative w-16 aspect-video rounded-lg overflow-hidden shrink-0 bg-black">
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                    {video.duration && (
                      <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/80 text-white px-1 rounded font-mono">
                        {video.duration}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-200 line-clamp-1 group-hover:text-violet-300 transition-colors">
                      {video.title}
                    </p>
                    <p className="text-[10px] text-gray-500">{video.channel}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Video Player ── */}
      {!videoId ? (
        <div className="relative w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg font-medium">No video loaded</p>
            <p className="text-gray-500 text-sm mt-1">
              {isAdmin ? 'Search above or paste a YouTube link to start watching' : 'Waiting for admin to load a video...'}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {/* YouTube Player */}
          <div id="yt-player" className="absolute inset-0 w-full h-full" />

          {/* Click overlay for play/pause */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={togglePlay}
          />

          {/* Play/Pause center indicator */}
          <div className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
            !isPlaying && showControls ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Controls overlay */}
          <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

            <div className="relative px-4 pb-4 pt-8">
              {/* Progress bar */}
              <div
                className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full relative transition-all"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Skip Back 5s */}
                <button
                  onClick={skipBackward}
                  className="p-1.5 text-white/70 hover:text-white transition-colors"
                  title="Rewind 5s"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11H10v-3.26L9 13.12V12.2l1.8-.63h.1V16zm4.16 0H13.9v-.7l1.5-1.51c.18-.18.27-.37.27-.56a.34.34 0 0 0-.08-.24.32.32 0 0 0-.23-.08.37.37 0 0 0-.28.1.44.44 0 0 0-.1.31h-1.12c.01-.3.08-.55.22-.75.14-.2.33-.36.58-.46.24-.11.52-.16.83-.16.31 0 .58.05.81.16.23.1.41.25.54.44.12.19.19.41.19.65 0 .22-.06.43-.17.63-.11.2-.3.42-.56.66l-.74.75H17V16z" />
                  </svg>
                </button>

                {/* Play/Pause */}
                <button onClick={togglePlay} className="p-2 text-white hover:text-violet-400 transition-colors">
                  {isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Skip Forward 5s */}
                <button
                  onClick={skipForward}
                  className="p-1.5 text-white/70 hover:text-white transition-colors"
                  title="Forward 5s"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 9.3l-4.5-2.6v2.1L9 6.1V2L4.5 6.1l4.5 4.1v-2.1l4.5 2.6V12.9l-4.5 2.6v-2.1L4.5 17.9 9 22v-4.1l4.5-2.6v2.1L18 14.7V9.3zm-7 6.7H9.9v-.7l1.5-1.51c.18-.18.27-.37.27-.56a.34.34 0 0 0-.08-.24.32.32 0 0 0-.23-.08.37.37 0 0 0-.28.1.44.44 0 0 0-.1.31H9.85c.01-.3.08-.55.22-.75.14-.2.33-.36.58-.46.24-.11.52-.16.83-.16.31 0 .58.05.81.16.23.1.41.25.54.44.12.19.19.41.19.65 0 .22-.06.43-.17.63-.11.2-.3.42-.56.66l-.74.75H11V16zm3.17 0h-1.05v-3.26l-1-.62v-.92l1.8-.63h.1V16l.15.001z" />
                  </svg>
                </button>

                {/* Replay */}
                <button
                  onClick={replay}
                  className="p-1.5 text-white/70 hover:text-white transition-colors"
                  title="Replay from start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="p-1 text-white hover:text-violet-400 transition-colors">
                    {isMuted || volume === 0 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : volume < 50 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-0 group-hover/vol:w-20 transition-all duration-300 accent-violet-500 cursor-pointer"
                  />
                </div>

                {/* Time */}
                <span className="text-white/80 text-sm font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex-1" />

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="p-2 text-white hover:text-violet-400 transition-colors">
                  {isFullscreen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
