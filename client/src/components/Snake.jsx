import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function Snake({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const canvasRef = useRef(null);

  // Local game states
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState({});

  // Refs for loop
  const snakeRef = useRef([{ x: 10, y: 10 }]);
  const directionRef = useRef({ x: 1, y: 0 });
  const foodRef = useRef({ x: 5, y: 5 });
  const gameIntervalRef = useRef(null);

  const GRID_SIZE = 20;

  // Fetch leaderboard on mount
  useEffect(() => {
    if (!socket) return;

    const handleLeaderboard = ({ game, leaderboard: lMap }) => {
      if (game === 'snake') {
        setLeaderboard(lMap || {});
      }
    };

    socket.on('game-leaderboard-updated', handleLeaderboard);
    socket.emit('game-get-leaderboard', { roomId, game: 'snake' });

    return () => {
      socket.off('game-leaderboard-updated', handleLeaderboard);
    };
  }, [socket, roomId]);

  const generateFood = () => {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    foodRef.current = { x, y };
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / GRID_SIZE;

    // Clear board with neon grid lines
    ctx.fillStyle = '#0f172a'; // slate 900
    ctx.fillRect(0, 0, width, height);

    // Draw food (neon magenta circle)
    ctx.fillStyle = '#f43f5e'; // rose-500
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#f43f5e';
    ctx.beginPath();
    const fx = foodRef.current.x * cellSize + cellSize / 2;
    const fy = foodRef.current.y * cellSize + cellSize / 2;
    ctx.arc(fx, fy, cellSize / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();

    // Draw snake (neon violet)
    ctx.fillStyle = '#8b5cf6'; // violet-500
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#8b5cf6';
    snakeRef.current.forEach((segment, idx) => {
      // Head is a different color
      if (idx === 0) {
        ctx.fillStyle = '#a78bfa'; // violet-400
      } else {
        ctx.fillStyle = '#8b5cf6';
      }
      ctx.fillRect(
        segment.x * cellSize + 1,
        segment.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    });

    // Reset shadow
    ctx.shadowBlur = 0;
  };

  const gameStep = () => {
    const snake = [...snakeRef.current];
    const head = {
      x: snake[0].x + directionRef.current.x,
      y: snake[0].y + directionRef.current.y
    };

    // Collision checks (boundaries)
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      handleGameOver();
      return;
    }

    // Collision checks (self)
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      handleGameOver();
      return;
    }

    // Move head
    snake.unshift(head);

    // Food check
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      // Eaten! Grow and spawn food
      setScore((s) => {
        const nextScore = s + 10;
        if (socket) {
          socket.emit('game-score-update', { roomId, game: 'snake', score: nextScore });
        }
        return nextScore;
      });
      generateFood();
    } else {
      // Pop tail
      snake.pop();
    }

    snakeRef.current = snake;
    drawGame();
  };

  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    directionRef.current = { x: 1, y: 0 };
    generateFood();

    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    gameIntervalRef.current = setInterval(gameStep, 130);
  };

  const handleGameOver = () => {
    setIsPlaying(false);
    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
    }
    setHighScore((h) => Math.max(h, score));
    addToast({ type: 'error', message: `Game Over! Final Score: ${score}` });
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPlaying) return;

      const dir = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dir.y !== 1) directionRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dir.y !== -1) directionRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dir.x !== 1) directionRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dir.x !== -1) directionRef.current = { x: 1, y: 0 };
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Initial draw
  useEffect(() => {
    drawGame();
  }, []);

  // Sort leaderboard items
  const sortedLeaders = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-center justify-center p-5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl max-w-4xl mx-auto w-full text-gray-900 dark:text-gray-100">
      
      {/* Game view */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-2.5 mb-3.5">
          <h4 className="font-extrabold text-sm flex items-center gap-2">🐍 Neon Snake 🍎</h4>
          <span className="text-xs text-violet-400 font-bold">Best: {highScore}</span>
        </div>

        {/* Board Canvas */}
        <div className="relative border-4 border-violet-500/30 rounded-2xl overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            width={360}
            height={360}
            className="w-80 h-80 sm:w-90 sm:h-90 block bg-[#0f172a]"
          />

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <span className="text-sm text-gray-400 mb-2">Controls: Arrow keys / WASD</span>
              <button
                onClick={startGame}
                type="button"
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:scale-105 active:scale-95 text-sm"
              >
                Start Score Attack
              </button>
            </div>
          )}
        </div>

        {/* Live score */}
        <div className="mt-3 text-sm font-bold text-gray-400">
          Score: <span className="text-violet-400 text-base">{score}</span>
        </div>
      </div>

      {/* Leaderboard Column */}
      <div className="flex-1 w-full flex flex-col h-[350px] min-w-[200px] border border-white/5 bg-black/25 rounded-2xl p-4 overflow-hidden">
        <h5 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">🏆 Live Leaderboard</h5>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 text-[11px] font-mono text-gray-400">
          {sortedLeaders.length === 0 ? (
            <span className="italic text-gray-500">No scores recorded yet</span>
          ) : (
            sortedLeaders.map(([name, val], idx) => (
              <div key={name} className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                <div className="flex gap-2">
                  <span className="text-violet-500 font-bold">#{idx + 1}</span>
                  <span className="font-semibold text-gray-300">{name}</span>
                </div>
                <span className="text-cyan-400 font-bold">{val} pts</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
