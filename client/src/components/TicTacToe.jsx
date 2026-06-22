import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function TicTacToe({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [board, setBoard] = useState(Array(9).fill(null));
  const [players, setPlayers] = useState({ X: null, O: null }); // socketId -> username mapping
  const [turn, setTurn] = useState('X'); // X always goes first
  const [winner, setWinner] = useState(null); // 'X' | 'O' | 'draw' | null
  const [statusText, setStatusText] = useState('Waiting for players...');

  const myId = socket?.id;

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every((square) => square !== null)) {
      return 'draw';
    }
    return null;
  };

  useEffect(() => {
    if (!socket) return;

    const handleGameState = (gameState) => {
      setBoard(gameState.board);
      setPlayers(gameState.players);
      setTurn(gameState.turn);
      setWinner(gameState.winner);
    };

    const handleGameReset = () => {
      setBoard(Array(9).fill(null));
      setWinner(null);
      setTurn('X');
    };

    socket.on('ttt-state', handleGameState);
    socket.on('ttt-reset', handleGameReset);

    // Join/Request current TTT state on mount
    socket.emit('ttt-join', { roomId });

    return () => {
      socket.off('ttt-state', handleGameState);
      socket.off('ttt-reset', handleGameReset);
    };
  }, [socket, roomId]);

  // Update status message
  useEffect(() => {
    const isPlayer = players.X === myId || players.O === myId;
    const mySymbol = players.X === myId ? 'X' : players.O === myId ? 'O' : null;

    if (!players.X || !players.O) {
      setStatusText('Waiting for players to join...');
      return;
    }

    if (winner) {
      if (winner === 'draw') {
        setStatusText("It's a draw!");
      } else {
        const winnerName = winner === 'X' ? 'Player X' : 'Player O';
        setStatusText(`${winnerName} wins the game! 🎉`);
      }
      return;
    }

    if (isPlayer) {
      if (turn === mySymbol) {
        setStatusText("Your turn! Make your move.");
      } else {
        setStatusText(`Waiting for Player ${turn}...`);
      }
    } else {
      setStatusText(`Player ${turn}'s turn...`);
    }
  }, [board, players, turn, winner, myId]);

  const handleJoin = (symbol) => {
    if (socket) {
      socket.emit('ttt-join-slot', { roomId, symbol });
      addToast({ type: 'success', message: `Joined as Player ${symbol}` });
    }
  };

  const handleCellClick = (index) => {
    if (winner || board[index]) return; // Block double click / game over
    const mySymbol = players.X === myId ? 'X' : players.O === myId ? 'O' : null;
    if (!mySymbol || turn !== mySymbol) return; // Block spectators and out-of-turn moves

    if (socket) {
      socket.emit('ttt-move', { roomId, index });
    }
  };

  const handleReset = () => {
    if (socket) {
      socket.emit('ttt-reset', { roomId });
      addToast({ type: 'info', message: 'Game has been reset!' });
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl w-full max-w-sm mx-auto animate-fade-in text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-3 mb-4">
        <h4 className="font-bold text-base flex items-center gap-1.5">❌ Tic Tac Toe ⭕</h4>
        <button
          onClick={handleReset}
          className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-xs font-semibold transition-colors"
        >
          Reset Game
        </button>
      </div>

      {/* Players status */}
      <div className="grid grid-cols-2 gap-3 w-full mb-5">
        <div className="flex flex-col items-center p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <span className="text-[10px] uppercase font-semibold text-violet-500">Player X</span>
          {players.X ? (
            <span className="text-sm font-bold truncate max-w-full">Active</span>
          ) : (
            <button
              onClick={() => handleJoin('X')}
              className="mt-1 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all"
            >
              Join
            </button>
          )}
        </div>

        <div className="flex flex-col items-center p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-[10px] uppercase font-semibold text-cyan-500">Player O</span>
          {players.O ? (
            <span className="text-sm font-bold truncate max-w-full">Active</span>
          ) : (
            <button
              onClick={() => handleJoin('O')}
              className="mt-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all"
            >
              Join
            </button>
          )}
        </div>
      </div>

      {/* Game board status bar */}
      <div className="mb-5 text-sm font-bold text-center text-brand-600 dark:text-brand-400">
        {statusText}
      </div>

      {/* Board Grid */}
      <div className="grid grid-cols-3 gap-2 w-48 h-48 mb-4">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleCellClick(index)}
            disabled={!!winner || !!cell || !(players.X && players.O)}
            className="w-15 h-15 rounded-xl bg-white dark:bg-black/25 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02] flex items-center justify-center text-2xl font-black transition-all disabled:opacity-80 active:scale-95"
          >
            <span className={cell === 'X' ? 'text-violet-500' : 'text-cyan-500'}>
              {cell}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
