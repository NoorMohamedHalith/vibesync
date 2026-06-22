import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function MiniGolf({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const canvasRef = useRef(null);

  // States
  const [strokes, setStrokes] = useState(0);
  const [bestStrokes, setBestStrokes] = useState(null);
  const [leaderboard, setLeaderboard] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);

  // Physics states
  const ballRef = useRef({ x: 50, y: 150, vx: 0, vy: 0, r: 8 });
  const holeRef = useRef({ x: 300, y: 150, r: 12 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragCurrentRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);

  // Canvas size
  const WIDTH = 360;
  const HEIGHT = 240;

  // Obstacle (neon wall box in center)
  const obstacleRef = useRef({ x: 160, y: 60, w: 40, h: 120 });

  useEffect(() => {
    if (!socket) return;

    const handleLeaderboard = ({ game, leaderboard: lMap }) => {
      if (game === 'golf') {
        setLeaderboard(lMap || {});
      }
    };

    socket.on('game-leaderboard-updated', handleLeaderboard);
    socket.emit('game-get-leaderboard', { roomId, game: 'golf' });

    return () => {
      socket.off('game-leaderboard-updated', handleLeaderboard);
    };
  }, [socket, roomId]);

  const initGame = () => {
    ballRef.current = { x: 50, y: HEIGHT / 2, vx: 0, vy: 0, r: 7 };
    setStrokes(0);
    setIsPlaying(true);
    startLoop();
  };

  const startLoop = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    const loop = () => {
      updatePhysics();
      drawGame();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const updatePhysics = () => {
    const ball = ballRef.current;
    
    // Apply velocity
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Apply friction
    ball.vx *= 0.975;
    ball.vy *= 0.975;

    // Stop if very slow
    if (Math.abs(ball.vx) < 0.05 && Math.abs(ball.vy) < 0.05) {
      ball.vx = 0;
      ball.vy = 0;
    }

    // Boundary bounces
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx *= -0.8;
    } else if (ball.x + ball.r > WIDTH) {
      ball.x = WIDTH - ball.r;
      ball.vx *= -0.8;
    }

    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy *= -0.8;
    } else if (ball.y + ball.r > HEIGHT) {
      ball.y = HEIGHT - ball.r;
      ball.vy *= -0.8;
    }

    // Obstacle collision (AABB vs Circle)
    const obs = obstacleRef.current;
    const closestX = Math.max(obs.x, Math.min(ball.x, obs.x + obs.w));
    const closestY = Math.max(obs.y, Math.min(ball.y, obs.y + obs.h));
    const distanceX = ball.x - closestX;
    const distanceY = ball.y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

    if (distanceSquared < ball.r * ball.r) {
      // Collision detected! Reflect velocity
      const dist = Math.sqrt(distanceSquared);
      const overlap = ball.r - dist;

      // Push ball out of overlap
      if (dist > 0) {
        ball.x += (distanceX / dist) * overlap;
        ball.y += (distanceY / dist) * overlap;
      }

      // Simple reflection based on closest side
      if (closestX === obs.x || closestX === obs.x + obs.w) {
        ball.vx *= -0.8;
      }
      if (closestY === obs.y || closestY === obs.y + obs.h) {
        ball.vy *= -0.8;
      }
    }

    // Check goal hole
    const distToHole = Math.sqrt(
      Math.pow(ball.x - holeRef.current.x, 2) + Math.pow(ball.y - holeRef.current.y, 2)
    );

    if (distToHole < holeRef.current.r) {
      // Slow ball check (must not be moving too fast to go in)
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed < 3.5) {
        handleGoal();
      }
    }
  };

  const handleGoal = () => {
    setIsPlaying(false);
    stopLoop();
    setBestStrokes((b) => (b === null ? strokes : Math.min(b, strokes)));
    
    if (socket) {
      socket.emit('game-score-update', { roomId, game: 'golf', score: strokes });
    }

    addToast({ type: 'success', message: `🎉 Hole in ${strokes} strokes!` });
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Grass color dark
    ctx.fillStyle = '#065f46'; // emerald 800
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Obstacle (neon boundary)
    const obs = obstacleRef.current;
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#ef4444'; // neon red
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ef4444';
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

    // Goal hole (black with green outline)
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.beginPath();
    ctx.arc(holeRef.current.x, holeRef.current.y, holeRef.current.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Drag aiming line
    const ball = ballRef.current;
    if (isDraggingRef.current) {
      ctx.strokeStyle = '#f59e0b'; // amber-500 aiming
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      // Shoot line opposite to drag
      const dx = dragStartRef.current.x - dragCurrentRef.current.x;
      const dy = dragStartRef.current.y - dragCurrentRef.current.y;
      ctx.lineTo(ball.x + dx, ball.y + dy);
      ctx.stroke();
    }

    // Ball (white neon)
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, 2 * Math.PI);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    if (!isPlaying) return;
    const coords = getCanvasCoords(e);
    
    // Check if clicked close to ball
    const dist = Math.sqrt(Math.pow(coords.x - ballRef.current.x, 2) + Math.pow(coords.y - ballRef.current.y, 2));
    if (dist < 30 && ballRef.current.vx === 0 && ballRef.current.vy === 0) {
      isDraggingRef.current = true;
      dragStartRef.current = coords;
      dragCurrentRef.current = coords;
    }
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    dragCurrentRef.current = getCanvasCoords(e);
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Apply force (shoot) opposite of drag
    const dx = dragStartRef.current.x - dragCurrentRef.current.x;
    const dy = dragStartRef.current.y - dragCurrentRef.current.y;

    // Force scaler
    const power = 0.15;
    ballRef.current.vx = dx * power;
    ballRef.current.vy = dy * power;

    setStrokes((s) => s + 1);
  };

  // Initial draw
  useEffect(() => {
    drawGame();
    return () => stopLoop();
  }, []);

  // Sort leaderboard items (lowest strokes is first!)
  const sortedLeaders = Object.entries(leaderboard).sort((a, b) => a[1] - b[1]);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-center justify-center p-5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl max-w-4xl mx-auto w-full text-gray-900 dark:text-gray-100 animate-fade-in">
      
      {/* Game View Column */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-2.5 mb-3.5">
          <h4 className="font-extrabold text-sm flex items-center gap-2">⛳ Retro Mini Golf 🏌️</h4>
          <span className="text-xs text-violet-400 font-bold">Best: {bestStrokes === null ? '-' : `${bestStrokes} shots`}</span>
        </div>

        {/* Board Canvas */}
        <div className="relative border-4 border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className="w-80 h-56 sm:w-90 sm:h-60 block bg-[#065f46] cursor-crosshair touch-none"
          />

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <span className="text-xs text-gray-400 mb-2">Drag opposite and release to shoot.</span>
              <button
                onClick={initGame}
                type="button"
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 text-xs"
              >
                Play Mini Golf
              </button>
            </div>
          )}
        </div>

        {/* Score indicator */}
        <div className="mt-3 text-sm font-bold text-gray-400">
          Strokes: <span className="text-violet-400 text-base">{strokes}</span>
        </div>
      </div>

      {/* Leaderboard Column */}
      <div className="flex-1 w-full flex flex-col h-[350px] min-w-[200px] border border-white/5 bg-black/25 rounded-2xl p-4 overflow-hidden">
        <h5 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">🏆 Live Leaderboard</h5>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 text-[11px] font-mono text-gray-400">
          {sortedLeaders.length === 0 ? (
            <span className="italic text-gray-500">No records yet</span>
          ) : (
            sortedLeaders.map(([name, val], idx) => (
              <div key={name} className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                <div className="flex gap-2">
                  <span className="text-violet-500 font-bold">#{idx + 1}</span>
                  <span className="font-semibold text-gray-300">{name}</span>
                </div>
                <span className="text-cyan-400 font-bold">{val} strokes</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
