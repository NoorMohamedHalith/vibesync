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
    
    console.log('[E2E Test] ALL COLLABORATIVE PLAYBACK AND QUEUE SYNC TESTS PASSED!');
    clientA.disconnect();
    clientB.disconnect();
    process.exit(0);
  }
});

// Set a timeout to prevent hanging if anything fails
setTimeout(() => {
  console.error(`[E2E Test] Test timed out after 10 seconds! Failed at step ${currentStep}`);
  clientA.disconnect();
  clientB.disconnect();
  process.exit(1);
}, 10000);
