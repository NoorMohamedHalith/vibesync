import { useState, useEffect, useRef } from 'react';

const SERVER_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://vibesync-wpoa.onrender.com');

export default function YouTubeSearchModal({ isOpen, onClose, roomId, socket }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearchQuery('');
      setResults([]);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isYouTubeUrl = (url) => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)/.test(url);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setError('');

    // If it's a direct YouTube URL, load it directly
    if (isYouTubeUrl(searchQuery)) {
      if (socket) {
        socket.emit('video-change', {
          roomId,
          videoUrl: searchQuery.trim(),
          videoTitle: 'YouTube Video',
        });
      }
      onClose();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${SERVER_URL}/api/youtube/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setResults(data);
      if (data.length === 0) {
        setError('No results found');
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setError('Failed to fetch search results. Try pasting a direct link.');
    } finally {
      setLoading(false);
    }
  };

  const selectVideo = (video) => {
    if (socket) {
      socket.emit('video-change', {
        roomId,
        videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        videoTitle: video.title,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col z-10 border border-violet-500/30 animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-pulse">
            <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Search YouTube</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Search videos directly or paste a link</p>
          </div>
        </div>

        {/* Direct Link Paste Section (Mobile-friendly, auto-loads on paste) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 shrink-0">
          <label className="block text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">
            Direct Link Paste
          </label>
          <input
            type="text"
            className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="Paste YouTube URL here (loads automatically)..."
            onChange={(e) => {
              const url = e.target.value.trim();
              if (url && isYouTubeUrl(url)) {
                if (socket) {
                  socket.emit('video-change', {
                    roomId,
                    videoUrl: url,
                    videoTitle: 'YouTube Video',
                  });
                }
                onClose();
              }
            }}
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Pasting a valid YouTube URL will load it instantly without any extra clicks.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/10 rounded-2xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
              placeholder="Search or paste link (e.g. https://youtube.com/watch?v=...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-2xl font-semibold text-sm hover:shadow-[0_0_15px_rgba(139,92,246,0.4)] disabled:opacity-40 disabled:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Results / Loading / Errors */}
        <div className="flex-1 overflow-y-auto min-h-[250px] pr-2 space-y-4">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-10 h-10 text-violet-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-gray-500 font-medium">Retrieving results from YouTube...</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-red-400 font-medium text-center bg-red-500/10 px-4 py-3 rounded-2xl border border-red-500/20 max-w-sm">
                {error}
              </p>
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <svg className="w-16 h-16 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
              </svg>
              <p className="text-gray-400 font-medium">Find your favorite videos</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">Type search query or paste link in the search bar above to begin.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((video) => (
                <div
                  key={video.videoId}
                  onClick={() => selectVideo(video)}
                  className="flex flex-col bg-white/5 border border-white/5 hover:border-violet-500/40 rounded-2xl overflow-hidden cursor-pointer hover:bg-white/10 hover:shadow-lg transition-all duration-300 group"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden bg-black">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-violet-400 transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {video.channel}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-400">
                      <span>{video.views}</span>
                      <span>{video.published}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
