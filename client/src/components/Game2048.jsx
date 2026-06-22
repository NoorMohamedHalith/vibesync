import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function Game2048({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [board, setBoard] = useState(Array(16).fill(null));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch leaderboard
  useEffect(() => {
    if (!socket) return;

    const handleLeaderboard = ({ game, leaderboard: lMap }) => {
      if (game === '2048') {
        setLeaderboard(lMap || {});
      }
    };

    socket.on('game-leaderboard-updated', handleLeaderboard);
    socket.emit('game-get-leaderboard', { roomId, game: '2048' });

    return () => {
      socket.off('game-leaderboard-updated', handleLeaderboard);
    };
  }, [socket, roomId]);

  // Game Logic
  const getEmptyCells = (grid) => {
    const indices = [];
    grid.forEach((val, idx) => {
      if (val === null) indices.push(idx);
    });
    return indices;
  };

  const addRandomTile = useCallback((grid) => {
    const empties = getEmptyCells(grid);
    if (empties.length === 0) return grid;
    const randomIdx = empties[Math.floor(Math.random() * empties.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    grid[randomIdx] = val;
    return [...grid];
  }, []);

  const initGame = () => {
    let newBoard = Array(16).fill(null);
    newBoard = addRandomTile(newBoard);
    newBoard = addRandomTile(newBoard);
    setBoard(newBoard);
    setScore(0);
    setIsPlaying(true);
  };

  // Move operations
  const rotateLeft = (grid) => {
    const next = Array(16).fill(null);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        next[r * 4 + c] = grid[c * 4 + (3 - r)];
      }
    }
    return next;
  };

  const slideRowLeft = (row) => {
    const filtered = row.filter((v) => v !== null);
    const result = [];
    let scoreAdded = 0;
    
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i] === filtered[i + 1]) {
        const mergedVal = filtered[i] * 2;
        result.push(mergedVal);
        scoreAdded += mergedVal;
        i++; // skip next
      } else {
        result.push(filtered[i]);
      }
    }

    while (result.length < 4) {
      result.push(null);
    }

    return { row: result, score: scoreAdded };
  };

  const slideLeft = (grid) => {
    const next = [];
    let scoreAdded = 0;
    for (let r = 0; r < 4; r++) {
      const row = grid.slice(r * 4, r * 4 + 4);
      const res = slideRowLeft(row);
      next.push(...res.row);
      scoreAdded += res.score;
    }
    return { grid: next, score: scoreAdded };
  };

  const move = useCallback((direction) => {
    let nextBoard = [...board];
    let scoreGained = 0;

    // Rotate board to align move direction as left
    // Up: rotate left 3 times
    // Right: rotate left 2 times
    // Down: rotate left 1 time
    let rotations = 0;
    if (direction === 'up') rotations = 3;
    else if (direction === 'right') rotations = 2;
    else if (direction === 'down') rotations = 1;

    for (let i = 0; i < rotations; i++) {
      nextBoard = rotateLeft(nextBoard);
    }

    const slideRes = slideLeft(nextBoard);
    nextBoard = slideRes.grid;
    scoreGained = slideRes.score;

    // Rotate back
    const undoRotations = (4 - rotations) % 4;
    for (let i = 0; i < undoRotations; i++) {
      nextBoard = rotateLeft(nextBoard);
    }

    // Check if board changed
    const boardChanged = JSON.stringify(nextBoard) !== JSON.stringify(board);
    
    if (boardChanged) {
      nextBoard = addRandomTile(nextBoard);
      setBoard(nextBoard);
      
      const newScore = score + scoreGained;
      setScore(newScore);

      if (socket && scoreGained > 0) {
        socket.emit('game-score-update', { roomId, game: '2048', score: newScore });
      }

      // Check game over
      if (checkGameOver(nextBoard)) {
        setIsPlaying(false);
        setHighScore((h) => Math.max(h, newScore));
        addToast({ type: 'error', message: `Game Over! Score: ${newScore}` });
      }
    }
  }, [board, score, socket, roomId, addToast, addRandomTile]);

  const checkGameOver = (grid) => {
    if (grid.includes(null)) return false;

    // Check adjacent matches
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = grid[r * 4 + c];
        if (c < 3 && grid[r * 4 + (c + 1)] === val) return false; // horizontal match
        if (r < 3 && grid[(r + 1) * 4 + c] === val) return false; // vertical match
      }
    }

    return true;
  };

  // Keyboard binding
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPlaying) return;

      if (e.key === 'ArrowLeft' || e.key === 'a') move('left');
      else if (e.key === 'ArrowRight' || e.key === 'd') move('right');
      else if (e.key === 'ArrowUp' || e.key === 'w') move('up');
      else if (e.key === 'ArrowDown' || e.key === 's') move('down');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, move]);

  // Sort leaderboard items
  const sortedLeaders = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);

  // Styles for tiles based on value
  const tileColors = {
    2: 'bg-gray-700/60 text-white border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]',
    4: 'bg-violet-600/30 text-violet-200 border-violet-500/20 shadow-[0_0_10px_rgba(139,92,246,0.1)]',
    8: 'bg-violet-600/60 text-violet-100 border-violet-500/35 shadow-[0_0_12px_rgba(139,92,246,0.25)]',
    16: 'bg-indigo-600/60 text-indigo-100 border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.25)]',
    32: 'bg-cyan-600/50 text-cyan-100 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
    64: 'bg-cyan-600/80 text-cyan-50 border-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.4)]',
    128: 'bg-amber-600/40 text-amber-200 border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    256: 'bg-amber-600/60 text-amber-100 border-amber-500/35 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    512: 'bg-rose-600/50 text-rose-100 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
    1024: 'bg-rose-600/80 text-rose-50 border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.5)]',
    2048: 'bg-red-500 text-white border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.7)] animate-pulse',
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-center justify-center p-5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl max-w-4xl mx-auto w-full text-gray-900 dark:text-gray-100">
      
      {/* Game board column */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-2.5 mb-3.5">
          <h4 className="font-extrabold text-sm flex items-center gap-2">🔢 Neon 2048 💥</h4>
          <span className="text-xs text-violet-400 font-bold">Best: {highScore}</span>
        </div>

        {/* 2048 Grid Board */}
        <div className="relative p-2.5 bg-gray-900/60 border border-white/5 rounded-2xl shadow-2xl">
          <div className="grid grid-cols-4 gap-2.5 w-64 h-64 sm:w-72 sm:h-72">
            {board.map((cell, idx) => {
              const styleClass = tileColors[cell] || 'bg-black/25 text-transparent border-transparent';
              return (
                <div
                  key={idx}
                  className={`rounded-xl border flex items-center justify-center font-black transition-all duration-150 select-none text-base sm:text-lg ${styleClass}`}
                >
                  {cell}
                </div>
              );
            })}
          </div>

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 rounded-2xl">
              <span className="text-xs text-gray-400 mb-2">Controls: Arrow keys / WASD</span>
              <button
                onClick={initGame}
                type="button"
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:scale-105 active:scale-95 text-xs"
              >
                Play 2048 Attack
              </button>
            </div>
          )}
        </div>

        {/* Score indicator */}
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
