import { useState } from 'react';

function ShareModal({ roomId, roomName, onClose }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const roomLink = `${window.location.origin}/room/${roomId}`;

  const copyToClipboard = (text, setter) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-strong rounded-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-neon-purple flex items-center justify-center shadow-glow">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Invite Friends
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Share the room code or link to invite others to <strong className="text-gray-700 dark:text-gray-300">{roomName}</strong>
          </p>
        </div>

        {/* Room Code */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Room Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] font-mono text-2xl font-bold text-center tracking-[0.3em] text-gray-900 dark:text-white select-all">
              {roomId}
            </div>
            <button
              onClick={() => copyToClipboard(roomId, setCopiedCode)}
              className={`p-3 rounded-xl transition-all duration-300 ${
                copiedCode
                  ? 'bg-neon-green/20 text-neon-green'
                  : 'glass hover:bg-brand-100/50 dark:hover:bg-brand-900/30 text-gray-600 dark:text-gray-300'
              }`}
            >
              {copiedCode ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </div>
          {copiedCode && (
            <p className="text-xs text-neon-green mt-1 text-center animate-fade-in">Code copied!</p>
          )}
        </div>

        {/* Room Link */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Room Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-600 dark:text-gray-400 truncate select-all">
              {roomLink}
            </div>
            <button
              onClick={() => copyToClipboard(roomLink, setCopiedLink)}
              className={`p-3 rounded-xl transition-all duration-300 ${
                copiedLink
                  ? 'bg-neon-green/20 text-neon-green'
                  : 'glass hover:bg-brand-100/50 dark:hover:bg-brand-900/30 text-gray-600 dark:text-gray-300'
              }`}
            >
              {copiedLink ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </div>
          {copiedLink && (
            <p className="text-xs text-neon-green mt-1 text-center animate-fade-in">Link copied!</p>
          )}
        </div>

        {/* Decorative divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand-300/30 to-transparent" />
          <svg className="w-4 h-4 text-brand-400/50" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brand-300/30 to-transparent" />
        </div>

        {/* Quick tip */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Anyone with the code can join — share it with your crew!
        </p>
      </div>
    </div>
  );
}

export default ShareModal;
