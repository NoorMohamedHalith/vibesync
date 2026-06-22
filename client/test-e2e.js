import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

console.log('[E2E Test] Starting comprehensive collaborative playback and queue E2E tests...');

const clientA = io(SERVER_URL, { forceNew: true });
const clientB = io(SERVER_URL, { forceNew: true });

let roomId = null;
let currentStep = 0;

// Setup connection failure exit
const handleConnectError = (clientName, err) => {
  console.error(`[E2E Test] ${clientName} connection error:`, err.message);
  process.exit(1);
};
clientA.on('connect_error', (err) => handleConnectError('Client A (Alice)', err));
clientB.on('connect_error', (err) => handleConnectError('Client B (Bob)', err));

// Alice creates room
clientA.on('connect', () => {
  console.log('[E2E Test] Client A connected. Alice creating room...');
  clientA.emit('create-room', {
    roomName: 'Collaborative Watch Room',
    username: 'Alice',
    password: null
  }, (response) => {
    if (!response || response.error) {
      console.error('[E2E Test] Create Room failed:', response?.error);
      process.exit(1);
    }
  });
});

// Alice gets room created info
clientA.on('room-created', (data) => {
  console.log('[E2E Test] Room created successfully. Code:', data.roomId);
  roomId = data.roomId;
  
  // Bob joins room
  console.log('[E2E Test] Client B connecting. Bob joining room:', roomId);
  clientB.emit('join-room', {
    roomId: roomId,
    username: 'Bob',
    password: ''
  }, (response) => {
    if (!response || response.error) {
      console.error('[E2E Test] Join Room failed:', response?.error);
      process.exit(1);
    }
  });
});

// Bob gets room joined info
clientB.on('room-joined', (data) => {
  console.log('[E2E Test] Bob joined room. Active participants count:', data.participants?.length);
  
  // Step 1: Alice (Admin) plays video -> Bob (User) should receive video:play or video-played
  console.log('[E2E Test] Step 1: Alice plays video at t=10s...');
  clientA.emit('video:play', { roomId, currentTime: 10 });
});

// Listeners for Step 1
clientB.on('video:play', (playData) => {
  if (currentStep === 0) {
    console.log('[E2E Test] Alice plays -> Bob receives video:play: SUCCESS (t =', playData.currentTime, ')');
    currentStep = 1;
    
    // Step 2: Bob (User) pauses video -> Alice (Admin) should receive video:pause or video-paused
    console.log('[E2E Test] Step 2: Bob pauses video at t=12s...');
    clientB.emit('video:pause', { roomId, currentTime: 12 });
  }
});

// Listeners for Step 2
clientA.on('video:pause', (pauseData) => {
  if (currentStep === 1) {
    console.log('[E2E Test] Bob pauses -> Alice receives video:pause: SUCCESS (t =', pauseData.currentTime, ')');
    currentStep = 2;
    
    // Step 3: Bob (User) seeks video -> Alice (Admin) should receive video:seek or video-seeked
    console.log('[E2E Test] Step 3: Bob seeks video to t=120s...');
    clientB.emit('video:seek', { roomId, currentTime: 120 });
  }
});

// Listeners for Step 3
clientA.on('video:seek', (seekData) => {
  if (currentStep === 2) {
    console.log('[E2E Test] Bob seeks -> Alice receives video:seek: SUCCESS (t =', seekData.currentTime, ')');
    currentStep = 3;
    
    // Step 4: Queue synchronization (Bob adds song to queue)
    console.log('[E2E Test] Step 4: Bob adding first song to queue...');
    clientB.emit('queue:add', {
      roomId,
      videoId: 'song-1-id',
      videoTitle: 'Song One Title',
      thumbnail: 'thumb-1',
      channel: 'Channel One'
    });
  }
});

