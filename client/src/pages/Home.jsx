import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
        <polyline points="10 9 15 12 10 15" />
        <path d="M2 16h20" />
        <path d="M6 20h12" />
        <path d="M9 16v4" />
        <path d="M15 16v4" />
      </svg>
    ),
    title: 'Perfect Sync',
    desc: 'Frame-accurate playback synchronization across all viewers. Play, pause, and seek together in real-time.',
    color: 'from-brand-500 to-neon-purple',
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="9" y2="10" />
        <line x1="12" y1="10" x2="12" y2="10" />
        <line x1="15" y1="10" x2="15" y2="10" />
      </svg>
    ),
    title: 'Live Chat',
    desc: 'React together with live messaging and emojis. Share your thoughts instantly while watching.',
    color: 'from-neon-pink to-rose-400',
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    title: 'Easy Sharing',
    desc: 'Invite friends with a simple room code or shareable link. No sign-up required to join the party.',
    color: 'from-neon-blue to-neon-cyan',
  },
];

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, isConnected } = useSocket();
  const { addToast } = useToast();

  /* ----- form state ----- */
  const [createRoomName, setCreateRoomName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const [loading, setLoading] = useState(false);

  /* ----- hero subtitle typing ----- */
  const fullSubtitle = 'Synchronized YouTube watch parties with friends — no sign-up needed.';
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullSubtitle.length) {
        setDisplayedText(fullSubtitle.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowCursor(false), 1200);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  /* ----- handle redirect queries/state ----- */
  useEffect(() => {
    if (location.state?.joinRoomCode) {
      setJoinRoomCode(location.state.joinRoomCode);
    }
    if (location.state?.error) {
      addToast({ type: 'error', message: location.state.error });
      // clear location state so toast doesn't trigger again on component updates
      window.history.replaceState({}, document.title);
    }
  }, [location.state, addToast]);

  /* ----- socket listeners ----- */
  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (data) => {
      setLoading(false);
      if (createPassword) {
        localStorage.setItem(`vibesync-password-${data.roomId}`, createPassword);
      } else {
        localStorage.removeItem(`vibesync-password-${data.roomId}`);
      }
      navigate(`/room/${data.roomId}`, {
        state: {
          username: createUsername.trim(),
          isAdmin: true,
          roomName: data.roomName,
          isCreator: true,
          password: createPassword,
        },
      });
    };

    const handleRoomJoined = (data) => {
      setLoading(false);
      if (joinPassword) {
        localStorage.setItem(`vibesync-password-${data.roomId}`, joinPassword);
      } else {
        localStorage.removeItem(`vibesync-password-${data.roomId}`);
      }
      navigate(`/room/${data.roomId}`, {
        state: {
          username: joinUsername.trim(),
          isAdmin: false,
          roomName: data.roomName,
          isCreator: false,
          password: joinPassword,
        },
      });
    };

    const handleError = (data) => {
      setLoading(false);
      addToast({ type: 'error', message: data.error || data.message || 'Something went wrong' });
    };

    socket.on('room-created', handleRoomCreated);
    socket.on('room-joined', handleRoomJoined);
    socket.on('error-occurred', handleError);

    return () => {
      socket.off('room-created', handleRoomCreated);
      socket.off('room-joined', handleRoomJoined);
      socket.off('error-occurred', handleError);
    };
  }, [socket, navigate, createUsername, joinUsername, createPassword, joinPassword, addToast]);

  /* ----- handlers ----- */
  const createRoom = () => {
    if (!createUsername.trim()) {
      addToast({ type: 'warning', message: 'Please enter a username' });
      return;
    }
    if (!isConnected || !socket) {
      addToast({ type: 'error', message: 'Not connected to server' });
      return;
    }
    setLoading(true);
    localStorage.setItem('vibesync-username', createUsername.trim());
    socket.emit('create-room', {
      roomName: createRoomName.trim() || 'Untitled Room',
      username: createUsername.trim(),
      password: createPassword || null,
    });
  };

  const joinRoom = () => {
    if (!joinRoomCode.trim()) {
      addToast({ type: 'warning', message: 'Please enter a room code' });
      return;
    }
    if (!joinUsername.trim()) {
      addToast({ type: 'warning', message: 'Please enter a username' });
      return;
    }
    if (!isConnected || !socket) {
      addToast({ type: 'error', message: 'Not connected to server' });
      return;
    }
    setLoading(true);
    localStorage.setItem('vibesync-username', joinUsername.trim());
    socket.emit('join-room', {
      roomId: joinRoomCode.trim().toUpperCase(),
      username: joinUsername.trim(),
      password: joinPassword || null,
    });
  };

  return (
    <div className="flex flex-col items-center px-4 py-10 sm:py-16">
      {/* ===== HERO ===== */}
      <section className="max-w-3xl text-center mb-14 animate-fade-in">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-5">
          <span className="gradient-text">Watch Together,</span>
          <br />
          <span className="gradient-text-alt">Vibe Together</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto h-8">
          {displayedText}
          {showCursor && (
            <span className="inline-block w-0.5 h-5 bg-brand-500 ml-0.5 animate-pulse align-text-bottom" />
          )}
        </p>
      </section>

      {/* ===== CARDS ===== */}
      <section className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
        {/* Create Room Card */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="glass rounded-2xl p-6 sm:p-8 animate-fade-in-up flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-neon-purple flex items-center justify-center shadow-glow-sm">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Room</h2>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Room Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Movie Night 🎬"
                value={createRoomName}
                onChange={(e) => setCreateRoomName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Your Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter your name"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Password <span className="text-gray-400 dark:text-gray-600 normal-case">(optional)</span></label>
              <input
                type="password"
                className="input-field"
                placeholder="Room password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={createRoom}
            disabled={loading || !isConnected}
            className="btn-primary w-full mt-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Creating…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Create Room
              </span>
            )}
          </button>
        </form>

        {/* Join Room Card */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="glass rounded-2xl p-6 sm:p-8 animate-fade-in-up animation-delay-200 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-cyan flex items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.35)]">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Join Room</h2>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Room Code</label>
              <input
                type="text"
                className="input-field uppercase tracking-widest font-mono text-center text-lg"
                placeholder="ABCD1234"
                value={joinRoomCode}
                onChange={(e) => setJoinRoomCode(e.target.value)}
                maxLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Your Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter your name"
                value={joinUsername}
                onChange={(e) => setJoinUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Password <span className="text-gray-400 dark:text-gray-600 normal-case">(if required)</span></label>
              <input
                type="password"
                className="input-field"
                placeholder="Room password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={joinRoom}
            disabled={loading || !isConnected}
            className="btn-primary w-full mt-6 !from-neon-blue !to-cyan-500 hover:!from-cyan-400 hover:!to-neon-blue shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Joining…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                Join Room
              </span>
            )}
          </button>
        </form>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="w-full max-w-4xl mb-16">
        <h3 className="text-center text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-8">Why VibeSync?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`glass rounded-2xl p-6 text-center animate-fade-in-up group hover:scale-[1.03] transition-transform duration-300 ${
                i === 1 ? 'animation-delay-200' : i === 2 ? 'animation-delay-400' : ''
              }`}
            >
              <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300`}>
                {f.icon}
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-2">{f.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="text-center text-xs text-gray-400 dark:text-gray-500 pb-8 mt-12">
        <p className="font-semibold text-gray-500 dark:text-gray-400">
          Built with <span className="text-red-500 animate-pulse">❤️</span> by{' '}
          <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold tracking-wide drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
            Noor Mohamed Halith
          </span>
        </p>
        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-600">VibeSync &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default Home;
