import { useEffect, useRef, useState } from 'react';

export default function VibeSpaceCanvas({ socket, roomId, username }) {
  const canvasRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const keysPressed = useRef({});
  const localPos = useRef({ x: 150, y: 150 });
  const animationFrameId = useRef(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    // Join virtual space
    socket.emit('vibespace:join', { roomId, avatar: `avatar-${Math.floor(Math.random() * 5) + 1}` });

    const handleSync = ({ participants: plist }) => {
      setParticipants(plist);
      const local = plist.find(p => p.socketId === socket.id);
      if (local) {
        localPos.current = { x: local.x, y: local.y };
      }
    };

    const handleUpdated = ({ socketId, x, y }) => {
      setParticipants((prev) =>
        prev.map(p => (p.socketId === socketId ? { ...p, x, y } : p))
      );
    };

    const handleRemoved = ({ socketId }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
    };

    socket.on('vibespace:sync', handleSync);
    socket.on('vibespace:updated', handleUpdated);
    socket.on('vibespace:removed', handleRemoved);

    // Key handlers
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop for smooth client movements
    let lastMoveEmitted = Date.now();
    const updateLoop = () => {
      let dx = 0;
      let dy = 0;
      const speed = 2.5;

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) dy = -speed;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dy = speed;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx = -speed;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx = speed;

      if (dx !== 0 || dy !== 0) {
        localPos.current.x = Math.max(10, Math.min(580, localPos.current.x + dx));
        localPos.current.y = Math.max(10, Math.min(380, localPos.current.y + dy));

        // Update local position in list for immediate render
        setParticipants((prev) =>
          prev.map(p => (p.socketId === socket.id ? { ...p, x: localPos.current.x, y: localPos.current.y } : p))
        );

        // Throttle socket emits to 20ms to avoid flooding
        const now = Date.now();
        if (now - lastMoveEmitted > 30) {
          socket.emit('vibespace:move', { roomId, x: localPos.current.x, y: localPos.current.y });
          lastMoveEmitted = now;
        }
      }

      draw();
      animationFrameId.current = requestAnimationFrame(updateLoop);
    };

    // Draw function
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Grid Background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Draw Zones (Cyberpunk styled boxes)
      // Music Corner
      ctx.fillStyle = 'rgba(139, 92, 246, 0.05)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(20, 20, 160, 100, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.font = 'bold 10px Courier New';
      ctx.fillText('🎶 Music Lounge', 30, 40);

      // Whiteboard Desk
      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.beginPath();
      ctx.roundRect(420, 20, 160, 100, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
      ctx.fillText('✏️ Sketch Board', 430, 40);

      // Private table
      ctx.fillStyle = 'rgba(244, 63, 94, 0.05)';
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.beginPath();
      ctx.arc(300, 280, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('💬 Private Bubble', 300, 285);
      ctx.textAlign = 'left';

      // 3. Proximity Connections (Voice Bubble Indicator)
      // If two players are closer than 120px, draw a neon line connecting them
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          const p1 = participants[i];
          const p2 = participants[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 120) {
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw Proximity Text in middle of line
            ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
            ctx.font = '8px Arial';
            ctx.fillText('🎙️ Connected', (p1.x + p2.x) / 2 - 25, (p1.y + p2.y) / 2 - 5);
          }
        }
      }

      // 4. Draw Avatars
      participants.forEach((p) => {
        const isLocal = p.socketId === socket.id;

        // Glow ring around local user
        if (isLocal) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = 'rgb(139, 92, 246)';
          ctx.strokeStyle = 'rgb(167, 139, 250)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow
        }

        // Base Avatar Circle
        ctx.fillStyle = isLocal ? 'rgb(139, 92, 246)' : 'rgb(99, 102, 241)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner pupil/face
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - 4, p.y - 2, 2, 0, Math.PI * 2);
        ctx.arc(p.x + 4, p.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(p.username + (isLocal ? ' (You)' : ''), p.x, p.y - 18);
        ctx.textAlign = 'left';
      });
    };

    animationFrameId.current = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      socket.emit('vibespace:leave', { roomId });
      socket.off('vibespace:sync', handleSync);
      socket.off('vibespace:updated', handleUpdated);
      socket.off('vibespace:removed', handleRemoved);
    };
  }, [socket, roomId, participants]);

  return (
    <div className="flex flex-col items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex flex-col items-center text-center">
        <h4 className="text-sm font-bold text-violet-400">VibeSpace 2D virtual social space</h4>
        <p className="text-[10px] text-gray-500 mt-0.5">Use WASD or Arrow Keys to walk around and chat in proximity</p>
      </div>

      <div className="relative border border-violet-500/30 rounded-xl overflow-hidden bg-gray-950/80 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="block max-w-full aspect-[3/2] cursor-crosshair"
        />
      </div>
    </div>
  );
}
