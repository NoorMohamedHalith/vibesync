import { useState, useEffect, useRef, useCallback } from 'react';

const SERVER_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://vibesync-wpoa.onrender.com');

const SEED_QUERIES = [
  'trending music 2024', 'lofi hip hop', 'best movies', 'viral videos',
  'gaming highlights', 'pop hits', 'chill playlist', 'study music',
];

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

export default function SharedQueue({ queue = [], socket, roomId, videoId, username }) {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'recommendations'
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentQuery, setCurrentQuery] = useState('');
  const [page, setPage] = useState(0);
  const [addingId, setAddingId] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());
  const bottomRef = useRef(null);
  const observerRef = useRef(null);
  const abortRef = useRef(null);

  // Track which videoIds are already in queue
  useEffect(() => {
    setAddedIds(new Set(queue.map((q) => q.videoId)));
  }, [queue]);

  const fetchRecs = useCallback(async (query, reset = false) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRecsLoading(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/youtube/search?q=${encodeURIComponent(query)}`,
        { signal: ctrl.signal }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (reset) {
        setRecommendations(data);
      } else {
        setRecommendations((prev) => {
          const ids = new Set(prev.map((v) => v.videoId));
          return [...prev, ...data.filter((v) => !ids.has(v.videoId))];
        });
      }
      setHasMore(data.length >= 8);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[SharedQueue] recs fetch failed:', err.message);
      }
    } finally {
      setRecsLoading(false);
    }
  }, []);

  // Fetch recommendations when videoId or tab changes
  useEffect(() => {
    if (activeTab !== 'recommendations') return;
    const seed = SEED_QUERIES[Math.floor(Math.random() * SEED_QUERIES.length)];
    const q = videoId ? `related ${videoId}` : seed;
    setCurrentQuery(q);
    setPage(0);
    fetchRecs(q, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, activeTab]);

  // Infinite scroll
  useEffect(() => {
    if (activeTab !== 'recommendations' || !hasMore || recsLoading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !recsLoading) {
          const altQuery = currentQuery + ' ' + SEED_QUERIES[page % SEED_QUERIES.length];
          setPage((p) => p + 1);
          fetchRecs(altQuery, false);
        }
      },
      { threshold: 0.1 }
    );

    if (bottomRef.current) observerRef.current.observe(bottomRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [hasMore, recsLoading, currentQuery, page, activeTab, fetchRecs]);

  const addToQueue = useCallback((video) => {
    if (!socket) return;
    if (addedIds.has(video.videoId)) return;

    setAddingId(video.videoId);
    socket.emit('queue:add', {
      roomId,
      videoId: video.videoId,
      videoTitle: video.title,
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
      channel: video.channel || '',
    });
    setTimeout(() => setAddingId(null), 1000);
  }, [socket, roomId, addedIds]);

  const removeFromQueue = useCallback((itemId) => {
    if (!socket) return;
    socket.emit('queue:remove', { roomId, itemId });
  }, [socket, roomId]);

  const moveItem = useCallback((itemId, direction) => {
    if (!socket) return;
    socket.emit('queue:move', { roomId, itemId, direction });
  }, [socket, roomId]);

  const skipToItem = useCallback((itemId) => {
    if (!socket) return;
    socket.emit('queue:skip', { roomId, itemId });
  }, [socket, roomId]);

  const skipNext = useCallback(() => {
    if (!socket) return;
    socket.emit('queue:skip', { roomId });
  }, [socket, roomId]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${
            activeTab === 'queue'
              ? 'text-violet-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            Queue ({queue.length})
          </span>
          {activeTab === 'queue' && (
            <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${
            activeTab === 'recommendations'
              ? 'text-violet-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
            </svg>
            Discover
          </span>
          {activeTab === 'recommendations' && (
            <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── QUEUE TAB ── */}
        {activeTab === 'queue' && (
          <div className="p-2 space-y-1.5">
            {/* Skip next button */}
            {queue.length > 1 && (
              <button
                onClick={skipNext}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all text-xs font-semibold"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
                Skip to Next
              </button>
            )}

            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">Queue is empty</p>
                <p className="text-xs text-gray-600 mt-1">Search videos or browse Discover to add songs</p>
              </div>
            )}

            {queue.map((item, idx) => (
              <div
                key={item.id}
                className={`flex gap-2.5 rounded-xl p-2 border transition-all group ${
                  idx === 0
                    ? 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
                    : 'bg-white/5 border-white/5 hover:border-white/15'
                }`}
              >
                {/* Order number */}
                <div className="w-5 flex items-center justify-center shrink-0">
                  {idx === 0 ? (
                    <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest leading-none">
                      NOW
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-600">{idx + 1}</span>
                  )}
                </div>

                {/* Thumbnail */}
                <div className="relative w-16 aspect-video rounded-lg overflow-hidden shrink-0 bg-black">
                  <img
                    src={item.thumbnail}
                    alt={item.videoTitle}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-3 h-3 rounded-full bg-violet-400 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-[11px] font-semibold text-gray-200 line-clamp-2 leading-snug">
                    {item.videoTitle}
                  </p>
                  {item.channel && (
                    <p className="text-[9px] text-gray-500 mt-0.5 truncate">{item.channel}</p>
                  )}
                  <p className="text-[9px] text-violet-500/70 mt-0.5 truncate">
                    Added by <span className="font-semibold text-violet-400">{item.addedBy}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button
                      onClick={() => skipToItem(item.id)}
                      className="p-1 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      title="Play now"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                  {idx > 1 && (
                    <button
                      onClick={() => moveItem(item.id, 'up')}
                      className="p-1 rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  )}
                  {idx < queue.length - 1 && idx > 0 && (
                    <button
                      onClick={() => moveItem(item.id, 'down')}
                      className="p-1 rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    className="p-1 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RECOMMENDATIONS TAB ── */}
        {activeTab === 'recommendations' && (
          <div className="p-2 space-y-2">
            {recsLoading && recommendations.length === 0 && (
              <div className="flex justify-center py-10">
                <svg className="w-7 h-7 text-violet-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {recommendations.map((video) => {
              const inQueue = addedIds.has(video.videoId);
              const isAdding = addingId === video.videoId;
              return (
                <div
                  key={video.videoId}
                  className="flex gap-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-violet-500/20 p-2 group transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 aspect-video rounded-lg overflow-hidden shrink-0 bg-black">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {video.duration && (
                      <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/80 text-white px-0.5 rounded font-mono">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  {/* Info + Add button */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <p className="text-[11px] font-semibold text-gray-200 line-clamp-2 leading-snug group-hover:text-violet-300 transition-colors">
                      {video.title}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{video.channel}</p>
                    <button
                      onClick={() => addToQueue(video)}
                      disabled={inQueue || isAdding}
                      className={`mt-1.5 flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        inQueue
                          ? 'bg-green-500/10 border border-green-500/30 text-green-400 cursor-default'
                          : isAdding
                          ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300 cursor-wait'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-violet-500/20 hover:border-violet-500/40 hover:text-violet-300'
                      }`}
                    >
                      {inQueue ? (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                          In Queue
                        </>
                      ) : isAdding ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Adding...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                          Add to Queue
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Infinite scroll sentinel */}
            <div ref={bottomRef} className="h-4" />

            {recsLoading && recommendations.length > 0 && (
              <div className="flex justify-center py-3">
                <svg className="w-5 h-5 text-violet-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