// Listeners for Queue updates & autoplay
clientA.on('queue:updated', (queueData) => {
  const queue = queueData.queue;
  console.log('[E2E Test] Queue updated event received. Queue size:', queue.length);
  
  if (currentStep === 3) {
    if (queue.length === 1 && queue[0].videoId === 'song-1-id') {
      console.log('[E2E Test] Bob adds song -> Alice receives queue:updated: SUCCESS');
      currentStep = 4;
      
      // Bob adds second song to queue
      console.log('[E2E Test] Step 4b: Bob adding second song to queue...');
      clientB.emit('queue:add', {
        roomId,
        videoId: 'song-2-id',
        videoTitle: 'Song Two Title',
        thumbnail: 'thumb-2',
        channel: 'Channel Two'
      });
    }
  } else if (currentStep === 4) {
    if (queue.length === 2 && queue[1].videoId === 'song-2-id') {
      console.log('[E2E Test] Bob adds second song -> Alice receives queue:updated: SUCCESS');
      currentStep = 5;
      
      // Step 5: Autoplay next video. Alice's player detects song 1 ended. Emits video:ended.
      console.log('[E2E Test] Step 5: Alice player signals video:ended for song-1-id...');
      clientA.emit('video:ended', { roomId, videoId: 'song-1-id' });
    }
  } else if (currentStep === 6) {
    // Verified next queue update
    console.log('[E2E Test] Post-ended queue size is now:', queue.length);
  } else if (currentStep === 10) {
    const item = queue.find((i) => i.videoId === 'song-3-id');
    if (item) {
      console.log('[E2E Test] Bob adds song-3-id -> queue updated. Alice voting for song-3-id...');
      currentStep = 11;
      clientA.emit('queue:vote', { roomId, itemId: item.id });
    }
  } else if (currentStep === 11) {
    const item = queue.find((i) => i.videoId === 'song-3-id');
    if (item && item.votes.includes('Alice') && item.votes.includes('Bob')) {
      console.log('[E2E Test] Alice votes -> Alice receives queue:updated with Alice and Bob votes: SUCCESS');
      currentStep = 12;
      
      // Step 12: Skip/Advance current song (song-2-id) to push it to Room History
      console.log('[E2E Test] Step 12: Waiting 3.5 seconds for server lockout, then Alice ends video song-2-id...');
      setTimeout(() => {
        clientA.emit('video:ended', { roomId, videoId: 'song-2-id' });
      }, 3500);
    }
  }
});

// Listeners for video:ended propagation
clientB.on('video:ended', (endedData) => {
  console.log('[E2E Test] Bob received video:ended notice for:', endedData.videoId);
});

// Listeners for video:next propagation (Autoplay trigger)
clientB.on('video:next', (nextData) => {
  if (currentStep === 5) {
    if (nextData.videoId === 'song-2-id') {
      console.log('[E2E Test] Song 1 ended -> Bob receives video:next for Song 2: SUCCESS');
      currentStep = 6;
      
      // Step 6: Test Recommendations load event sync
      console.log('[E2E Test] Step 6: Bob loads recommendations...');
      clientB.emit('recommendation:load', { roomId, query: 'Sid Sriram hit songs' });
    }
  }
});

clientA.on('recommendation:load', (recLoadData) => {
  if (currentStep === 6) {
    console.log('[E2E Test] Bob loads recs -> Alice receives recommendation:load: SUCCESS (query =', recLoadData.query, ')');
    currentStep = 7;
    
    // Step 7: Test Recommendation selected event sync
    console.log('[E2E Test] Step 7: Alice selects a recommendation...');
    clientA.emit('recommendation:selected', { roomId, videoId: 'rec-video-id', videoTitle: 'Recommended Video Title' });
  }
});

clientB.on('recommendation:selected', (recSelectData) => {
  if (currentStep === 7) {
    console.log('[E2E Test] Alice selects rec -> Bob receives recommendation:selected: SUCCESS (title =', recSelectData.videoTitle, ')');
    currentStep = 8;
    
    // Step 8: Test Activity Status update
    console.log('[E2E Test] Step 8: Bob updates activity status to "Dancing..."');
    clientB.emit('activity:update', { roomId, activity: 'Dancing...' });
  }
});

