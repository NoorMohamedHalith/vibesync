import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

const MOVES = [
  { name: 'Rock', emoji: '✊' },
  { name: 'Paper', emoji: '✋' },
  { name: 'Scissors', emoji: '✌️' }
];

export default function RockPaperScissors({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [players, setPlayers] = useState({ p1: null, p2: null }); // { socketId, username }
  const [moves, setMoves] = useState({ p1: null, p2: null }); // Will store local placeholder states ('selected' or null) or actual moves after reveal
  const [winner, setWinner] = useState(null); // 'p1' | 'p2' | 'tie' | null
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [statusText, setStatusText] = useState('Waiting for players...');

  const myId = socket?.id;

  useEffect(() => {
    if (!socket) return;

    const handleGameState = (gameState) => {
      setPlayers(gameState.players);
      setMoves(gameState.moves);
      setWinner(gameState.winner);
      setScores(gameState.scores);
    };

    const handleGameReset = () => {
      setWinner(null);
      setMoves({ p1: null, p2: null });
    };

    socket.on('rps-state', handleGameState);
    socket.on('rps-reset', handleGameReset);

    // Join/Request current RPS state on mount
    socket.emit('rps-join', { roomId });

    return () => {
      socket.off('rps-state', handleGameState);
      socket.off('rps-reset', handleGameReset);
    };
  }, [socket, roomId]);

  // Update status messages based on game state
  useEffect(() => {
    const isPlayer = players.p1?.socketId === myId || players.p2?.socketId === myId;
    const myRole = players.p1?.socketId === myId ? 'p1' : players.p2?.socketId === myId ? 'p2' : null;

    if (!players.p1 || !players.p2) {
      setStatusText('Waiting for players to join...');
      return;
    }

    if (winner) {
      if (winner === 'tie') {
        setStatusText("It's a tie!");
      } else {
        const winnerName = players[winner]?.username || winner;
        setStatusText(`${winnerName} wins the round! 🎉`);
      }
      return;
    }

    // Checking if players selected their moves
    const p1Selected = !!moves.p1;
    const p2Selected = !!moves.p2;

    if (p1Selected && p2Selected) {
      setStatusText('Revealing moves...');
      return;
    }

    if (isPlayer) {
      const iSelected = myRole === 'p1' ? p1Selected : p2Selected;
      if (iSelected) {
        setStatusText('Waiting for other player...');
      } else {
        setStatusText('Select your move!');
      }
    } else {
      setStatusText('Waiting for players to choose...');
    }
  }, [players, moves, winner, myId]);

  const handleJoin = (role) => {
    if (socket) {
      socket.emit('rps-join-slot', { roomId, role });
      addToast({ type: 'success', message: `Joined as Player ${role === 'p1' ? '1' : '2'}` });
    }
  };

  const handleMoveSelect = (moveName) => {
    const isP1 = players.p1?.socketId === myId;
    const isP2 = players.p2?.socketId === myId;
    if (!isP1 && !isP2) return; // Spectators cannot play

    const myRole = isP1 ? 'p1' : 'p2';
    if (moves[myRole]) return; // Move already submitted

    if (socket) {
      socket.emit('rps-move', { roomId, move: moveName });
    }
  };

  const handleReset = () => {
    if (socket) {
      socket.emit('rps-reset', { roomId });
      addToast({ type: 'info', message: 'Round reset!' });
    }
  };

  const getRoleLabel = (role) => {
    return role === 'p1' ? 'Player 1' : 'Player 2';
  };

  const isP1 = players.p1?.socketId === myId;
  const isP2 = players.p2?.socketId === myId;
  const myRole = isP1 ? 'p1' : isP2 ? 'p2' : null;

  return (
    <div className="flex flex-col items-center p-6 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl w-full max-w-sm mx-auto animate-fade-in text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-3 mb-4">
        <h4 className="font-bold text-base flex items-center gap-1.5">✊ Rock Paper Scissors ✌️</h4>
        <button
          onClick={handleReset}
          className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-xs font-semibold transition-colors"
        >
          Reset Round
        </button>
      </div>

      {/* Players Slot setup */}
      <div className="grid grid-cols-2 gap-3 w-full mb-5 text-center">
        {['p1', 'p2'].map((role) => {
          const user = players[role];
          const hasSelected = !!moves[role];
          const revealMove = winner && moves[role];

          return (
            <div
              key={role}
              className={`flex flex-col items-center p-3 rounded-xl border ${
                role === 'p1'
                  ? 'bg-violet-500/10 border-violet-500/20'
                  : 'bg-cyan-500/10 border-cyan-500/20'
              }`}
            >
              <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {getRoleLabel(role)}
              </span>

              {user ? (
                <>
                  <span className="text-sm font-bold truncate max-w-full mb-1">{user.username}</span>
                  <span className="text-xs text-gray-400">Score: {scores[role]}</span>

                  {/* Move status overlay */}
                  <div className="mt-3 text-3xl h-10 flex items-center">
                    {revealMove ? (
                      MOVES.find((m) => m.name === moves[role])?.emoji
                    ) : hasSelected ? (
                      '✅ 📝'
                    ) : (
                      '🤔'
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => handleJoin(role)}
                  className={`mt-2 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${
                    role === 'p1' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-cyan-600 hover:bg-cyan-500'
                  }`}
                >
                  Join Slot
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Status string */}
      <div className="mb-5 text-sm font-bold text-center text-brand-600 dark:text-brand-400 min-h-6">
        {statusText}
      </div>

      {/* Controller actions */}
      {myRole && players.p1 && players.p2 && !winner && (
        <div className="flex gap-3 justify-center w-full mt-2">
          {MOVES.map((move) => (
            <button
              key={move.name}
              onClick={() => handleMoveSelect(move.name)}
              disabled={!!moves[myRole]}
              className="flex flex-col items-center p-3 rounded-2xl bg-white dark:bg-black/25 hover:bg-gray-100 dark:hover:bg-white/[0.05] border border-gray-200 dark:border-white/10 transition-all flex-1 shadow disabled:opacity-50 active:scale-95"
            >
              <span className="text-3xl mb-1">{move.emoji}</span>
              <span className="text-xs font-bold">{move.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
