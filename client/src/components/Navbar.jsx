import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { useLocation } from 'react-router-dom';

function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const { isConnected } = useSocket();
  const location = useLocation();
  const isInRoom = location.pathname.startsWith('/room/');

  return (
    <header className="sticky top-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            {/* Logo icon */}
            <div className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-neon-purple shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text tracking-tight">
              VibeSync
            </span>
          </a>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-neon-green shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                    : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]'
                }`}
              />
              <span className="text-gray-500 dark:text-gray-400">
                {isConnected ? 'Connected' : 'Reconnecting…'}
              </span>
            </div>

            {isInRoom && (
              <div className="sm:hidden flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? 'bg-neon-green'
                      : 'bg-red-400'
                  }`}
                />
              </div>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl glass hover:bg-brand-100/50 dark:hover:bg-brand-900/30 transition-all duration-300 group"
            >
              {/* Sun icon */}
              <svg
                className={`w-5 h-5 absolute transition-all duration-500 ${
                  isDark
                    ? 'rotate-90 scale-0 opacity-0'
                    : 'rotate-0 scale-100 opacity-100'
                } text-amber-500`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>

              {/* Moon icon */}
              <svg
                className={`w-5 h-5 absolute transition-all duration-500 ${
                  isDark
                    ? 'rotate-0 scale-100 opacity-100'
                    : '-rotate-90 scale-0 opacity-0'
                } text-brand-300`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