clientA.on('activity:updated', ({ socketId, activity }) => {
  if (currentStep === 8 && activity === 'Dancing...') {
    console.log('[E2E Test] Bob updates activity -> Alice receives activity:updated: SUCCESS');
    currentStep = 9;
    
    // Step 9: Test Live Reaction broadcasting
    console.log('[E2E Test] Step 9: Alice emits reaction "🎉"...');
    clientA.emit('reaction:emit', { roomId, emoji: '🎉' });
  }
});

clientB.on('reaction:emitted', ({ emoji, username: reactionUser }) => {
  if (currentStep === 9 && emoji === '🎉') {
    console.log('[E2E Test] Alice emits reaction -> Bob receives reaction:emitted: SUCCESS');
    currentStep = 10;
    
    // Step 10: Queue voting & sorting. Bob adds song-3-id to queue.
    console.log('[E2E Test] Step 10: Bob adding song-3-id to queue...');
    clientB.emit('queue:add', {
      roomId,
      videoId: 'song-3-id',
      videoTitle: 'Song Three Title',
      thumbnail: 'thumb-3',
      channel: 'Channel Three'
    });
  }
});

clientA.on('history:updated', ({ history: roomHistory }) => {
  if (currentStep === 12) {
    const histItem = roomHistory.find((h) => h.videoId === 'song-2-id');
    if (histItem) {
      console.log('[E2E Test] Video ended -> Alice receives history:updated with song-2-id: SUCCESS');
      currentStep = 13;
      
      // Step 13: Test VibeBot message
      console.log('[E2E Test] Step 13: Alice asks VibeBot to set mood to "Romantic Tamil"...');
      clientA.emit('vibebot:message', { roomId, text: 'Play romantic Tamil songs' });
    }
  }
});

clientB.on('new-message', (msg) => {
  if (currentStep === 13 && msg.username === 'VibeBot AI 🤖') {
    console.log('[E2E Test] VibeBot AI responds: SUCCESS (msg =', msg.text, ')');
    currentStep = 14;
    
    // Step 14: Bob joins VibeSpace social area
    console.log('[E2E Test] Step 14: Bob joins VibeSpace 2D proximity map...');
    clientB.emit('vibespace:join', { roomId, avatar: 'avatar-1' });
  }
});

clientA.on('vibespace:sync', ({ participants: plist }) => {
  if (currentStep === 14) {
    const bobParticipant = plist.find(p => p.username === 'Bob');
    if (bobParticipant) {
      console.log('[E2E Test] Bob joins VibeSpace -> Alice receives spaces sync list: SUCCESS');
      currentStep = 15;
      
      // Step 15: Alice walks/moves in VibeSpace
      console.log('[E2E Test] Step 15: Alice moves avatar to x=250, y=300...');
      clientA.emit('vibespace:move', { roomId, x: 250, y: 300 });
    }
  }
});

clientB.on('vibespace:updated', ({ socketId, x, y }) => {
  if (currentStep === 15 && x === 250 && y === 300) {
    console.log('[E2E Test] Alice walks -> Bob receives coordinates update: SUCCESS');
    currentStep = 16;
    
    // Step 16: Karaoke lyrics highlight sync
    console.log('[E2E Test] Step 16: Bob synchronizes karaoke lyrics line...');
    clientB.emit('karaoke:lyrics:sync', { roomId, lyricsLine: 'Unakkul Naane Urugum Iravil...', timeOffset: 12 });
  }
});

clientA.on('karaoke:lyrics:highlighted', ({ lyricsLine, timeOffset }) => {
  if (currentStep === 16 && lyricsLine.includes('Unakkul Naane')) {
    console.log('[E2E Test] Bob syncs lyrics -> Alice receives highlight notification: SUCCESS');
    console.log('[E2E Test] ALL STARTUP EXTENSION SOCKET TESTS PASSED SUCCESSFULLY!');
    clientA.disconnect();
    clientB.disconnect();
    process.exit(0);
  }
});

// Set a timeout to prevent hanging if anything fails
setTimeout(() => {
  console.error(`[E2E Test] Test timed out after 25 seconds! Failed at step ${currentStep}`);
  clientA.disconnect();
  clientB.disconnect();
  process.exit(1);
}, 25000);
