const { v4: uuidv4 } = require('uuid');

/**
 * In-memory registry of connected sockets.
 * Map<socketId, { roomId, username, isAdmin }>
 */
const connectedUsers = new Map();
const activeGames = new Map();
// Collaborative queue: roomId -> Array<{id, videoId, videoTitle, thumbnail, channel, addedBy, addedAt}>
const roomQueues = new Map();
const lastQueueAdvances = new Map();
const roomHistories = new Map();

function addToRoomHistory(roomId, videoId, videoTitle, thumbnail, channel) {
  if (!videoId) return null;
  let history = roomHistories.get(roomId);
  if (!history) {
    history = [];
    roomHistories.set(roomId, history);
  }
  if (history.length > 0 && history[0].videoId === videoId) return history;
  
  history.unshift({
    id: uuidv4(),
    videoId,
    videoTitle: videoTitle || 'Unknown Video',
    thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    channel: channel || '',
    playedAt: Date.now(),
  });
  
  if (history.length > 30) {
    history.pop();
  }
  return history;
}

// Rate limiting settings
const socketMessageCounts = new Map();
const RATE_LIMIT_WINDOW = 5000; // 5s window
const MAX_MESSAGES_IN_WINDOW = 35; // Max events per window

function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function checkRateLimit(socket) {
  const now = Date.now();
  let rateInfo = socketMessageCounts.get(socket.id);
  
  if (!rateInfo) {
    rateInfo = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    socketMessageCounts.set(socket.id, rateInfo);
    return true;
  }
  
  if (now > rateInfo.resetTime) {
    rateInfo.count = 1;
    rateInfo.resetTime = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  rateInfo.count++;
  if (rateInfo.count > MAX_MESSAGES_IN_WINDOW) {
    socket.emit('error-occurred', { error: 'Rate limit exceeded. Please slow down.' });
    return false;
  }
  return true;
}

/**
 * Generate a 6-character uppercase alphanumeric room code.
 */
function generateRoomCode() {
  return uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
}

/**
 * Extract a YouTube video ID from various URL formats.
 */
function extractVideoId(url) {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return url;
}

/**
 * Remove a socket from the room it is in (Firestore + in-memory).
 * This updates active users but NEVER deletes the room document from Firestore.
 */
async function removeUserFromRoom(io, db, socket, reason = 'left') {
  const userMeta = connectedUsers.get(socket.id);
  if (!userMeta || !userMeta.roomId) return;

  const { roomId, username, isAdmin } = userMeta;

  try {
    console.log(`[VibeSync] Removing user ${username} from room ${roomId}`);
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (roomSnap.exists) {
      const roomData = roomSnap.data();
      const updatedUsers = (roomData.users || []).filter(
        (p) => p.socketId !== socket.id
      );
      const updatedParticipants = (roomData.participants || []).filter(
        (p) => p.socketId !== socket.id
      );

      const micStatus = roomData.micStatus || {};
      const videoStatus = roomData.videoStatus || {};
      delete micStatus[socket.id];
      delete videoStatus[socket.id];

      await roomRef.update({
        users: updatedUsers,
        participants: updatedParticipants,
        micStatus,
        videoStatus
      });

      socket.leave(roomId);
      io.to(roomId).emit('user-left', { socketId: socket.id, username, reason });
      io.to(roomId).emit('webrtc-peer-left', { peerId: socket.id });

      // Clean up game slots
      const roomGame = activeGames.get(roomId);
      if (roomGame) {
        let updateGame = false;
        if (roomGame.ttt) {
          if (roomGame.ttt.players.X === socket.id) { roomGame.ttt.players.X = null; updateGame = true; }
          if (roomGame.ttt.players.O === socket.id) { roomGame.ttt.players.O = null; updateGame = true; }
        }
        if (roomGame.rps) {
          if (roomGame.rps.players.p1?.socketId === socket.id) { roomGame.rps.players.p1 = null; updateGame = true; }
          if (roomGame.rps.players.p2?.socketId === socket.id) { roomGame.rps.players.p2 = null; updateGame = true; }
          if (updateGame) {
            roomGame.rps.moves.p1 = null;
            roomGame.rps.moves.p2 = null;
            roomGame.rps.winner = null;
          }
        }
        if (roomGame.chess) {
          if (roomGame.chess.players.white === socket.id) { roomGame.chess.players.white = null; updateGame = true; }
          if (roomGame.chess.players.black === socket.id) { roomGame.chess.players.black = null; updateGame = true; }
        }
        if (roomGame.memory) {
          if (roomGame.memory.players.p1 === socket.id) { roomGame.memory.players.p1 = null; updateGame = true; }
          if (roomGame.memory.players.p2 === socket.id) { roomGame.memory.players.p2 = null; updateGame = true; }
        }
        if (updateGame) {
          activeGames.set(roomId, roomGame);
          if (roomGame.ttt) io.to(roomId).emit('ttt-state', roomGame.ttt);
          if (roomGame.rps) io.to(roomId).emit('rps-state', roomGame.rps);
          if (roomGame.chess) io.to(roomId).emit('chess-state', roomGame.chess);
          if (roomGame.memory) io.to(roomId).emit('memory-state', roomGame.memory);
        }
      }

      console.log(`[VibeSync] ${username} ${reason} room ${roomId}`);

      // Promote the next user to admin if the leaving user was admin
      if (isAdmin && updatedUsers.length > 0) {
        const newAdmin = updatedUsers[0];
        await roomRef.update({
          adminId: newAdmin.socketId,
          adminUsername: newAdmin.username,
        });

        const adminMeta = connectedUsers.get(newAdmin.socketId);
        if (adminMeta) adminMeta.isAdmin = true;

        io.to(roomId).emit('admin-transferred', {
          newAdminId: newAdmin.socketId,
          newAdminUsername: newAdmin.username,
        });

        console.log(`[VibeSync] Admin transferred to ${newAdmin.username} in room ${roomId}`);
      }
    }
  } catch (error) {
    console.error('[VibeSync] removeUserFromRoom error:', error.message);
  } finally {
    connectedUsers.delete(socket.id);
  }
}

/**
 * Attach all Socket.IO event handlers.
 */
function setupSocketHandlers(io, db) {
  io.on('connection', (socket) => {
    console.log(`[VibeSync] Socket connected: ${socket.id}`);

    // -----------------------------------------------------------------------
    // ROOM EVENTS
    // -----------------------------------------------------------------------

    socket.on('create-room', async (data, callback) => {
      try {
        console.log('[VibeSync] Creating room...');
        let { roomName, password, username, videoId, videoTitle } = data || {};

        if (!roomName || !username) {
          const err = { error: 'roomName and username are required' };
          return typeof callback === 'function' ? callback(err) : socket.emit('error-occurred', err);
        }

        roomName = sanitizeInput(roomName.trim()).substring(0, 50);
        username = sanitizeInput(username.trim()).substring(0, 25);

        const roomId = generateRoomCode();
        const now = new Date().toISOString();

        console.log('[VibeSync] Saving room...');
        const roomDoc = {
          roomId, // compatibility
          roomCode: roomId, // new schema
          roomName,
          password: password || null,
          createdBy: username, // new schema
          adminId: socket.id,
          adminUsername: username,
          users: [
            {
              socketId: socket.id,
              username,
              joinedAt: now,
              micOn: false,
              cameraOn: false
            }
          ],
          participants: [
            {
              socketId: socket.id,
              username,
              joinedAt: now,
            }
          ],
          currentVideo: {
            videoId: videoId || null,
            videoTitle: videoTitle || null
          },
          videoId: videoId || null,
          videoTitle: videoTitle || null,
          currentTime: 0,
          isPlaying: false,
          videoState: 'paused',
          videoStartedAt: 0,
          videoStartOffset: 0,
          chatMessages: [],
          files: [],
          micStatus: {},
          videoStatus: {},
          createdAt: now,
        };

        await db.collection('rooms').doc(roomId).set(roomDoc);
        console.log('[VibeSync] Room saved.');

        connectedUsers.set(socket.id, { roomId, username, isAdmin: true, activity: 'Watching...' });
        // Initialize empty queue for this room
        roomQueues.set(roomId, []);
        socket.join(roomId);

        const response = { roomId, roomCode: roomId, roomName, adminId: socket.id };
        socket.emit('room-created', response);
        if (typeof callback === 'function') callback({ success: true, ...response });

        console.log(`[VibeSync] Room created successfully: ${roomId} by ${username}`);
      } catch (error) {
        console.error('[VibeSync] create-room error:', error.message);
        const err = { error: 'Failed to create room' };
        typeof callback === 'function' ? callback(err) : socket.emit('error-occurred', err);
      }
    });

    socket.on('join-room', async (data, callback) => {
      try {
        console.log('[VibeSync] Joining room...');
        let { roomId, password, username } = data || {};

        if (!roomId || !username) {
          const err = { error: 'roomId and username are required' };
          return typeof callback === 'function' ? callback(err) : socket.emit('error-occurred', err);
        }

        username = sanitizeInput(username.trim()).substring(0, 25);
        roomId = roomId.trim().toUpperCase();

        console.log('[VibeSync] Searching Firestore...');
        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();

        if (!roomSnap.exists) {
          console.log('[VibeSync] Room not found.');
          const err = { error: 'Room not found' };
          return typeof callback === 'function' ? callback(err) : socket.emit('error-occurred', err);
        }

        console.log('[VibeSync] Room found.');
        const roomData = roomSnap.data();

        // Admin checks
        const isCreator = roomData.createdBy === username;
        const isAdmin = roomData.adminId === socket.id || isCreator || (roomData.users || []).length === 0;

        // Password bypass if creator or if room has no password
        if (!isCreator && roomData.password && roomData.password !== password) {
          const err = { error: 'Incorrect password' };
          return typeof callback === 'function' ? callback(err) : socket.emit('error-occurred', err);
        }

        console.log('[VibeSync] Joining socket room...');
        const now = new Date().toISOString();
        const alreadyIn = (roomData.users || []).some(
          (p) => p.socketId === socket.id
        );

        if (!alreadyIn) {
          const newUser = { socketId: socket.id, username, joinedAt: now, micOn: false, cameraOn: false };
          await roomRef.update({
            users: [...(roomData.users || []), newUser],
            participants: [...(roomData.participants || []), { socketId: socket.id, username, joinedAt: now }]
          });
        }

        if (isAdmin) {
          await roomRef.update({
            adminId: socket.id,
            adminUsername: username
          });
        }

        connectedUsers.set(socket.id, { roomId, username, isAdmin, activity: 'Watching...' });
        socket.join(roomId);
        console.log('[VibeSync] User added.');

        // Re-query fresh data
        const freshSnap = await roomRef.get();
        const freshData = freshSnap.data();

        const { password: _pw, ...safeRoom } = freshData;
        
        // Hydrate activity status for each participant
        const pList = (freshData.users || []).map((u) => {
          const meta = connectedUsers.get(u.socketId);
          return {
            ...u,
            activity: meta ? meta.activity : 'Watching...'
          };
        });
        
        safeRoom.participants = pList;
        safeRoom.messages = freshData.chatMessages || [];
        safeRoom.files = freshData.files || [];
        safeRoom.queue = roomQueues.get(roomId) || [];
        safeRoom.history = roomHistories.get(roomId) || [];

        socket.emit('room-joined', safeRoom);

        // Sync late joiner
        let calculatedTime = freshData.currentTime || 0;
        if (freshData.isPlaying && freshData.videoStartedAt) {
          calculatedTime = (freshData.videoStartOffset || 0) + (Date.now() - freshData.videoStartedAt) / 1000;
        }

        socket.emit('sync-state', {
          videoId: freshData.currentVideo?.videoId || freshData.videoId,
          videoTitle: freshData.currentVideo?.videoTitle || freshData.videoTitle,
          videoState: freshData.isPlaying ? 'playing' : 'paused',
          currentTime: calculatedTime,
          queue: roomQueues.get(roomId) || [],
          history: roomHistories.get(roomId) || [],
        });

        socket.to(roomId).emit('user-joined', {
          socketId: socket.id,
          username,
          joinedAt: now,
        });

        if (typeof callback === 'function') callback({ success: true, ...safeRoom });
        console.log(`[VibeSync] User ${username} successfully joined room ${roomId}`);
      } catch (error) {
        console.error('[VibeSync] join-room error:', error.message);
        const err = { error: 'Failed to join room' };
        typeof callback === 'function' ? callback(err) : socket.emit('error-occurred', err);
      }
    });

    socket.on('leave-room', async () => {
      await removeUserFromRoom(io, db, socket, 'left');
    });

    // -----------------------------------------------------------------------
    // VIDEO SYNC EVENTS
    // -----------------------------------------------------------------------

    socket.on('video-change', async (data) => {
      try {
        const { roomId, videoUrl, videoTitle } = data || {};
        const userMeta = connectedUsers.get(socket.id);

        if (!userMeta) {
          return socket.emit('error-occurred', { error: 'You are not in a room' });
        }

        const videoId = extractVideoId(videoUrl);
        console.log(`[VibeSync] Changing video to ${videoId} in room ${roomId} by ${userMeta.username}...`);

        // Archive previous video to history before updating to new one
        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (roomSnap.exists) {
          const roomData = roomSnap.data();
          const oldVideoId = roomData.videoId || roomData.currentVideo?.videoId;
          if (oldVideoId) {
            const oldTitle = roomData.videoTitle || roomData.currentVideo?.videoTitle;
            const hist = addToRoomHistory(roomId, oldVideoId, oldTitle, null, null);
            if (hist) {
              io.to(roomId).emit('history:updated', { history: hist });
            }
          }
        }

        await roomRef.update({
          videoId,
          videoTitle: videoTitle || null,
          currentVideo: { videoId, videoTitle: videoTitle || null },
          videoState: 'paused',
          isPlaying: false,
          currentTime: 0,
          videoStartedAt: 0,
          videoStartOffset: 0
        });

        io.to(roomId).emit('video-changed', {
          videoId,
          videoTitle: videoTitle || null,
        });

        console.log(`[VibeSync] Video sync active. Video changed to ${videoId}`);
      } catch (error) {
        console.error('[VibeSync] video-change error:', error.message);
        socket.emit('error-occurred', { error: 'Failed to change video' });
      }
    });

    socket.on('play-video', async (data) => {
      try {
        const { roomId, currentTime } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        await db.collection('rooms').doc(roomId).update({
          videoState: 'playing',
          isPlaying: true,
          currentTime: currentTime || 0,
          videoStartedAt: Date.now(),
          videoStartOffset: currentTime || 0
        });

        socket.to(roomId).emit('video-played', { currentTime: currentTime || 0 });
        console.log(`[VibeSync] Play sync active in room ${roomId} at ${currentTime}`);
      } catch (error) {
        console.error('[VibeSync] play-video error:', error.message);
      }
    });

    socket.on('video:play', async (data) => {
      try {
        const { roomId, currentTime } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        await db.collection('rooms').doc(roomId).update({
          videoState: 'playing',
          isPlaying: true,
          currentTime: currentTime || 0,
          videoStartedAt: Date.now(),
          videoStartOffset: currentTime || 0
        });

        socket.to(roomId).emit('video:play', { currentTime: currentTime || 0, username: userMeta.username });
        console.log(`[VibeSync] video:play active in room ${roomId} at ${currentTime} by ${userMeta.username}`);
      } catch (error) {
        console.error('[VibeSync] video:play error:', error.message);
      }
    });

    socket.on('pause-video', async (data) => {
      try {
        const { roomId, currentTime } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        await db.collection('rooms').doc(roomId).update({
          videoState: 'paused',
          isPlaying: false,
          currentTime: currentTime || 0,
          videoStartedAt: 0,
          videoStartOffset: currentTime || 0
        });

        socket.to(roomId).emit('video-paused', { currentTime: currentTime || 0 });
        console.log(`[VibeSync] Pause sync active in room ${roomId} at ${currentTime}`);
      } catch (error) {
        console.error('[VibeSync] pause-video error:', error.message);
      }
    });

    socket.on('video:pause', async (data) => {
      try {
        const { roomId, currentTime } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        await db.collection('rooms').doc(roomId).update({
          videoState: 'paused',
          isPlaying: false,
          currentTime: currentTime || 0,
          videoStartedAt: 0,
          videoStartOffset: currentTime || 0
        });

        socket.to(roomId).emit('video:pause', { currentTime: currentTime || 0, username: userMeta.username });
        console.log(`[VibeSync] video:pause active in room ${roomId} at ${currentTime} by ${userMeta.username}`);
      } catch (error) {
        console.error('[VibeSync] video:pause error:', error.message);
      }
    });

    socket.on('seek-video', async (data) => {
      try {
        const { roomId, currentTime } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        const roomData = roomSnap.data() || {};

        await roomRef.update({
          currentTime: currentTime || 0,
          videoStartedAt: roomData.isPlaying ? Date.now() : 0,
          videoStartOffset: currentTime || 0
        });

        socket.to(roomId).emit('video-seeked', { currentTime: currentTime || 0 });
        console.log(`[VibeSync] Seek sync active in room ${roomId} to ${currentTime}`);
      } catch (error) {
        console.error('[VibeSync] seek-video error:', error.message);
      }
    });

    socket.on('video:seek', async (data) => {
      try {
        const { roomId, currentTime } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        const roomData = roomSnap.data() || {};

        await roomRef.update({
          currentTime: currentTime || 0,
          videoStartedAt: roomData.isPlaying ? Date.now() : 0,
          videoStartOffset: currentTime || 0
        });

        socket.to(roomId).emit('video:seek', { currentTime: currentTime || 0, username: userMeta.username });
        console.log(`[VibeSync] video:seek active in room ${roomId} to ${currentTime} by ${userMeta.username}`);
      } catch (error) {
        console.error('[VibeSync] video:seek error:', error.message);
      }
    });

    socket.on('sync-request', async (data) => {
      try {
        const { roomId } = data || {};
        const roomSnap = await db.collection('rooms').doc(roomId).get();
        if (!roomSnap.exists) return;

        const roomData = roomSnap.data();
        let calculatedTime = roomData.currentTime || 0;
        if (roomData.isPlaying && roomData.videoStartedAt) {
          calculatedTime = (roomData.videoStartOffset || 0) + (Date.now() - roomData.videoStartedAt) / 1000;
        }

        socket.emit('sync-state', {
          videoId: roomData.currentVideo?.videoId || roomData.videoId,
          videoTitle: roomData.currentVideo?.videoTitle || roomData.videoTitle,
          videoState: roomData.isPlaying ? 'playing' : 'paused',
          currentTime: calculatedTime,
          queue: roomQueues.get(roomId) || [],
        });
      } catch (error) {
        console.error('[VibeSync] sync-request error:', error.message);
      }
    });

    socket.on('video:sync', async (data) => {
      try {
        const { roomId } = data || {};
        const roomSnap = await db.collection('rooms').doc(roomId).get();
        if (!roomSnap.exists) return;

        const roomData = roomSnap.data();
        let calculatedTime = roomData.currentTime || 0;
        if (roomData.isPlaying && roomData.videoStartedAt) {
          calculatedTime = (roomData.videoStartOffset || 0) + (Date.now() - roomData.videoStartedAt) / 1000;
        }

        socket.emit('video:sync', {
          videoId: roomData.currentVideo?.videoId || roomData.videoId,
          videoTitle: roomData.currentVideo?.videoTitle || roomData.videoTitle,
          videoState: roomData.isPlaying ? 'playing' : 'paused',
          currentTime: calculatedTime,
          queue: roomQueues.get(roomId) || [],
        });
      } catch (error) {
        console.error('[VibeSync] video:sync error:', error.message);
      }
    });

    socket.on('video:ended', async (data) => {
      try {
        const { roomId, videoId } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        console.log(`[VibeSync] video:ended received from ${userMeta.username} in room ${roomId} for video ${videoId}`);

        // Broadcast to all other participants
        socket.to(roomId).emit('video:ended', { videoId, username: userMeta.username });

        // Debounce autoplay to prevent duplicate advancements
        const now = Date.now();
        const lastAdvance = lastQueueAdvances.get(roomId) || 0;
        if (now - lastAdvance < 3000) {
          console.log(`[VibeSync] Autoplay advance ignored (already advanced recently in room ${roomId})`);
          return;
        }

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (!roomSnap.exists) return;
        const roomData = roomSnap.data();

        const currentVid = roomData.currentVideo?.videoId || roomData.videoId;
        if (currentVid && currentVid !== videoId) {
          console.log(`[VibeSync] Autoplay advance ignored (current video ${currentVid} differs from ended video ${videoId})`);
          return;
        }

        const queue = roomQueues.get(roomId) || [];
        if (queue.length === 0) {
          console.log(`[VibeSync] Queue empty in room ${roomId}. Stopping autoplay.`);
          return;
        }

        lastQueueAdvances.set(roomId, now);

        const finished = queue.shift();
        if (finished) {
          const hist = addToRoomHistory(roomId, finished.videoId, finished.videoTitle, finished.thumbnail, finished.channel);
          if (hist) {
            io.to(roomId).emit('history:updated', { history: hist });
          }
        }
        const nextItem = queue[0];
        roomQueues.set(roomId, queue);

        if (nextItem) {
          await roomRef.update({
            videoId: nextItem.videoId,
            videoTitle: nextItem.videoTitle,
            currentVideo: { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle },
            videoState: 'playing',
            isPlaying: true,
            currentTime: 0,
            videoStartedAt: Date.now(),
            videoStartOffset: 0
          });

          io.to(roomId).emit('video:next', {
            videoId: nextItem.videoId,
            videoTitle: nextItem.videoTitle,
          });
          io.to(roomId).emit('video-changed', {
            videoId: nextItem.videoId,
            videoTitle: nextItem.videoTitle,
          });
        } else {
          await roomRef.update({
            videoId: null,
            videoTitle: null,
            currentVideo: { videoId: null, videoTitle: null },
            videoState: 'paused',
            isPlaying: false,
            currentTime: 0,
            videoStartedAt: 0,
            videoStartOffset: 0
          });

          io.to(roomId).emit('video:next', {
            videoId: null,
            videoTitle: null,
          });
          io.to(roomId).emit('video-changed', {
            videoId: null,
            videoTitle: null,
          });
        }

        io.to(roomId).emit('queue:updated', { queue });
      } catch (error) {
        console.error('[VibeSync] video:ended error:', error.message);
      }
    });

    socket.on('recommendation:selected', (data) => {
      try {
        const { roomId, videoId, videoTitle } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        socket.to(roomId).emit('recommendation:selected', {
          videoId,
          videoTitle,
          username: userMeta.username
        });
        console.log(`[VibeSync] recommendation:selected in room ${roomId} by ${userMeta.username}: ${videoTitle}`);
      } catch (error) {
        console.error('[VibeSync] recommendation:selected error:', error.message);
      }
    });

    socket.on('recommendation:load', (data) => {
      try {
        const { roomId, query } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        socket.to(roomId).emit('recommendation:load', {
          query,
          username: userMeta.username
        });
        console.log(`[VibeSync] recommendation:load in room ${roomId} by ${userMeta.username} for query: ${query}`);
      } catch (error) {
        console.error('[VibeSync] recommendation:load error:', error.message);
      }
    });

    socket.on('queue:vote', (data) => {
      try {
        const { roomId, itemId } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const queue = roomQueues.get(roomId) || [];
        const item = queue.find((i) => i.id === itemId);
        if (!item) return;

        if (!item.votes) item.votes = [];
        
        const idx = item.votes.indexOf(userMeta.username);
        if (idx === -1) {
          item.votes.push(userMeta.username);
        } else {
          item.votes.splice(idx, 1);
        }

        // Re-sort queue (excluding currently playing video at index 0)
        if (queue.length > 2) {
          const current = queue[0];
          const rest = queue.slice(1);
          rest.sort((a, b) => {
            const vA = (a.votes || []).length;
            const vB = (b.votes || []).length;
            if (vA !== vB) return vB - vA;
            return a.addedAt - b.addedAt;
          });
          roomQueues.set(roomId, [current, ...rest]);
        } else {
          roomQueues.set(roomId, queue);
        }

        io.to(roomId).emit('queue:updated', { queue: roomQueues.get(roomId) });
        console.log(`[VibeSync] Vote toggled for item ${item.videoTitle} by ${userMeta.username}`);
      } catch (error) {
        console.error('[VibeSync] queue:vote error:', error.message);
      }
    });

    socket.on('activity:update', (data) => {
      try {
        const { roomId, activity } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        userMeta.activity = activity || 'Watching...';
        connectedUsers.set(socket.id, userMeta);

        io.to(roomId).emit('activity:updated', {
          socketId: socket.id,
          username: userMeta.username,
          activity: userMeta.activity,
        });
      } catch (error) {
        console.error('[VibeSync] activity:update error:', error.message);
      }
    });

    socket.on('reaction:emit', (data) => {
      try {
        const { roomId, emoji } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        io.to(roomId).emit('reaction:emitted', {
          id: uuidv4(),
          emoji,
          username: userMeta.username,
          socketId: socket.id,
        });
      } catch (error) {
        console.error('[VibeSync] reaction:emit error:', error.message);
      }
    });

    // -----------------------------------------------------------------------
    // COLLABORATIVE QUEUE EVENTS
    // -----------------------------------------------------------------------

    // Add a video to the shared queue
    socket.on('queue:add', async (data) => {
      try {
        const { roomId, videoId, videoTitle, thumbnail, channel } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const queue = roomQueues.get(roomId) || [];
        // Avoid duplicates
        if (queue.some((item) => item.videoId === videoId)) {
          return socket.emit('error-occurred', { error: 'Video already in queue' });
        }

        const item = {
          id: uuidv4(),
          videoId,
          videoTitle: videoTitle || 'Unknown Video',
          thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          channel: channel || '',
          addedBy: userMeta.username,
          addedAt: Date.now(),
          votes: [userMeta.username], // Initially voted by adder
        };

        queue.push(item);
        roomQueues.set(roomId, queue);

        // If nothing is currently playing, auto-play this first item
        const roomSnap = await db.collection('rooms').doc(roomId).get();
        const roomData = roomSnap.exists ? roomSnap.data() : {};
        const hasCurrentVideo = !!(roomData.videoId || roomData.currentVideo?.videoId);

        if (!hasCurrentVideo) {
          // Auto-play first queued item
          await db.collection('rooms').doc(roomId).update({
            videoId: item.videoId,
            videoTitle: item.videoTitle,
            currentVideo: { videoId: item.videoId, videoTitle: item.videoTitle },
            videoState: 'paused',
            isPlaying: false,
            currentTime: 0,
            videoStartedAt: 0,
            videoStartOffset: 0
          });
          io.to(roomId).emit('video-changed', { videoId: item.videoId, videoTitle: item.videoTitle });
        }

        io.to(roomId).emit('queue:updated', { queue: roomQueues.get(roomId) || [] });
        console.log(`[VibeSync] ${userMeta.username} added ${videoTitle} to queue in room ${roomId}`);
      } catch (error) {
        console.error('[VibeSync] queue:add error:', error.message);
      }
    });

    // Remove a video from the queue
    socket.on('queue:remove', (data) => {
      try {
        const { roomId, itemId } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const queue = roomQueues.get(roomId) || [];
        const idx = queue.findIndex((item) => item.id === itemId);
        if (idx === -1) return;

        queue.splice(idx, 1);
        roomQueues.set(roomId, queue);
        io.to(roomId).emit('queue:updated', { queue });
        console.log(`[VibeSync] Queue item removed by ${userMeta.username} in room ${roomId}`);
      } catch (error) {
        console.error('[VibeSync] queue:remove error:', error.message);
      }
    });

    // Move item up or down in queue
    socket.on('queue:move', (data) => {
      try {
        const { roomId, itemId, direction } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const queue = roomQueues.get(roomId) || [];
        const idx = queue.findIndex((item) => item.id === itemId);
        if (idx === -1) return;

        if (direction === 'up' && idx > 0) {
          [queue[idx - 1], queue[idx]] = [queue[idx], queue[idx - 1]];
        } else if (direction === 'down' && idx < queue.length - 1) {
          [queue[idx], queue[idx + 1]] = [queue[idx + 1], queue[idx]];
        }

        roomQueues.set(roomId, queue);
        io.to(roomId).emit('queue:updated', { queue });
      } catch (error) {
        console.error('[VibeSync] queue:move error:', error.message);
      }
    });

    // Skip to a specific item in queue (or play next)
    socket.on('queue:skip', async (data) => {
      try {
        const { roomId, itemId } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const queue = roomQueues.get(roomId) || [];
        let nextItem;

        if (itemId) {
          // Skip to specific item
          nextItem = queue.find((item) => item.id === itemId);
          const idx = queue.findIndex((item) => item.id === itemId);
          if (idx > 0) {
            // Add skipped items to history
            const skipped = queue.slice(0, idx);
            for (const s of skipped) {
              addToRoomHistory(roomId, s.videoId, s.videoTitle, s.thumbnail, s.channel);
            }
            queue.splice(0, idx);
          }
        } else {
          // Play next item
          if (queue.length > 0) {
            const finished = queue.shift(); // remove current (first) item
            if (finished) {
              addToRoomHistory(roomId, finished.videoId, finished.videoTitle, finished.thumbnail, finished.channel);
            }
            nextItem = queue[0];
          }
        }

        roomQueues.set(roomId, queue);

        if (nextItem) {
          await db.collection('rooms').doc(roomId).update({
            videoId: nextItem.videoId,
            videoTitle: nextItem.videoTitle,
            currentVideo: { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle },
            videoState: 'paused',
            isPlaying: false,
            currentTime: 0,
            videoStartedAt: 0,
            videoStartOffset: 0
          });
          io.to(roomId).emit('video-changed', { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle });
          io.to(roomId).emit('video:next', { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle });
        } else {
          await db.collection('rooms').doc(roomId).update({
            videoId: null,
            videoTitle: null,
            currentVideo: { videoId: null, videoTitle: null },
            videoState: 'paused',
            isPlaying: false,
            currentTime: 0,
            videoStartedAt: 0,
            videoStartOffset: 0
          });
          io.to(roomId).emit('video-changed', { videoId: null, videoTitle: null });
          io.to(roomId).emit('video:next', { videoId: null, videoTitle: null });
        }

        io.to(roomId).emit('queue:updated', { queue });
        io.to(roomId).emit('history:updated', { history: roomHistories.get(roomId) || [] });
        console.log(`[VibeSync] Queue skip in room ${roomId} by ${userMeta.username}`);
      } catch (error) {
        console.error('[VibeSync] queue:skip error:', error.message);
      }
    });

    // Client signals video ended — auto-advance queue
    socket.on('queue:next', async (data) => {
      try {
        const { roomId } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta) return;

        const queue = roomQueues.get(roomId) || [];
        if (queue.length === 0) return;

        // Remove the first item (just finished)
        const finished = queue.shift();
        if (finished) {
          addToRoomHistory(roomId, finished.videoId, finished.videoTitle, finished.thumbnail, finished.channel);
        }
        const nextItem = queue[0];
        roomQueues.set(roomId, queue);

        if (nextItem) {
          await db.collection('rooms').doc(roomId).update({
            videoId: nextItem.videoId,
            videoTitle: nextItem.videoTitle,
            currentVideo: { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle },
            videoState: 'paused',
            isPlaying: false,
            currentTime: 0,
            videoStartedAt: 0,
            videoStartOffset: 0
          });
          io.to(roomId).emit('video-changed', { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle });
          io.to(roomId).emit('video:next', { videoId: nextItem.videoId, videoTitle: nextItem.videoTitle });
        } else {
          await db.collection('rooms').doc(roomId).update({
            videoId: null,
            videoTitle: null,
            currentVideo: { videoId: null, videoTitle: null },
            videoState: 'paused',
            isPlaying: false,
            currentTime: 0,
            videoStartedAt: 0,
            videoStartOffset: 0
          });
          io.to(roomId).emit('video-changed', { videoId: null, videoTitle: null });
          io.to(roomId).emit('video:next', { videoId: null, videoTitle: null });
        }

        io.to(roomId).emit('queue:updated', { queue });
        io.to(roomId).emit('history:updated', { history: roomHistories.get(roomId) || [] });
        console.log(`[VibeSync] Auto-advanced queue in room ${roomId}, next: ${nextItem?.videoTitle}`);
      } catch (error) {
        console.error('[VibeSync] queue:next error:', error.message);
      }
    });

    // -----------------------------------------------------------------------
    // CHAT EVENTS
    // -----------------------------------------------------------------------

    socket.on('send-message', async (data) => {
      try {
        if (!checkRateLimit(socket)) return;

        let { roomId, text } = data || {};
        const userMeta = connectedUsers.get(socket.id);

        if (!userMeta) {
          return socket.emit('error-occurred', { error: 'You are not in a room' });
        }

        if (!text || !text.trim()) {
          return socket.emit('error-occurred', { error: 'Message text is required' });
        }

        text = sanitizeInput(text.trim()).substring(0, 1000);

        const messageId = uuidv4();
        const message = {
          id: messageId,
          username: userMeta.username,
          text: text,
          timestamp: new Date().toISOString(),
          reactions: {},
        };

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (roomSnap.exists) {
          const roomData = roomSnap.data();
          const chatMessages = roomData.chatMessages || [];
          chatMessages.push(message);
          await roomRef.update({ chatMessages });
        }

        io.to(roomId).emit('new-message', message);
        console.log(`[VibeSync] Chat message in room ${roomId} by ${userMeta.username}`);
      } catch (error) {
        console.error('[VibeSync] send-message error:', error.message);
        socket.emit('error-occurred', { error: 'Failed to send message' });
      }
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      const userMeta = connectedUsers.get(socket.id);
      if (userMeta) {
        socket.to(roomId).emit('user-typing', {
          socketId: socket.id,
          username: userMeta.username,
          isTyping,
        });
      }
    });

    socket.on('add-reaction', async (data) => {
      try {
        const { roomId, messageId, emoji } = data || {};
        const userMeta = connectedUsers.get(socket.id);

        if (!userMeta) return;

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (roomSnap.exists) {
          const roomData = roomSnap.data();
          const chatMessages = roomData.chatMessages || [];
          const msgIndex = chatMessages.findIndex((m) => m.id === messageId);
          if (msgIndex !== -1) {
            const msg = chatMessages[msgIndex];
            const reactions = msg.reactions || {};
            if (!reactions[emoji]) reactions[emoji] = [];

            const userIndex = reactions[emoji].indexOf(userMeta.username);
            if (userIndex === -1) {
              reactions[emoji].push(userMeta.username);
            } else {
              reactions[emoji].splice(userIndex, 1);
              if (reactions[emoji].length === 0) delete reactions[emoji];
            }

            msg.reactions = reactions;
            chatMessages[msgIndex] = msg;
            await roomRef.update({ chatMessages });

            io.to(roomId).emit('reaction-updated', { messageId, reactions });
          }
        }
      } catch (error) {
        console.error('[VibeSync] add-reaction error:', error.message);
      }
    });

    // -----------------------------------------------------------------------
    // USER MANAGEMENT
    // -----------------------------------------------------------------------

    socket.on('kick-user', async (data) => {
      try {
        const { roomId, targetSocketId } = data || {};
        const userMeta = connectedUsers.get(socket.id);

        if (!userMeta || !userMeta.isAdmin) {
          return socket.emit('error-occurred', { error: 'Only the admin can kick users' });
        }

        const targetMeta = connectedUsers.get(targetSocketId);
        if (!targetMeta || targetMeta.roomId !== roomId) {
          return socket.emit('error-occurred', { error: 'User not found in this room' });
        }

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();

        if (roomSnap.exists) {
          const roomData = roomSnap.data();
          const updatedUsers = (roomData.users || []).filter(
            (p) => p.socketId !== targetSocketId
          );
          const updatedParticipants = (roomData.participants || []).filter(
            (p) => p.socketId !== targetSocketId
          );

          await roomRef.update({
            users: updatedUsers,
            participants: updatedParticipants
          });
        }

        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('user-kicked', {
            reason: 'You have been kicked by the admin',
          });
          targetSocket.leave(roomId);
        }

        connectedUsers.delete(targetSocketId);

        io.to(roomId).emit('user-left', {
          socketId: targetSocketId,
          username: targetMeta.username,
          reason: 'kicked',
        });

        console.log(`[VibeSync] ${targetMeta.username} kicked from room ${roomId}`);
      } catch (error) {
        console.error('[VibeSync] kick-user error:', error.message);
      }
    });

    // -----------------------------------------------------------------------
    // WEBRTC SIGNALING & FILE SHARING
    // -----------------------------------------------------------------------

    socket.on('webrtc-join', ({ roomId, username }) => {
      console.log(`[VibeSync] Mic connected. Camera connected. WebRTC join call: ${username} (${socket.id}) in room ${roomId}`);
      socket.to(roomId).emit('webrtc-peer-joined', { peerId: socket.id, peerUsername: username });
    });

    socket.on('webrtc-leave', ({ roomId }) => {
      console.log(`[VibeSync] WebRTC leave call: ${socket.id} in room ${roomId}`);
      socket.to(roomId).emit('webrtc-peer-left', { peerId: socket.id });
    });

    socket.on('webrtc-offer', ({ roomId, targetId, sdp }) => {
      const userMeta = connectedUsers.get(socket.id);
      io.to(targetId).emit('webrtc-offer', {
        senderId: socket.id,
        senderUsername: userMeta ? userMeta.username : 'Guest',
        sdp,
      });
    });

    socket.on('webrtc-answer', ({ roomId, targetId, sdp }) => {
      io.to(targetId).emit('webrtc-answer', {
        senderId: socket.id,
        sdp,
      });
    });

    socket.on('webrtc-ice-candidate', ({ roomId, targetId, candidate }) => {
      io.to(targetId).emit('webrtc-ice-candidate', {
        senderId: socket.id,
        candidate,
      });
    });

    socket.on('webrtc-toggle-audio', async ({ roomId, enabled }) => {
      const userMeta = connectedUsers.get(socket.id);
      if (userMeta) {
        try {
          const roomRef = db.collection('rooms').doc(roomId);
          const roomSnap = await roomRef.get();
          if (roomSnap.exists) {
            const roomData = roomSnap.data();
            const micStatus = roomData.micStatus || {};
            micStatus[socket.id] = enabled;
            await roomRef.update({ micStatus });
          }
        } catch (e) {}
      }
      socket.to(roomId).emit('webrtc-audio-toggled', { peerId: socket.id, enabled });
    });

    socket.on('webrtc-toggle-video', async ({ roomId, enabled }) => {
      const userMeta = connectedUsers.get(socket.id);
      if (userMeta) {
        try {
          const roomRef = db.collection('rooms').doc(roomId);
          const roomSnap = await roomRef.get();
          if (roomSnap.exists) {
            const roomData = roomSnap.data();
            const videoStatus = roomData.videoStatus || {};
            videoStatus[socket.id] = enabled;
            await roomRef.update({ videoStatus });
          }
        } catch (e) {}
      }
      socket.to(roomId).emit('webrtc-video-toggled', { peerId: socket.id, enabled });
    });

    socket.on('webrtc-screen-share', ({ roomId, sharing }) => {
      socket.to(roomId).emit('webrtc-video-toggled', { peerId: socket.id, enabled: sharing });
    });

    socket.on('file-share', async (data) => {
      try {
        const { roomId, fileName, fileType, fileSize, fileData, senderName, timestamp } = data;
        console.log(`[VibeSync] File shared. Uploading file ${fileName} in room ${roomId}...`);
        
        const fileId = uuidv4();
        const fileObj = {
          id: fileId,
          fileName,
          fileType,
          fileSize,
          fileData, 
          senderName,
          timestamp
        };

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (roomSnap.exists) {
          const roomData = roomSnap.data();
          const files = roomData.files || [];
          files.push(fileObj);
          await roomRef.update({ files });
        }

        io.to(roomId).emit('file-received', fileObj);
        console.log(`[VibeSync] File shared successfully: ${fileName}`);
      } catch (error) {
        console.error('[VibeSync] file-share error:', error.message);
      }
    });

    socket.on('delete-file', async (data) => {
      try {
        const { roomId, fileId } = data || {};
        const userMeta = connectedUsers.get(socket.id);
        if (!userMeta || !userMeta.isAdmin) {
          return socket.emit('error-occurred', { error: 'Only the admin can delete files' });
        }

        const roomRef = db.collection('rooms').doc(roomId);
        const roomSnap = await roomRef.get();
        if (roomSnap.exists) {
          const roomData = roomSnap.data();
          const files = (roomData.files || []).filter((f) => f.id !== fileId);
          await roomRef.update({ files });
          
          io.to(roomId).emit('file-deleted', { fileId, files });
        }
      } catch (error) {
        console.error('[VibeSync] delete-file error:', error.message);
      }
    });

    // -----------------------------------------------------------------------
    // WHITEBOARD
    // -----------------------------------------------------------------------

    socket.on('whiteboard-draw', (data) => {
      const { roomId, ...rest } = data;
      socket.to(roomId).emit('whiteboard-draw', rest);
    });

    socket.on('whiteboard-clear', ({ roomId }) => {
      socket.to(roomId).emit('whiteboard-clear');
    });

    socket.on('whiteboard-request-state', ({ roomId }) => {
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        const otherId = Array.from(roomSockets).find((id) => id !== socket.id);
        if (otherId) {
          io.to(otherId).emit('whiteboard-request-state', { requesterId: socket.id });
        }
      }
    });

    socket.on('whiteboard-state-response', ({ targetId, history }) => {
      io.to(targetId).emit('whiteboard-receive-state', { history });
    });

    // -----------------------------------------------------------------------
    // ARCADE GAMES (7+ MULTIPLAYER GAMES & LEADERBOARDS)
    // -----------------------------------------------------------------------

    const initRoomGameState = (roomId) => {
      let roomGame = activeGames.get(roomId);
      if (!roomGame) {
        roomGame = {
          activeGame: null,
          ttt: null,
          rps: null,
          chess: null,
          memory: null,
          reaction: null,
          leaderboards: {} 
        };
        activeGames.set(roomId, roomGame);
      }
      return roomGame;
    };

    socket.on('game-get-selected', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      socket.emit('game-selected', { game: roomGame.activeGame });
    });

    socket.on('game-select', ({ roomId, game }) => {
      const roomGame = initRoomGameState(roomId);
      roomGame.activeGame = game;
      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('game-selected', { game });
    });

    // --- Tic Tac Toe ---
    const getInitialTTT = () => ({
      board: Array(9).fill(null),
      players: { X: null, O: null },
      turn: 'X',
      winner: null,
    });

    socket.on('ttt-join', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.ttt) {
        roomGame.ttt = getInitialTTT();
        activeGames.set(roomId, roomGame);
      }
      socket.emit('ttt-state', roomGame.ttt);
    });

    socket.on('ttt-join-slot', ({ roomId, symbol }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.ttt) return;

      if (symbol === 'X' || symbol === 'O') {
        roomGame.ttt.players[symbol] = socket.id;
        activeGames.set(roomId, roomGame);
        io.to(roomId).emit('ttt-state', roomGame.ttt);
      }
    });

    const calculateTTTWinner = (squares) => {
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];
      for (const [a, b, c] of lines) {
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
          return squares[a];
        }
      }
      if (squares.every((s) => s !== null)) return 'draw';
      return null;
    };

    socket.on('ttt-move', ({ roomId, index }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.ttt) return;
      const game = roomGame.ttt;

      const currentSlot = game.turn;
      if (game.players[currentSlot] !== socket.id) return; 
      if (game.board[index] || game.winner) return; 

      game.board[index] = currentSlot;
      const winner = calculateTTTWinner(game.board);
      if (winner) {
        game.winner = winner;
      } else {
        game.turn = currentSlot === 'X' ? 'O' : 'X';
      }

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('ttt-state', game);
    });

    socket.on('ttt-reset', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.ttt) return;

      roomGame.ttt.board = Array(9).fill(null);
      roomGame.ttt.turn = 'X';
      roomGame.ttt.winner = null;

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('ttt-reset');
      io.to(roomId).emit('ttt-state', roomGame.ttt);
    });

    // --- Rock Paper Scissors ---
    const getInitialRPS = () => ({
      players: { p1: null, p2: null }, 
      moves: { p1: null, p2: null },
      winner: null,
      scores: { p1: 0, p2: 0 },
    });

    socket.on('rps-join', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.rps) {
        roomGame.rps = getInitialRPS();
        activeGames.set(roomId, roomGame);
      }
      
      const sanitized = {
        players: roomGame.rps.players,
        moves: {
          p1: roomGame.rps.moves.p1 ? 'selected' : null,
          p2: roomGame.rps.moves.p2 ? 'selected' : null,
        },
        winner: roomGame.rps.winner,
        scores: roomGame.rps.scores,
      };
      if (roomGame.rps.winner) {
        sanitized.moves = roomGame.rps.moves;
      }
      socket.emit('rps-state', sanitized);
    });

    socket.on('rps-join-slot', ({ roomId, role }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.rps) return;
      const userMeta = connectedUsers.get(socket.id);
      if (!userMeta) return;

      if (role === 'p1' || role === 'p2') {
        roomGame.rps.players[role] = {
          socketId: socket.id,
          username: userMeta.username,
        };
        activeGames.set(roomId, roomGame);
        io.to(roomId).emit('rps-state', roomGame.rps);
      }
    });

    const calculateRPSWinner = (m1, m2) => {
      if (m1 === m2) return 'tie';
      if (
        (m1 === 'Rock' && m2 === 'Scissors') ||
        (m1 === 'Paper' && m2 === 'Rock') ||
        (m1 === 'Scissors' && m2 === 'Paper')
      ) {
        return 'p1';
      }
      return 'p2';
    };

    socket.on('rps-move', ({ roomId, move }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.rps) return;
      const game = roomGame.rps;

      let role = null;
      if (game.players.p1?.socketId === socket.id) role = 'p1';
      else if (game.players.p2?.socketId === socket.id) role = 'p2';
      if (!role || game.moves[role] || game.winner) return; 

      game.moves[role] = move;

      if (game.moves.p1 && game.moves.p2) {
        const winner = calculateRPSWinner(game.moves.p1, game.moves.p2);
        game.winner = winner;
        if (winner === 'p1' || winner === 'p2') {
          game.scores[winner] += 1;
        }
        activeGames.set(roomId, roomGame);
        io.to(roomId).emit('rps-state', game);
      } else {
        activeGames.set(roomId, roomGame);
        const p1Status = {
          players: game.players,
          moves: {
            p1: game.moves.p1 ? 'selected' : null,
            p2: game.moves.p2 ? 'selected' : null,
          },
          winner: null,
          scores: game.scores,
        };
        io.to(roomId).emit('rps-state', p1Status);
      }
    });

    socket.on('rps-reset', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.rps) return;

      roomGame.rps.moves = { p1: null, p2: null };
      roomGame.rps.winner = null;

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('rps-reset');
      io.to(roomId).emit('rps-state', roomGame.rps);
    });

    // --- Chess ---
    const getInitialChess = () => ({
      board: null, 
      players: { white: null, black: null },
      turn: 'white',
      history: []
    });

    socket.on('chess-join', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.chess) {
        roomGame.chess = getInitialChess();
        activeGames.set(roomId, roomGame);
      }
      socket.emit('chess-state', roomGame.chess);
    });

    socket.on('chess-join-slot', ({ roomId, role }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.chess) return;

      if (role === 'white' || role === 'black') {
        roomGame.chess.players[role] = socket.id;
        activeGames.set(roomId, roomGame);
        io.to(roomId).emit('chess-state', roomGame.chess);
      }
    });

    socket.on('chess-move', ({ roomId, moveState }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.chess) return;

      roomGame.chess.board = moveState.board;
      roomGame.chess.turn = moveState.turn;
      roomGame.chess.history = moveState.history;

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('chess-state', roomGame.chess);
    });

    socket.on('chess-reset', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.chess) return;

      roomGame.chess.board = null;
      roomGame.chess.turn = 'white';
      roomGame.chess.history = [];

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('chess-state', roomGame.chess);
    });

    // --- Memory Game ---
    const getInitialMemory = () => ({
      players: { p1: null, p2: null }, 
      flippedIndices: [],
      matchedPairs: [],
      scores: { p1: 0, p2: 0 },
      turn: 'p1',
      cards: []
    });

    socket.on('memory-join', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.memory) {
        roomGame.memory = getInitialMemory();
        activeGames.set(roomId, roomGame);
      }
      socket.emit('memory-state', roomGame.memory);
    });

    socket.on('memory-join-slot', ({ roomId, role }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.memory) return;

      if (role === 'p1' || role === 'p2') {
        roomGame.memory.players[role] = socket.id;
        activeGames.set(roomId, roomGame);
        io.to(roomId).emit('memory-state', roomGame.memory);
      }
    });

    socket.on('memory-update-state', ({ roomId, gameState }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.memory) return;

      roomGame.memory = { ...roomGame.memory, ...gameState };
      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('memory-state', roomGame.memory);
    });

    socket.on('memory-reset', ({ roomId, cards }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.memory) return;

      roomGame.memory = getInitialMemory();
      roomGame.memory.cards = cards || [];

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('memory-state', roomGame.memory);
    });

    // --- Reaction Game ---
    const getInitialReaction = () => ({
      scores: {}, 
      status: 'idle', 
      winner: null
    });

    socket.on('reaction-join', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.reaction) {
        roomGame.reaction = getInitialReaction();
        activeGames.set(roomId, roomGame);
      }
      socket.emit('reaction-state', roomGame.reaction);
    });

    socket.on('reaction-start-round', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.reaction) return;

      roomGame.reaction.status = 'waiting';
      roomGame.reaction.winner = null;
      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('reaction-state', roomGame.reaction);

      const delay = Math.random() * 3000 + 2000;
      setTimeout(() => {
        const currentRoomGame = activeGames.get(roomId);
        if (currentRoomGame?.activeGame === 'reaction' && currentRoomGame.reaction?.status === 'waiting') {
          currentRoomGame.reaction.status = 'active';
          activeGames.set(roomId, currentRoomGame);
          io.to(roomId).emit('reaction-trigger');
          io.to(roomId).emit('reaction-state', currentRoomGame.reaction);
        }
      }, delay);
    });

    socket.on('reaction-click', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.reaction || roomGame.reaction.status !== 'active') return;

      const userMeta = connectedUsers.get(socket.id);
      if (!userMeta) return;

      roomGame.reaction.status = 'idle';
      roomGame.reaction.winner = userMeta.username;
      roomGame.reaction.scores[userMeta.username] = (roomGame.reaction.scores[userMeta.username] || 0) + 1;

      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('reaction-state', roomGame.reaction);
      io.to(roomId).emit('reaction-round-result', { winner: userMeta.username, scores: roomGame.reaction.scores });
    });

    socket.on('reaction-reset', ({ roomId }) => {
      const roomGame = initRoomGameState(roomId);
      if (!roomGame.reaction) return;

      roomGame.reaction = getInitialReaction();
      activeGames.set(roomId, roomGame);
      io.to(roomId).emit('reaction-state', roomGame.reaction);
    });

    // --- Leaderboards for Snake, 2048, and Mini Golf ---
    socket.on('game-score-update', ({ roomId, game, score }) => {
      const roomGame = initRoomGameState(roomId);
      const userMeta = connectedUsers.get(socket.id);
      if (!userMeta) return;

      if (!roomGame.leaderboards[game]) {
        roomGame.leaderboards[game] = {};
      }

      const isGolf = game === 'golf';
      const currentBest = roomGame.leaderboards[game][userMeta.username];
      
      let shouldUpdate = false;
      if (currentBest === undefined) {
        shouldUpdate = true;
      } else if (isGolf) {
        shouldUpdate = score < currentBest; 
      } else {
        shouldUpdate = score > currentBest; 
      }

      if (shouldUpdate) {
        roomGame.leaderboards[game][userMeta.username] = score;
        activeGames.set(roomId, roomGame);
        io.to(roomId).emit('game-leaderboard-updated', { game, leaderboard: roomGame.leaderboards[game] });
      }
    });

    socket.on('game-get-leaderboard', ({ roomId, game }) => {
      const roomGame = initRoomGameState(roomId);
      const leaderboard = roomGame.leaderboards[game] || {};
      socket.emit('game-leaderboard-updated', { game, leaderboard });
    });

    // -----------------------------------------------------------------------
    // DISCONNECT
    // -----------------------------------------------------------------------

    socket.on('disconnect', async (reason) => {
      console.log(`[VibeSync] Socket disconnected: ${socket.id} (${reason})`);
      socketMessageCounts.delete(socket.id);
      await removeUserFromRoom(io, db, socket, 'disconnected');
    });
  });

  console.log('[VibeSync] Socket handlers registered');
}

module.exports = { setupSocketHandlers, connectedUsers };
