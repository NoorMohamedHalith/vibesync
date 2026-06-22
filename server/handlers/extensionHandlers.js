const { v4: uuidv4 } = require('uuid');

// In-memory extension datastores
const friendsDb = new Map(); // username -> { friends: Set, followers: Set, following: Set, pendingRequests: Set }
const profilesDb = new Map(); // username -> { avatar, bio, badges: Set, favoriteSongs: [], favoriteArtists: [], streaks: 1, history: [], timeline: [] }
const publicRooms = new Map(); // roomId -> { roomId, roomName, category, participantsCount, isPublic: true }
const vibespaceStates = new Map(); // roomId -> Map(socketId -> { x, y, avatar, username })
const socketRateLimits = new Map(); // socketId -> { tokens: 20, lastRefill: Date }
const userBlocks = new Map(); // username -> Set(blockedUsernames)

// VibeBot song lists
const MOOD_PLAYLISTS = {
  tamil: [
    { videoId: 'h7V4zGf54O4', videoTitle: 'Anirudh - Tamil Romantic Hit', thumbnail: 'https://img.youtube.com/vi/h7V4zGf54O4/0.jpg', channel: 'Sony Music South' },
    { videoId: 'tPEE9ZwTPEE', videoTitle: 'Harris Jayaraj - Tamil Melodies', thumbnail: 'https://img.youtube.com/vi/tPEE9ZwTPEE/0.jpg', channel: 'Harris Jayaraj Official' },
    { videoId: 'W3L38gO_eN4', videoTitle: 'AR Rahman - Tamil Classic Love', thumbnail: 'https://img.youtube.com/vi/W3L38gO_eN4/0.jpg', channel: 'AR Rahman' }
  ],
  party: [
    { videoId: 'kJQP7kiw5Fk', videoTitle: 'Luis Fonsi - Despacito Party', thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/0.jpg', channel: 'LuisFonsiVEVO' },
    { videoId: 'OPf0YbXqDm0', videoTitle: 'Mark Ronson - Uptown Funk', thumbnail: 'https://img.youtube.com/vi/OPf0YbXqDm0/0.jpg', channel: 'MarkRonsonVEVO' }
  ],
  lofi: [
    { videoId: 'jfKfPfyJRdk', videoTitle: 'Lofi Girl - Chill Lofi Beats', thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/0.jpg', channel: 'Lofi Girl' },
    { videoId: '5qap5aO4i9A', videoTitle: 'Lofi Hip Hop Radio', thumbnail: 'https://img.youtube.com/vi/5qap5aO4i9A/0.jpg', channel: 'ChilledCow' }
  ],
  chill: [
    { videoId: 'dxMv_xVskYw', videoTitle: 'Billie Eilish - Ocean Eyes Chill', thumbnail: 'https://img.youtube.com/vi/dxMv_xVskYw/0.jpg', channel: 'BillieEilishVEVO' },
    { videoId: '09R8_2nJtjg', videoTitle: 'Maroon 5 - Sugar Chill', thumbnail: 'https://img.youtube.com/vi/09R8_2nJtjg/0.jpg', channel: 'Maroon5VEVO' }
  ],
  workout: [
    { videoId: '2X_2IdmaZtY', videoTitle: 'Survivor - Eye Of The Tiger Workout', thumbnail: 'https://img.youtube.com/vi/2X_2IdmaZtY/0.jpg', channel: 'SurvivorVEVO' },
    { videoId: 'X7rdg_tK5QA', videoTitle: 'Workout Beats Mix 2024', thumbnail: 'https://img.youtube.com/vi/X7rdg_tK5QA/0.jpg', channel: 'Workout Club' }
  ],
  study: [
    { videoId: 'DWcJFNfaw9c', videoTitle: 'Mozart - Classical Study Music', thumbnail: 'https://img.youtube.com/vi/DWcJFNfaw9c/0.jpg', channel: 'Classical Tunes' },
    { videoId: 'T8s8O6e32F4', videoTitle: 'Ambient Study Focus Beats', thumbnail: 'https://img.youtube.com/vi/T8s8O6e32F4/0.jpg', channel: 'Focus Ambient' }
  ],
  romantic: [
    { videoId: 'rtOvBOTyX00', videoTitle: 'Christina Perri - A Thousand Years', thumbnail: 'https://img.youtube.com/vi/rtOvBOTyX00/0.jpg', channel: 'Christina Perri' },
    { videoId: 'lp-EO5I60KA', videoTitle: 'Ed Sheeran - Thinking Out Loud', thumbnail: 'https://img.youtube.com/vi/lp-EO5I60KA/0.jpg', channel: 'Ed Sheeran' }
  ]
};

// Seed profiles database
const getProfile = (username) => {
  if (!profilesDb.has(username)) {
    profilesDb.set(username, {
      avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(username)}`,
      bio: 'VibeSync music lover!',
      badges: new Set(['Vibe Master']),
      favoriteSongs: ['Despacito', 'A Thousand Years'],
      favoriteArtists: ['Anirudh', 'Ed Sheeran'],
      streaks: 3,
      history: [],
      timeline: [`Joined VibeSync!`]
    });
  }
  const raw = profilesDb.get(username);
  return {
    ...raw,
    badges: Array.from(raw.badges)
  };
};

const getFriendsData = (username) => {
  if (!friendsDb.has(username)) {
    friendsDb.set(username, {
      friends: new Set(),
      followers: new Set(),
      following: new Set(),
      pendingRequests: new Set()
    });
  }
  return friendsDb.get(username);
};

// Rate limiter logic: 20 events per 5 seconds max
const checkRateLimit = (socketId) => {
  const now = new Date();
  if (!socketRateLimits.has(socketId)) {
    socketRateLimits.set(socketId, { tokens: 20, lastRefill: now });
    return true;
  }
  const limit = socketRateLimits.get(socketId);
  const timePassed = (now - limit.lastRefill) / 1000;
  // Refill tokens
  limit.tokens = Math.min(20, limit.tokens + timePassed * 4); // 4 tokens per second
  limit.lastRefill = now;
  
  if (limit.tokens >= 1) {
    limit.tokens -= 1;
    return true;
  }
  return false;
};

// Simple translations
const TRANSLATIONS = {
  en: {
    tamil: 'தமிழ்',
    party: 'கொண்டாட்டம்',
    typing: 'Typing...',
    watching: 'Watching...',
    hello: 'Hello!',
    welcome: 'Welcome to the watch party!'
  },
  ta: {
    tamil: 'Tamil',
    party: 'Party',
    typing: 'தட்டச்சு செய்கிறார்...',
    watching: 'பார்த்துக் கொண்டிருக்கிறார்...',
    hello: 'வணக்கம்!',
    welcome: 'வாட்ச் பார்ட்டிக்கு வரவேற்கிறோம்!'
  }
};

function registerExtensionHandlers(io, socket, connectedUsers, roomQueues, db) {
  
  // Rate limiting interceptor
  socket.use((packet, next) => {
    if (!checkRateLimit(socket.id)) {
      console.warn(`[VibeSync Extension] Rate limit exceeded for socket: ${socket.id}`);
      return next(new Error('Rate limit exceeded. Slow down!'));
    }
    next();
  });

  // 1. AI DJ / VibeBot Handler
  socket.on('vibebot:message', async (data) => {
    try {
      const { roomId, text } = data || {};
      const userMeta = connectedUsers.get(socket.id);
      if (!userMeta) return;

      const query = (text || '').toLowerCase();
      let botResponseText = "I couldn't figure out that vibe. Try saying 'Play romantic Tamil songs', 'lofi vibes', or 'workout mood'.";
      let playlistToLoad = null;

      if (query.includes('romantic') || query.includes('love')) {
        playlistToLoad = MOOD_PLAYLISTS.romantic;
        botResponseText = "💖 Setting a romantic vibe. Adding classic love songs to the queue!";
      } else if (query.includes('tamil')) {
        playlistToLoad = MOOD_PLAYLISTS.tamil;
        botResponseText = "🎵 Tamil hits vibe activated! Queue updated with massive Tamil bangers.";
      } else if (query.includes('lofi') || query.includes('chill') || query.includes('relax')) {
        playlistToLoad = query.includes('lofi') ? MOOD_PLAYLISTS.lofi : MOOD_PLAYLISTS.chill;
        botResponseText = "🎧 Chilled lofi/beats incoming. Sit back, relax and sync up.";
      } else if (query.includes('party') || query.includes('dance')) {
        playlistToLoad = MOOD_PLAYLISTS.party;
        botResponseText = "🔥 Let's party! Adding high-energy tracks to the queue.";
      } else if (query.includes('workout') || query.includes('gym')) {
        playlistToLoad = MOOD_PLAYLISTS.workout;
        botResponseText = "⚡ Gym vibes loaded. Time to pump it up!";
      } else if (query.includes('study') || query.includes('focus')) {
        playlistToLoad = MOOD_PLAYLISTS.study;
        botResponseText = "📚 Focus music engaged. Classical and ambient beats queue loaded.";
      }

      if (playlistToLoad) {
        const queue = roomQueues.get(roomId) || [];
        for (const track of playlistToLoad) {
          const item = {
            id: uuidv4(),
            videoId: track.videoId,
            videoTitle: track.videoTitle,
            thumbnail: track.thumbnail,
            channel: track.channel,
            addedBy: 'VibeBot AI',
            addedAt: Date.now(),
            votes: ['VibeBot AI']
          };
          // Prevent duplicates in queue
          if (!queue.some(q => q.videoId === track.videoId)) {
            queue.push(item);
          }
        }
        roomQueues.set(roomId, queue);
        io.to(roomId).emit('queue:updated', { queue });
      }

      // Emit bot message back to room chat
      const systemMessage = {
        id: `bot-${Date.now()}`,
        username: 'VibeBot AI 🤖',
        text: botResponseText,
        timestamp: new Date().toISOString(),
        reactions: {}
      };
      
      io.to(roomId).emit('new-message', systemMessage);
    } catch (err) {
      console.error('[VibeSync Extension] VibeBot error:', err.message);
    }
  });

  // 2. Friend System Handlers
  socket.on('friends:request', (data) => {
    const { targetUsername } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta || !targetUsername) return;

    const targetFriends = getFriendsData(targetUsername);
    targetFriends.pendingRequests.add(userMeta.username);

    // Alert target user if online
    for (const [sid, meta] of connectedUsers.entries()) {
      if (meta.username === targetUsername) {
        io.to(sid).emit('friends:request_received', { from: userMeta.username });
        break;
      }
    }
    socket.emit('friends:updated', { success: true, message: `Request sent to ${targetUsername}` });
  });

  socket.on('friends:respond', (data) => {
    const { targetUsername, accept } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta || !targetUsername) return;

    const myFriends = getFriendsData(userMeta.username);
    myFriends.pendingRequests.delete(targetUsername);

    if (accept) {
      myFriends.friends.add(targetUsername);
      myFriends.following.add(targetUsername);
      
      const targetFriends = getFriendsData(targetUsername);
      targetFriends.friends.add(userMeta.username);
      targetFriends.following.add(userMeta.username);
      
      // Update stats and timeline
      const myProfile = getProfile(userMeta.username);
      myProfile.timeline.push(`Became friends with ${targetUsername}`);
      const targetProfile = getProfile(targetUsername);
      targetProfile.timeline.push(`Became friends with ${userMeta.username}`);
      
      // Unlock badge if friends >= 5
      if (myFriends.friends.size >= 5) {
        profilesDb.get(userMeta.username).badges.add('Party King 🔥');
      }
    }

    // Refresh lists for both if online
    socket.emit('friends:list_updated', {
      friends: Array.from(myFriends.friends),
      pending: Array.from(myFriends.pendingRequests)
    });

    for (const [sid, meta] of connectedUsers.entries()) {
      if (meta.username === targetUsername) {
        const tf = getFriendsData(targetUsername);
        io.to(sid).emit('friends:list_updated', {
          friends: Array.from(tf.friends),
          pending: Array.from(tf.pendingRequests)
        });
        break;
      }
    }
  });

  socket.on('friends:list', () => {
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta) return;

    const myFriends = getFriendsData(userMeta.username);
    socket.emit('friends:list_updated', {
      friends: Array.from(myFriends.friends).map(f => {
        // Find if online
        let online = false;
        for (const meta of connectedUsers.values()) {
          if (meta.username === f) { online = true; break; }
        }
        return { username: f, online, avatar: getProfile(f).avatar };
      }),
      pending: Array.from(myFriends.pendingRequests),
      followers: Array.from(myFriends.followers),
      following: Array.from(myFriends.following)
    });
  });

  socket.on('friends:invite', (data) => {
    const { targetUsername, roomId } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta || !targetUsername || !roomId) return;

    for (const [sid, meta] of connectedUsers.entries()) {
      if (meta.username === targetUsername) {
        io.to(sid).emit('notification:new', {
          type: 'invite',
          message: `${userMeta.username} invited you to watch party room ${roomId}!`,
          roomId
        });
        break;
      }
    }
  });

  // 3. User Profiles Handlers
  socket.on('profile:get', (data) => {
    const { targetUsername } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    const queryName = targetUsername || userMeta?.username;
    if (!queryName) return;

    socket.emit('profile:details', { profile: getProfile(queryName) });
  });

  socket.on('profile:update', (data) => {
    const { bio, favoriteSongs, favoriteArtists } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta) return;

    const prof = profilesDb.get(userMeta.username);
    if (prof) {
      if (bio !== undefined) prof.bio = bio;
      if (favoriteSongs !== undefined) prof.favoriteSongs = favoriteSongs;
      if (favoriteArtists !== undefined) prof.favoriteArtists = favoriteArtists;
      
      socket.emit('profile:details', { profile: getProfile(userMeta.username) });
    }
  });

  // 4. Public Rooms Category listing
  socket.on('rooms:public', () => {
    const list = Array.from(publicRooms.values());
    socket.emit('rooms:public_list', { rooms: list });
  });

  socket.on('rooms:register_public', (data) => {
    const { roomId, roomName, category } = data || {};
    if (!roomId) return;

    publicRooms.set(roomId, {
      roomId,
      roomName: roomName || 'Public Vibes Room',
      category: category || 'Tamil',
      participantsCount: vibespaceStates.get(roomId)?.size || 1,
      isPublic: true
    });

    io.emit('rooms:public_list', { rooms: Array.from(publicRooms.values()) });
  });

  // 5. Synced Karaoke Lyrics & Duet Sync
  socket.on('karaoke:lyrics:sync', (data) => {
    const { roomId, lyricsLine, timeOffset } = data || {};
    if (!roomId) return;
    
    // Sync karaoke details with everyone in the room
    socket.to(roomId).emit('karaoke:lyrics:highlighted', { lyricsLine, timeOffset });
  });

  socket.on('karaoke:duet:toggle', (data) => {
    const { roomId, isDuet, duetPartner } = data || {};
    if (!roomId) return;
    
    io.to(roomId).emit('karaoke:duet:updated', { isDuet, duetPartner });
  });

  // 6. 2D Proximity Social Space VibeSpace sync coordinate handlers
  socket.on('vibespace:join', (data) => {
    const { roomId, avatar } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta || !roomId) return;

    if (!vibespaceStates.has(roomId)) {
      vibespaceStates.set(roomId, new Map());
    }

    const roomSpace = vibespaceStates.get(roomId);
    roomSpace.set(socket.id, {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      avatar: avatar || `avatar-1`,
      username: userMeta.username
    });

    // Broadcast current social coordinate state
    io.to(roomId).emit('vibespace:sync', {
      participants: Array.from(roomSpace.entries()).map(([sid, payload]) => ({
        socketId: sid,
        ...payload
      }))
    });
  });

  socket.on('vibespace:move', (data) => {
    const { roomId, x, y } = data || {};
    if (!roomId) return;

    if (!vibespaceStates.has(roomId)) {
      vibespaceStates.set(roomId, new Map());
    }
    const roomSpace = vibespaceStates.get(roomId);
    if (!roomSpace.has(socket.id)) {
      const userMeta = connectedUsers.get(socket.id);
      roomSpace.set(socket.id, {
        x,
        y,
        avatar: 'avatar-1',
        username: userMeta?.username || 'Guest'
      });
    } else {
      const p = roomSpace.get(socket.id);
      p.x = x;
      p.y = y;
    }
    
    // Broadcast moving state coordinates
    socket.to(roomId).emit('vibespace:updated', {
      socketId: socket.id,
      x,
      y
    });
  });

  socket.on('vibespace:leave', (data) => {
    const { roomId } = data || {};
    if (!roomId) return;

    const roomSpace = vibespaceStates.get(roomId);
    if (roomSpace) {
      roomSpace.delete(socket.id);
      io.to(roomId).emit('vibespace:removed', { socketId: socket.id });
    }
  });

  // 7. Live Translate request stub
  socket.on('translation:request', (data) => {
    const { text, from, to } = data || {};
    if (!text) return;

    // Direct mockup mapper translations
    const translated = TRANSLATIONS[to]?.[text.toLowerCase()] || text;
    socket.emit('translation:result', { originalText: text, translatedText: translated });
  });

  // 8. Moderation: Report & User blocks
  socket.on('user:moderation', (data) => {
    const { action, targetUsername, roomId } = data || {};
    const userMeta = connectedUsers.get(socket.id);
    if (!userMeta || !targetUsername) return;

    if (action === 'block') {
      if (!userBlocks.has(userMeta.username)) {
        userBlocks.set(userMeta.username, new Set());
      }
      userBlocks.get(userMeta.username).add(targetUsername);
      socket.emit('moderation:alert', { success: true, message: `Successfully blocked ${targetUsername}` });
    } else if (action === 'report') {
      console.log(`[VibeSync Moderation] Report received: ${userMeta.username} reported ${targetUsername} in room ${roomId}`);
      io.to(roomId).emit('moderation:report_logged', { reporter: userMeta.username, reported: targetUsername });
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    socketRateLimits.delete(socket.id);
    for (const [roomId, roomSpace] of vibespaceStates.entries()) {
      if (roomSpace.has(socket.id)) {
        roomSpace.delete(socket.id);
        io.to(roomId).emit('vibespace:removed', { socketId: socket.id });
      }
    }
  });
}

module.exports = registerExtensionHandlers;
