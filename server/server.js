// ── Load environment variables first ────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { initializeFirebase } = require('./config/firebase');
const { setupSocketHandlers, connectedUsers } = require('./handlers/socketHandlers');

// ── Configuration ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── CORS Configuration ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed =
      ALLOWED_ORIGINS.indexOf(origin) !== -1 ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /\.vercel\.app$/.test(origin);
      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
};

// ── Express app ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors(corsOptions));
app.use(express.json());

// ── HTTP server ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Firebase ────────────────────────────────────────────────────────────────
const db = initializeFirebase();

// ── REST routes ─────────────────────────────────────────────────────────────

/**
 * Health check
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    connectedSockets: connectedUsers.size,
  });
});

/**
 * Get room info (password excluded)
 */
app.get('/api/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const roomSnap = await db.collection('rooms').doc(roomId).get();

    if (!roomSnap.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomData = roomSnap.data();

    // Never leak the password to the REST client
    const { password, ...safeRoom } = roomData;

    // Let the client know whether a password is required without revealing it
    safeRoom.hasPassword = !!password;

    res.json(safeRoom);
  } catch (error) {
    console.error('[VibeSync] GET /api/room error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to scrape YouTube search results
function searchYouTube(query) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const match = data.match(/ytInitialData\s*=\s*({[\s\S]*?});/);
          if (!match) return resolve([]);
          
          const parsed = JSON.parse(match[1]);
          const contents = parsed.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents;
          const itemSection = contents?.find(c => c.itemSectionRenderer)?.itemSectionRenderer;
          const items = itemSection?.contents || [];

          const results = items
            .map((item) => {
              const video = item.videoRenderer;
              if (!video) return null;
              return {
                videoId: video.videoId,
                title: video.title?.runs?.[0]?.text || '',
                thumbnail: video.thumbnail?.thumbnails?.[0]?.url || '',
                channel: video.ownerText?.runs?.[0]?.text || '',
                duration: video.lengthText?.simpleText || '',
                views: video.viewCountText?.simpleText || '',
                published: video.publishedTimeText?.simpleText || '',
              };
            })
            .filter(Boolean);

          resolve(results.slice(0, 10)); // Limit to 10 results
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * YouTube search scraper endpoint
 */
app.get('/api/youtube/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const results = await searchYouTube(q);
    res.json(results);
  } catch (error) {
    console.error('[VibeSync] YouTube search API error:', error.message);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// ── 404 fallback for unknown API routes ─────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Socket.IO handlers ─────────────────────────────────────────────────────
setupSocketHandlers(io, db);

// ── Start server ────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[VibeSync] Server running on http://localhost:${PORT}`);
  console.log(`[VibeSync] Accepting connections from ${CLIENT_URL}`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[VibeSync] ${signal} received – shutting down gracefully…`);
  io.close(() => {
    console.log('[VibeSync] Socket.IO connections closed');
    server.close(() => {
      console.log('[VibeSync] HTTP server closed');
      process.exit(0);
    });
  });

  // Force exit after 10 s if graceful shutdown stalls
  setTimeout(() => {
    console.error('[VibeSync] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled promise rejections so the server doesn't silently break
process.on('unhandledRejection', (reason) => {
  console.error('[VibeSync] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[VibeSync] Uncaught Exception:', error);
  process.exit(1);
});
