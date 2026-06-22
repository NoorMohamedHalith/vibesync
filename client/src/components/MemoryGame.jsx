import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

const EMOJIS = ['🦄', '🐱', '🦊', '🐶', '🐻', '🐼', '🦁', '🐯'];

export default function MemoryGame({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [cards, setCards] = useState([]);
  const [players, setPlayers] = useState({ p1: null, p2: null });
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [turn, setTurn] = useState('p1');
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);

  const myId = socket?.id;
  const isP1 = players.p1 === myId;
  const isP2 = players.p2 === myId;
  const myRole = isP1 ? 'p1' : isP2 ? 'p2' : null;

  useEffect(() => {
    if (!socket) return;

    const handleMemoryState = (state) => {
      setCards(state.cards || []);
      setPlayers(state.players || { p1: null, p2: null });
      setScores(state.scores || { p1: 0, p2: 0 });
      setTurn(state.turn || 'p1');
      setFlippedIndices(state.flippedIndices || []);
      setMatchedPairs(state.matchedPairs || []);
    };

    socket.on('memory-state', handleMemoryState);
    socket.emit('memory-join', { roomId });

    return () => {
      socket.off('memory-state', handleMemoryState);
    };
  }, [socket, roomId]);

  const handleJoin = (role) => {
    if (socket) {
      socket.emit('memory-join-slot', { roomId, role });
      addToast({ type: 'success', message: `Joined as Player ${role === 'p1' ? '1' : '2'}` });
    }
  };

  const handleCardClick = (idx) => {
    if (!myRole) {
      addToast({ type: 'warning', message: 'You are spectating. Join a slot to play!' });
      return;
    }

    if (turn !== myRole) {
      addToast({ type: 'warning', message: `It's not your turn!` });
      return;
    }

    if (matchedPairs.includes(cards[idx]) || flippedIndices.includes(idx)) {
      return; // Already matched or flipped
    }

    if (flippedIndices.length >= 2) return; // Wait for flip back

    const nextFlipped = [...flippedIndices, idx];
    setFlippedIndices(nextFlipped);

    // Sync intermediate flip state
    if (socket) {
      socket.emit('memory-update-state', {
        roomId,
        gameState: { flippedIndices: nextFlipped }
      });
    }

    if (nextFlipped.length === 2) {
      // Check match after short delay
      setTimeout(() => {
        const [idx1, idx2] = nextFlipped;
        const card1 = cards[idx1];
        const card2 = cards[idx2];

        let nextScores = { ...scores };
        let nextMatched = [...matchedPairs];
        let nextTurn = turn;

        if (card1 === card2) {
          // Match! Keep card open, increase score, same player turn
          nextMatched.push(card1);
          nextScores[myRole] += 1;
          addToast({ type: 'success', message: `Matched ${card1}! You get another turn.` });
        } else {
          // No match, switch turn
          nextTurn = turn === 'p1' ? 'p2' : 'p1';
        }

        if (socket) {
          socket.emit('memory-update-state', {
            roomId,
            gameState: {
              flippedIndices: [],
              matchedPairs: nextMatched,
              scores: nextScores,
              turn: nextTurn
            }
          });
        }
      }, 1000);
    }
  };

  const handleReset = () => {
    if (!socket) return;
    
    // Create new pairs and shuffle
    const paired = [...EMOJIS, ...EMOJIS];
    for (let i = paired.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [paired[i], paired[j]] = [paired[j], paired[i]];
    }

    socket.emit('memory-reset', { roomId, cards: paired });
    addToast({ type: 'info', message: 'Memory game has been reset!' });
  };

  const getStatusText = () => {
    if (!players.p1 || !players.p2) return 'Waiting for players to join...';
    
    // Game over check
    if (matchedPairs.length === EMOJIS.length) {
      if (scores.p1 === scores.p2) return "It's a tie game! 🤝";
      const winner = scores.p1 > scores.p2 ? 'Player 1' : 'Player 2';
      return `${winner} wins the game! 🎉`;
    }

    const isMyTurn = turn === myRole;
    if (isMyTurn) return 'Your turn! Select a card.';
    return `Waiting for Player ${turn === 'p1' ? '1' : '2'}...`;
  };

  return (
    <div className="flex flex-col items-center p-5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl max-w-sm mx-auto w-full text-gray-900 dark:text-gray-100 animate-fade-in">
      <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-2.5 mb-3.5">
        <h4 className="font-extrabold text-sm flex items-center gap-1.5">🧠 Memory Pairs 🃏</h4>
        <button
          onClick={handleReset}
          className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-[10px] font-bold transition-colors"
        >
          Reset Grid
        </button>
      </div>

      {/* Slots */}
      <div className="grid grid-cols-2 gap-3 w-full mb-4">
        <div className="flex flex-col items-center p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-center">
          <span className="text-[10px] uppercase font-bold text-violet-500">Player 1 (P1)</span>
          {players.p1 ? (
            <span className="text-xs font-bold text-gray-300">Score: {scores.p1}</span>
          ) : (
            <button
              onClick={() => handleJoin('p1')}
              className="mt-1 px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold transition-all"
            >
              Join Slot
            </button>
          )}
        </div>

        <div className="flex flex-col items-center p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
          <span className="text-[10px] uppercase font-bold text-cyan-500">Player 2 (P2)</span>
          {players.p2 ? (
            <span className="text-xs font-bold text-gray-300">Score: {scores.p2}</span>
          ) : (
            <button
              onClick={() => handleJoin('p2')}
              className="mt-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold transition-all"
            >
              Join Slot
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-500">
        {getStatusText()}
      </div>

      {/* Memory Board Grid */}
      <div className="grid grid-cols-4 gap-2.5 w-64 h-64 sm:w-72 sm:h-72">
        {cards.map((emoji, idx) => {
          const isFlipped = flippedIndices.includes(idx) || matchedPairs.includes(emoji);
          return (
            <button
              key={idx}
              onClick={() => handleCardClick(idx)}
              type="button"
              disabled={cards.length === 0}
              className={`rounded-xl border transition-all duration-300 flex items-center justify-center text-2xl font-bold select-none ${
                isFlipped
                  ? 'bg-violet-500/20 border-violet-500/40 text-white rotate-y-180 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                  : 'bg-gray-800 dark:bg-black/40 border-white/5 hover:border-violet-500/35 hover:scale-105 active:scale-95 text-transparent cursor-pointer'
              }`}
            >
              {isFlipped ? emoji : '❓'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
