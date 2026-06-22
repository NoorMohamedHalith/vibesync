function ParticipantsList({ participants, isAdmin, onKick, currentUser }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Online — {participants.length}
        </span>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {participants.length === 0 && (
          <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
            No one else here yet
          </div>
        )}

        {participants.map((user, idx) => {
          const name = typeof user === 'string' ? user : user.username;
          const id = typeof user === 'string' ? user : user.id;
          const userIsAdmin = typeof user === 'object' && user.isAdmin;
          const isYou = name === currentUser;

          return (
            <div
              key={id || idx}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/40 dark:hover:bg-white/[0.04] transition-colors group animate-fade-in"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-neon-purple flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  {name.charAt(0).toUpperCase()}
                </div>
                {/* Online indicator */}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-green border-2 border-white dark:border-[#0a0118] shadow-[0_0_4px_rgba(74,222,128,0.5)]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {name}
                  </span>
                  {isYou && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-semibold leading-none">
                      You
                    </span>
                  )}
                </div>
                {userIsAdmin && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {/* Crown icon */}
                    <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.5 18.5l2-9 5 4 3-7 3 7 5-4 2 9h-20z" />
                      <rect x="2.5" y="18.5" width="19" height="2.5" rx="1" />
                    </svg>
                    <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400">
                      Admin
                    </span>
                  </div>
                )}
              </div>

              {/* Kick button (admin only, not self) */}
              {isAdmin && !isYou && (
                <button
                  onClick={() => onKick(id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
                  title={`Kick ${name}`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ParticipantsList;
