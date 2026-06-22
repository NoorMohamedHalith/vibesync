import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import TicTacToe from './TicTacToe';
import RockPaperScissors from './RockPaperScissors';
import Chess from './Chess';
import Snake from './Snake';
import Game2048 from './Game2048';
import MemoryGame from './MemoryGame';
import ReactionGame from './ReactionGame';
import MiniGolf from './MiniGolf';

export default function GameManager({ roomId }) {
  const { socket } = useSocket();
  const [activeGame, setActiveGame] = useState(null); // null | 'ttt' | 'rps' | 'chess' | 'snake' | '2048' | 'memory' | 'reaction' | 'golf'

  useEffect(() => {
    if (!socket) return;

    const handleGameSelect = ({ game }) => {
      setActiveGame(game);
    };

    socket.on('game-selected', handleGameSelect);
    socket.emit('game-get-selected', { roomId });

    return () => {
      socket.off('game-selected', handleGameSelect);
    };
  }, [socket, roomId]);

  const selectGame = (game) => {
    if (socket) {
      socket.emit('game-select', { roomId, game });
    }
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-white/50 dark:bg-black/10 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/5 w-full h-full min-h-[480px]">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          🎮 Multiplayer Arcade
        </h3>
        
        {activeGame && (
          <button
            onClick={() => selectGame(null)}
            className="text-xs font-bold text-red-500 hover:text-red-600 hover:underline"
          >
            ← Leave Game
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center overflow-hidden">
        {activeGame === null ? (
          /* Selection Hub */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl overflow-y-auto max-h-[380px] p-2 scrollbar-thin">
            {/* Tic Tac Toe */}
            <button
              onClick={() => selectGame('ttt')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-violet-500/5 dark:hover:bg-violet-500/10 border border-gray-200 dark:border-white/10 hover:border-violet-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                ❌
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Tic Tac Toe</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Connect three marks in a row.
              </p>
            </button>

            {/* Rock Paper Scissors */}
            <button
              onClick={() => selectGame('rps')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-cyan-500/5 dark:hover:bg-cyan-500/10 border border-gray-200 dark:border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                ✊
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Rock Paper Scissors</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Play the classic hand showdown.
              </p>
            </button>

            {/* Chess */}
            <button
              onClick={() => selectGame('chess')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-violet-500/5 dark:hover:bg-violet-500/10 border border-gray-200 dark:border-white/10 hover:border-violet-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                ♔
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Chess</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Classic multiplayer chess match.
              </p>
            </button>

            {/* Snake */}
            <button
              onClick={() => selectGame('snake')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                🐍
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Snake</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Score attack multiplayer challenge.
              </p>
            </button>

            {/* 2048 */}
            <button
              onClick={() => selectGame('2048')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-amber-500/5 dark:hover:bg-amber-500/10 border border-gray-200 dark:border-white/10 hover:border-amber-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                🔢
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">2048</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Merge grid tiles to score points.
              </p>
            </button>

            {/* Memory Game */}
            <button
              onClick={() => selectGame('memory')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-pink-500/5 dark:hover:bg-pink-500/10 border border-gray-200 dark:border-white/10 hover:border-pink-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                🃏
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Memory Game</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Match pairs of hidden emoji cards.
              </p>
            </button>

            {/* Reaction Speed */}
            <button
              onClick={() => selectGame('reaction')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-red-500/5 dark:hover:bg-red-500/10 border border-gray-200 dark:border-white/10 hover:border-red-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                ⚡
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Reaction Speed</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Click the button when it turns green.
              </p>
            </button>

            {/* Mini Golf */}
            <button
              onClick={() => selectGame('golf')}
              className="flex flex-col items-center p-4 bg-white dark:bg-white/[0.03] hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white text-2xl shadow-glow-sm group-hover:scale-105 transition-transform mb-3">
                ⛳
              </div>
              <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">Mini Golf</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal">
                Lowest strokes score attack golf.
              </p>
            </button>
          </div>
        ) : activeGame === 'ttt' ? (
          <TicTacToe roomId={roomId} />
        ) : activeGame === 'rps' ? (
          <RockPaperScissors roomId={roomId} />
        ) : activeGame === 'chess' ? (
          <Chess roomId={roomId} />
        ) : activeGame === 'snake' ? (
          <Snake roomId={roomId} />
        ) : activeGame === '2048' ? (
          <Game2048 roomId={roomId} />
        ) : activeGame === 'memory' ? (
          <MemoryGame roomId={roomId} />
        ) : activeGame === 'reaction' ? (
          <ReactionGame roomId={roomId} />
        ) : activeGame === 'golf' ? (
          <MiniGolf roomId={roomId} />
        ) : null}
      </div>
    </div>
  );
}
