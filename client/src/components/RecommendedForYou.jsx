import { useState, useEffect, useRef, useCallback } from 'react';

const SERVER_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://vibesync-wpoa.onrender.com');

const SEED_QUERIES = [
  'trending music 2024', 'lofi hip hop', 'best movies', 'viral videos',
  'gaming highlights', 'pop hits', 'chill playlist', 'study music',
];

function getSmartQueries(title, fallbackVideoId) {
  if (!title) return [fallbackVideoId || 'trending music'];
  
  let cleanTitle = title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/(official video|music video|lyric video|official audio|full song|full video|lyrical video|lyrical|video song|audio song|official lyric video|official)/gi, '')
    .trim();

  const tokens = cleanTitle.split(/[|\-•,]/).map(t => t.trim()).filter(Boolean);
  const queries = [];

  if (tokens.length >= 2) {
    const songName = tokens[0];
    const artists = tokens.slice(1);
    
    // 1. Primary song search
    queries.push(`${songName} ${artists[0]}`);
    
    // 2. Similar songs query
    queries.push(`${songName} similar songs`);
    
    // 3. Artists queries
    for (const artist of artists.slice(0, 3)) {
      queries.push(`${artist} hit songs`);
      queries.push(`${songName} similar ${artist}`);
    }
  } else {
    queries.push(`${cleanTitle} similar songs`);
    queries.push(`${cleanTitle} playlist`);
    queries.push(`${cleanTitle} official audio`);
  }

  queries.push('trending music');
  return queries;
}

function formatViews(views) {
  if (!views) return '';
  return views.replace('views', '').trim();
}

export default function RecommendedForYou({ videoId, videoTitle, socket, roomId, queue = [] }) {
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [smartQueriesList, setSmartQueriesList] = useState([]);
  const [page, setPage] = useState(0);
  const [addingId, setAddingId] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());
  
  const bottomRef = useRef(null);
  const observerRef = useRef(null);
  const abortRef = useRef(null);

  // Sync addedIds set with room queue
  useEffect(() => {
    setAddedIds(new Set(queue.map((q) => q.videoId)));
  }, [queue]);

  const fetchRecs = useCallback(async (query, reset = false) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRecsLoading(true);
    try {
      if (socket) {
        socket.emit('recommendation:load', { roomId, query });
      }
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
        console.warn('[RecommendedForYou] fetch failed:', err.message);
      }
    } finally {
      setRecsLoading(false);
    }
  }, [socket, roomId]);

  // Set up smart queries list on video details change
  useEffect(() => {
    const list = getSmartQueries(videoTitle, videoId);
    setSmartQueriesList(list);
    setPage(0);
    setRecommendations([]);
    if (list.length > 0) {
      fetchRecs(list[0], true);
    }
  }, [videoId, videoTitle, fetchRecs]);

  // Infinite Scroll logic
  useEffect(() => {
    if (!hasMore || recsLoading || smartQueriesList.length === 0) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !recsLoading) {
          const nextPageIndex = page + 1;
          const nextQuery = smartQueriesList[nextPageIndex % smartQueriesList.length];
          setPage(nextPageIndex);
          fetchRecs(nextQuery, false);
        }
      },
      { threshold: 0.1 }
    );

    if (bottomRef.current) observerRef.current.observe(bottomRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [hasMore, recsLoading, smartQueriesList, page, fetchRecs]);

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

    socket.emit('recommendation:selected', {
      roomId,
      videoId: video.videoId,
      videoTitle: video.title,
    });

    setTimeout(() => setAddingId(null), 1000);
  }, [socket, roomId, addedIds]);

  const playImmediately = useCallback((video) => {
    if (!socket) return;
    socket.emit('video-change', {
      roomId,
      videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoTitle: video.title,
    });

    socket.emit('recommendation:selected', {
      roomId,
      videoId: video.videoId,
      videoTitle: video.title,
    });
  }, [socket, roomId]);

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
      <h3 className="text-sm font-black uppercase tracking-widest bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-6 flex items-center gap-2">
        <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Recommended For You
      </h3>

      {/* Grid List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {recommendations.map((video) => {
          const inQueue = addedIds.has(video.videoId);
          const isAdding = addingId === video.videoId;
          return (
            <div
              key={video.videoId}
              className="group flex flex-col bg-white/5 border border-white/5 hover:border-violet-500/30 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-violet-950/20"
            >
              {/* Thumbnail with overlay buttons */}
              <div className="relative aspect-video bg-black overflow-hidden shrink-0">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {video.duration && (
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/85 text-white px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                    {video.duration}
                  </span>
                )}

                {/* Overlaid Play/Queue actions on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                  <button
                    onClick={() => playImmediately(video)}
                    className="p-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                    title="Play Immediately"
                  >
                    <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => addToQueue(video)}
                    disabled={inQueue || isAdding}
                    className={`p-2.5 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 ${
                      inQueue
                        ? 'bg-green-600 text-white cursor-default'
                        : isAdding
                        ? 'bg-violet-800 text-violet-300 cursor-wait'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="Add to Queue"
                  >
                    {inQueue ? (
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : isAdding ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-200 line-clamp-2 leading-snug group-hover:text-violet-300 transition-colors">
                    {video.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-medium truncate mt-1">
                    {video.channel}
                  </p>
                </div>
                
                {/* Views */}
                {video.views && (
                  <p className="text-[9px] text-gray-600 mt-2 font-semibold">
                    {formatViews(video.views)} views
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Infinite Scroll sentinel / Loading */}
      <div ref={bottomRef} className="h-6 mt-6 flex items-center justify-center">
        {recsLoading && (
          <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold">
            <svg className="w-4 h-4 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading more recommendations...
          </div>
        )}
      </div>

      {!recsLoading && recommendations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-gray-500">No recommendations available</p>
        </div>
      )}
    </div>
  );
}
