import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function ReactionGame({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [scores, setScores] = useState({});
  const [status, setStatus] = useState('idle'); // 'idle' | 'waiting' | 'active'
  const [winner, setWinner] = useState(null);
  const [btnText, setBtnText] = useState('Start Round');

  useEffect(() => {
    if (!socket) return;

    const handleReactionState = (state) => {
      setScores(state.scores || {});
      setStatus(state.status || 'idle');
      setWinner(state.winner || null);
    };

    const handleTrigger = () => {
      setStatus('active');
    };

    const handleRoundResult = ({ winner: roundWinner, scores: newScores }) => {
      setScores(newScores || {});
      setWinner(roundWinner);
      setStatus('idle');
      addToast({ type: 'info', message: `🎉 ${roundWinner} clicked first!` });
    };

    socket.on('reaction-state', handleReactionState);
    socket.on('reaction-trigger', handleTrigger);
    socket.on('reaction-round-result', handleRoundResult);

    socket.emit('reaction-join', { roomId });

    return () => {
      socket.off('reaction-state', handleReactionState);
      socket.off('reaction-trigger', handleTrigger);
      socket.off('reaction-round-result', handleRoundResult);
    };
  }, [socket, roomId, addToast]);

  useEffect(() => {
    if (status === 'waiting') {
      setBtnText('WAIT FOR GREEN...');
    } else if (status === 'active') {
      setBtnText('CLICK NOW!!!');
    } else {
      setBtnText(winner ? `Round Won By: ${winner}` : 'Start Next Round');
    }
  }, [status, winner]);

  const handleButtonClick = () => {
    if (!socket) return;

    if (status === 'idle') {
      // Start round
      socket.emit('reaction-start-round', { roomId });
    } else if (status === 'active') {
      // Click target
      socket.emit('reaction-click', { roomId });
    } else if (status === 'waiting') {
      // Early click penalty!
      addToast({ type: 'error', message: 'Too early! Penalty.' });
    }
  };

  const handleReset = () => {
    if (socket) {
      socket.emit('reaction-reset', { roomId });
      addToast({ type: 'info', message: 'Reaction scores reset!' });
    }
  };

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-center justify-center p-5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl max-w-4xl mx-auto w-full text-gray-900 dark:text-gray-100 animate-fade-in">
      
      {/* Game button column */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-white/5 pb-2.5 mb-5">
          <h4 className="font-extrabold text-sm flex items-center gap-1.5">⚡ Reaction Speed 🚀</h4>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-[10px] font-bold transition-colors"
          >
            Reset Scores
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={handleButtonClick}
          disabled={status === 'waiting'}
          type="button"
          className={`w-64 h-64 rounded-3xl border-4 flex flex-col items-center justify-center font-black transition-all duration-150 select-none text-center p-6 ${
            status === 'waiting'
              ? 'bg-amber-600/30 text-amber-200 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)] cursor-not-allowed scale-95'
              : status === 'active'
              ? 'bg-green-600/80 text-white border-green-400 shadow-[0_0_35px_rgba(34,197,94,0.8)] scale-105 cursor-pointer text-xl animate-pulse'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:scale-102 active:scale-98 cursor-pointer'
          }`}
        >
          <span className="text-base tracking-wider uppercase">{btnText}</span>
          {status === 'idle' && !winner && (
            <span className="text-[10px] font-bold text-gray-300 mt-2 block">Click to test speeds</span>
          )}
        </button>
      </div>

      {/* Leaderboard Column */}
      <div className="flex-1 w-full flex flex-col h-[350px] min-w-[200px] border border-white/5 bg-black/25 rounded-2xl p-4 overflow-hidden">
        <h5 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">🏆 Live Leaderboard</h5>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 text-[11px] font-mono text-gray-400">
          {sortedScores.length === 0 ? (
            <span className="italic text-gray-500">No wins yet</span>
          ) : (
            sortedScores.map(([name, val], idx) => (
              <div key={name} className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                <div className="flex gap-2">
                  <span className="text-violet-500 font-bold">#{idx + 1}</span>
                  <span className="font-semibold text-gray-300">{name}</span>
                </div>
                <span className="text-cyan-400 font-bold">{val} wins</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
