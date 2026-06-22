import { useState, useEffect, useRef, useCallback } from 'react';

const SERVER_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://vibesync-wpoa.onrender.com');

const SEED_QUERIES = ['trending music', 'lofi hip hop', 'best movies 2024', 'funny videos', 'tech review', 'gaming highlights'];

function formatViews(views) {
  if (!views) return '';
  return views.replace('views', '').trim();
}

export default function YouTubeRecommendations({ videoId, videoTitle, socket, roomId, isAdmin, autoplay, onAutoplayChange, onRecommendationsLoaded }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentQuery, setCurrentQuery] = useState('');
  const observerRef = useRef(null);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  const fetchRecommendations = useCallback(async (query, reset = false) => {
    if (loading) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/youtube/search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (reset) {
        setResults(data);
      } else {
        setResults((prev) => {
          const ids = new Set(prev.map((v) => v.videoId));
          return [...prev, ...data.filter((v) => !ids.has(v.videoId))];
        });
      }
      setHasMore(data.length >= 8);
      // Expose results to parent for autoplay
      if (typeof onRecommendationsLoaded === 'function') {
        if (reset) {
          onRecommendationsLoaded(data);
        } else {
          setResults((prev) => {
            const merged = [...prev];
            const ids = new Set(prev.map((v) => v.videoId));
            data.filter((v) => !ids.has(v.videoId)).forEach((v) => merged.push(v));
            onRecommendationsLoaded(merged);
            return merged;
          });
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Recommendations] fetch failed:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // When videoTitle or videoId changes, refresh recommendations
  useEffect(() => {
    if (!videoId) {
      const seed = SEED_QUERIES[Math.floor(Math.random() * SEED_QUERIES.length)];
      setCurrentQuery(seed);
      setPage(0);
      fetchRecommendations(seed, true);
    } else {
      // Use video title words as query, fall back to videoId
      const titleWords = (videoTitle || '').split(' ').slice(0, 4).join(' ').trim();
      const q = titleWords || videoId;
      setCurrentQuery(q);
      setPage(0);
      fetchRecommendations(q, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, videoTitle]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextQuery = currentQuery + ' ' + SEED_QUERIES[page % SEED_QUERIES.length];
          setPage((p) => p + 1);
          fetchRecommendations(nextQuery, false);
        }
      },
      { threshold: 0.1 }
    );

    if (bottomRef.current) {
      observerRef.current.observe(bottomRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading, currentQuery, page, fetchRecommendations]);

  const selectVideo = (video) => {
    if (!socket || !isAdmin) return;
    socket.emit('video-change', {
      roomId,
      videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoTitle: video.title,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Up Next</span>
        </div>

        {isAdmin && (
          <button
            onClick={() => onAutoplayChange && onAutoplayChange(!autoplay)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all duration-300 ${
              autoplay
                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400'
                : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle Autoplay"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l-7 4-7-4V7l7 4 7-4v2zm0 6l-7 4-7-4v-2l7 4 7-4v2z" />
            </svg>
            {autoplay ? 'Autoplay ON' : 'Autoplay'}
          </button>
        )}
      </div>

      {/* Recommendations list */}
      <div className="flex-1 overflow-y-auto space-y-2 p-2 pr-1 min-h-0 custom-scrollbar">
        {results.filter((v) => v.videoId !== videoId).map((video) => (
          <button
            key={video.videoId}
            onClick={() => selectVideo(video)}
            disabled={!isAdmin}
            className={`w-full flex gap-2.5 rounded-xl overflow-hidden text-left transition-all duration-200 group ${
              isAdmin
                ? 'hover:bg-white/10 hover:shadow-md cursor-pointer'
                : 'cursor-default opacity-80'
            } bg-white/5 border border-white/5 hover:border-violet-500/20 p-2`}
            title={isAdmin ? `Play: ${video.title}` : 'Only admin can change video'}
          >
            {/* Thumbnail */}
            <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-black">
              <img
                src={video.thumbnail}
                alt={video.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {video.duration && (
                <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                  {video.duration}
                </span>
              )}
              {isAdmin && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg className="w-6 h-6 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <p className="text-xs font-semibold text-gray-200 line-clamp-2 leading-snug group-hover:text-violet-300 transition-colors">
                {video.title}
              </p>
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-gray-500 truncate">{video.channel}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-600">
                  {video.views && <span>{formatViews(video.views)} views</span>}
                  {video.published && <span>· {video.published}</span>}
                </div>
              </div>
            </div>
          </button>
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={bottomRef} className="h-4" />

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center py-4">
            <svg className="w-6 h-6 text-violet-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="w-10 h-10 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-xs text-gray-500">No recommendations available</p>
          </div>
        )}
      </div>
    </div>
  );
}
