import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

console.log('[E2E Test] Starting simulated E2E test...');

const clientA = io(SERVER_URL, { forceNew: true });
const clientB = io(SERVER_URL, { forceNew: true });

let roomId = null;

// Handle socket errors
clientA.on('connect_error', (err) => {
  console.error('[E2E Test] Client A connection error:', err.message);
  process.exit(1);
});

clientB.on('connect_error', (err) => {
  console.error('[E2E Test] Client B connection error:', err.message);
  process.exit(1);
});

// Setup Client A hooks
clientA.on('connect', () => {
  console.log('[E2E Test] Client A connected to server. Socket ID:', clientA.id);
  
  // Alice creates a room
  clientA.emit('create-room', {
    roomName: 'Alice Party Room',
    username: 'Alice',
    password: null
  }, (response) => {
    console.log('[E2E Test] Client A create-room callback response:', response);
    if (!response || response.error) {
      console.error('[E2E Test] Create Room failed:', response?.error);
      process.exit(1);
    }
  });
});

clientA.on('room-created', (data) => {
  console.log('[E2E Test] Client A room-created received. Room ID:', data.roomId);
  roomId = data.roomId;
  
  // Now connect and join Client B
  console.log('[E2E Test] Bob joining room:', roomId);
  clientB.emit('join-room', {
    roomId: roomId,
    username: 'Bob',
    password: ''
  }, (response) => {
    console.log('[E2E Test] Client B join-room callback response:', response);
    if (!response || response.error) {
      console.error('[E2E Test] Join Room failed:', response?.error);
      process.exit(1);
    }
  });
});

clientB.on('room-joined', (data) => {
  console.log('[E2E Test] Client B room-joined event received. Room participants count:', data.participants?.length);
  
  // Verify Bob is in the room
  const Bob = data.participants.find(p => p.username === 'Bob');
  if (!Bob) {
    console.error('[E2E Test] Validation failed: Bob not found in participants list!');
    process.exit(1);
  }
  
  // Verify Alice is also in the room
  const Alice = data.participants.find(p => p.username === 'Alice');
  if (!Alice) {
    console.error('[E2E Test] Validation failed: Alice not found in participants list!');
    process.exit(1);
  }
  
  console.log('[E2E Test] Participants list verification: SUCCESS');
  
  // Alice sends a chat message
  console.log('[E2E Test] Alice sending chat message...');
  clientA.emit('send-message', {
    roomId: roomId,
    text: 'Hello from Alice!'
  });
});

// Watch for Bob to receive Alice's chat message
clientB.on('new-message', (message) => {
  console.log('[E2E Test] Client B received new-message:', message);
  if (message.text === 'Hello from Alice!' && message.username === 'Alice') {
    console.log('[E2E Test] Chat message verification: SUCCESS');
    
    // Test Whiteboard drawing sync
    console.log('[E2E Test] Alice drawing on whiteboard...');
    clientA.emit('whiteboard-draw', {
      roomId: roomId,
      x: 10,
      y: 20,
      color: '#ff0000',
      brushSize: 5,
      type: 'draw'
    });
  } else {
    console.warn('[E2E Test] Unexpected message received:', message);
  }
});

clientB.on('whiteboard-draw', (drawData) => {
  console.log('[E2E Test] Client B received whiteboard-draw event:', drawData);
  if (drawData.x === 10 && drawData.y === 20 && drawData.color === '#ff0000') {
    console.log('[E2E Test] Whiteboard draw sync verification: SUCCESS');
    
    // Complete test successfully!
    console.log('[E2E Test] ALL SOCKET E2E INTEGRATION TESTS PASSED!');
    clientA.disconnect();
    clientB.disconnect();
    process.exit(0);
  } else {
    console.error('[E2E Test] Validation failed: Whiteboard draw data mismatch!');
    process.exit(1);
  }
});

// Set a timeout to prevent hanging if anything fails
setTimeout(() => {
  console.error('[E2E Test] Test timed out after 10 seconds!');
  process.exit(1);
}, 10000);
