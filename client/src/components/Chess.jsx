import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

// Starting board representation
const INITIAL_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

const PIECE_SYMBOLS = {
  'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟', // Black
  'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'  // White
};

export default function Chess({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [board, setBoard] = useState(INITIAL_BOARD);
  const [players, setPlayers] = useState({ white: null, black: null });
  const [turn, setTurn] = useState('white');
  const [selectedCell, setSelectedCell] = useState(null); // { row, col }
  const [history, setHistory] = useState([]);

  const myId = socket?.id;

  useEffect(() => {
    if (!socket) return;

    const handleChessState = (state) => {
      if (state.board) {
        setBoard(state.board);
      } else {
        setBoard(INITIAL_BOARD);
      }
      setPlayers(state.players || { white: null, black: null });
      setTurn(state.turn || 'white');
      setHistory(state.history || []);
    };

    socket.on('chess-state', handleChessState);
    socket.emit('chess-join', { roomId });

    return () => {
      socket.off('chess-state', handleChessState);
    };
  }, [socket, roomId]);

  const handleJoin = (role) => {
    if (socket) {
      socket.emit('chess-join-slot', { roomId, role });
      addToast({ type: 'success', message: `Joined as ${role === 'white' ? 'White' : 'Black'}` });
    }
  };

  const handleCellClick = (row, col) => {
    const isWhitePlayer = players.white === myId;
    const isBlackPlayer = players.black === myId;
    const myRole = isWhitePlayer ? 'white' : isBlackPlayer ? 'black' : null;

    if (!myRole) {
      addToast({ type: 'warning', message: 'You are spectating. Join a slot to play!' });
      return;
    }

    if (turn !== myRole) {
      addToast({ type: 'warning', message: `It is not your turn! Waiting for ${turn}.` });
      return;
    }

    const piece = board[row][col];

    if (selectedCell) {
      // Trying to move selected piece
      const { row: sRow, col: sCol } = selectedCell;
      if (sRow === row && sCol === col) {
        setSelectedCell(null); // Deselect
        return;
      }

      // Check basic move validity: cannot capture own piece
      const activePiece = board[sRow][sCol];
      const targetPiece = board[row][col];
      
      const isActiveWhite = activePiece === activePiece.toUpperCase();
      const isTargetWhite = targetPiece && targetPiece === targetPiece.toUpperCase();

      if (targetPiece && isActiveWhite === isTargetWhite) {
        // Can't capture own piece - switch selection instead
        setSelectedCell({ row, col });
        return;
      }

      // Execute move
      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = activePiece;
      newBoard[sRow][sCol] = null;

      const moveNotation = `${activePiece} at (${sRow},${sCol}) to (${row},${col})`;
      const newHistory = [...history, moveNotation];
      const nextTurn = turn === 'white' ? 'black' : 'white';

      setSelectedCell(null);

      if (socket) {
        socket.emit('chess-move', {
          roomId,
          moveState: {
            board: newBoard,
            turn: nextTurn,
            history: newHistory
          }
        });
      }
    } else {
      // Select piece
      if (!piece) return;

      const isPieceWhite = piece === piece.toUpperCase();
      if ((myRole === 'white' && !isPieceWhite) || (myRole === 'black' && isPieceWhite)) {
        addToast({ type: 'warning', message: 'You can only move your own pieces!' });
        return;
      }

      setSelectedCell({ row, col });
    }
  };

  const handleReset = () => {
    if (socket) {
      socket.emit('chess-reset', { roomId });
      addToast({ type: 'info', message: 'Chess game reset!' });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-center justify-center p-5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl max-w-4xl mx-auto w-full text-gray-900 dark:text-gray-100">
      
      {/* Board Column */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-2.5 mb-3.5">
          <h4 className="font-extrabold text-sm flex items-center gap-2">♔ Realtime Chess ♚</h4>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-[10px] font-bold transition-colors"
          >
            Reset Game
          </button>
        </div>

        {/* Board Slots */}
        <div className="grid grid-cols-2 gap-3 w-full mb-4">
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/10 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400">White Player</span>
            {players.white ? (
              <span className="text-xs font-bold text-violet-400">Active</span>
            ) : (
              <button
                onClick={() => handleJoin('white')}
                className="mt-1 px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold transition-all"
              >
                Join White
              </button>
            )}
          </div>

          <div className="flex flex-col items-center p-2 rounded-xl bg-white/10 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400">Black Player</span>
            {players.black ? (
              <span className="text-xs font-bold text-cyan-400">Active</span>
            ) : (
              <button
                onClick={() => handleJoin('black')}
                className="mt-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold transition-all"
              >
                Join Black
              </button>
            )}
          </div>
        </div>

        {/* Turn indicator */}
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-500">
          Turn: <span className="text-white bg-violet-500/25 px-2 py-0.5 rounded-md border border-violet-500/20">{turn}</span>
        </div>

        {/* Board Grid */}
        <div className="grid grid-cols-8 gap-0 border-4 border-gray-800 dark:border-black rounded-lg overflow-hidden shadow-2xl">
          {board.map((rowArr, rowIndex) =>
            rowArr.map((cell, colIndex) => {
              const isDarkSquare = (rowIndex + colIndex) % 2 === 1;
              const isSelected = selectedCell && selectedCell.row === rowIndex && selectedCell.col === colIndex;
              const pieceSymbol = PIECE_SYMBOLS[cell] || '';

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  type="button"
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-2xl font-semibold select-none transition-all ${
                    isDarkSquare ? 'bg-amber-800/60 dark:bg-[#769656]' : 'bg-orange-100/80 dark:bg-[#eeeed2]'
                  } ${isSelected ? 'ring-4 ring-yellow-400 ring-inset scale-105 z-10' : ''}`}
                >
                  <span className={cell === cell?.toUpperCase() ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-950'}>
                    {pieceSymbol}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* History column */}
      <div className="flex-1 w-full flex flex-col h-[350px] min-w-[200px] border border-white/5 bg-black/25 rounded-2xl p-4 overflow-hidden">
        <h5 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Move History</h5>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 text-[11px] font-mono text-gray-400">
          {history.length === 0 ? (
            <span className="italic text-gray-500">No moves made yet</span>
          ) : (
            history.map((hLine, idx) => (
              <div key={idx} className="flex gap-2 py-0.5 border-b border-white/[0.02]">
                <span className="text-violet-500 font-bold">{idx + 1}.</span>
                <span>{hLine}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
