import { useState, useEffect, useRef } from 'react';
import VibeSpaceCanvas from './VibeSpaceCanvas';
import MiniGamesPack from './MiniGamesPack';

export default function SocialSuiteDashboard({ socket, roomId, username, onClose }) {
  const [activeTab, setActiveTab] = useState('vibebot'); // 'vibebot' | 'vibespace' | 'games' | 'friends' | 'rooms' | 'karaoke' | 'memories' | 'analytics' | 'options'
  
  // 1. VibeBot States
  const [botChat, setBotChat] = useState([
    { sender: 'bot', text: 'Hello! I am VibeBot, your AI Assistant. Tell me what vibe you want, like "Play romantic Tamil songs" or click one of the mood pills below!' }
  ]);
  const [botInput, setBotInput] = useState('');
  
  // 2. Friends & Profile States
  const [profile, setProfile] = useState({
    avatar: '', bio: '', badges: [], favoriteSongs: [], favoriteArtists: [], streaks: 3, timeline: []
  });
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [friendFeedback, setFriendFeedback] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');

  // 3. Discover Rooms States
  const [publicRooms, setPublicRooms] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');

  // 4. Karaoke & Spotify States
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [karaokeLyric, setKaraokeLyric] = useState('Welcome to Karaoke Mode!');
  const [duetActive, setDuetActive] = useState(false);
  const [duetPartner, setDuetPartner] = useState('');

  // 5. Memories States
  const [memories, setMemories] = useState([]);
  
  // 6. Theme and Translation States
  const [selectedTheme, setSelectedTheme] = useState('Cyberpunk');
  const [translationActive, setTranslationActive] = useState(false);

  // Auto-scroll chat
  const chatEndRef = useRef(null);

  // Sync profile details and friends
  useEffect(() => {
    if (!socket) return;

    socket.emit('profile:get', { targetUsername: username });
    socket.emit('friends:list');
    socket.emit('rooms:public');

    const handleProfile = ({ profile: prof }) => {
      setProfile(prof);
      setNewBio(prof.bio);
    };

    const handleFriends = ({ friends, pending }) => {
      setFriendsList(friends || []);
      setPendingRequests(pending || []);
    };

    const handlePublicRooms = ({ rooms }) => {
      setPublicRooms(rooms || []);
    };

    const handleNotification = (notif) => {
      alert(`[Invite Received] ${notif.message}`);
    };

    const handleNewMessage = (msg) => {
      if (msg.username.includes('VibeBot')) {
        setBotChat(prev => [...prev, { sender: 'bot', text: msg.text }]);
      }
    };

    socket.on('profile:details', handleProfile);
    socket.on('friends:list_updated', handleFriends);
    socket.on('rooms:public_list', handlePublicRooms);
    socket.on('notification:new', handleNotification);
    socket.on('new-message', handleNewMessage);

    return () => {
      socket.off('profile:details', handleProfile);
      socket.off('friends:list_updated', handleFriends);
      socket.off('rooms:public_list', handlePublicRooms);
      socket.off('notification:new', handleNotification);
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, username]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [botChat]);

  // VibeBot message send
  const sendBotMsg = (e) => {
    if (e) e.preventDefault();
    if (!botInput.trim() || !socket) return;

    setBotChat(prev => [...prev, { sender: 'user', text: botInput.trim() }]);
    socket.emit('vibebot:message', { roomId, text: botInput.trim() });
    setBotInput('');
  };

  const selectMoodPill = (mood) => {
    setBotChat(prev => [...prev, { sender: 'user', text: `Mood: ${mood}` }]);
    socket.emit('vibebot:message', { roomId, text: `Play ${mood} songs` });
  };

  // Add friend submit
  const sendFriendRequest = (e) => {
    e.preventDefault();
    if (!newFriendInput.trim() || !socket) return;
    socket.emit('friends:request', { targetUsername: newFriendInput.trim() });
    setFriendFeedback(`Sent friend request to ${newFriendInput}`);
    setNewFriendInput('');
    setTimeout(() => setFriendFeedback(''), 3000);
  };

  const respondFriendRequest = (fromUser, accept) => {
    if (!socket) return;
    socket.emit('friends:respond', { targetUsername: fromUser, accept });
  };

  const handleUpdateBio = () => {
    if (!socket) return;
    socket.emit('profile:update', { bio: newBio });
    setIsEditingBio(false);
  };

  // Make Room Public
  const makeRoomPublic = () => {
    if (!socket || !roomId) return;
    socket.emit('rooms:register_public', { roomId, roomName: `${username}'s Watch Party`, category: 'Party' });
    alert('Room registered publicly! Other users can now see and join it.');
  };

  // Simulated Spotify connection
  const connectSpotify = () => {
    setSpotifyConnected(true);
    alert('Logged into Spotify! Synced your favorite playlists.');
  };

  // Synced Lyrics Simulation
  useEffect(() => {
    if (activeTab !== 'karaoke') return;
    const lyricsList = [
      'Welcome to Karaoke Sync!',
      'Unakkul Naane Urugum Iravil... 🎵',
      'Thinking out loud under the stars... ✨',
      'Des-pa-cito! This is how we do it down in Puerto Rico... 🕺'
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % lyricsList.length;
      setKaraokeLyric(lyricsList[idx]);
      if (socket) {
        socket.emit('karaoke:lyrics:sync', { roomId, lyricsLine: lyricsList[idx], timeOffset: idx * 5 });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, socket, roomId]);

  // Capture Polaroid Snapshot
  const captureSnap = () => {
    const snap = {
      id: Date.now(),
      title: `Moment in room ${roomId}`,
      timestamp: new Date().toLocaleTimeString(),
      image: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80`
    };
    setMemories(prev => [snap, ...prev]);
    alert('Polaroid memory captured successfully!');
  };

  // Change Theme Action
  const selectTheme = (themeName) => {
    setSelectedTheme(themeName);
    const body = document.body;
    body.className = ''; // Reset
    if (themeName === 'AMOLED') body.classList.add('bg-black');
    else if (themeName === 'Cyberpunk') body.classList.add('bg-[#0a0118]');
    alert(`Theme updated to ${themeName}!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-4xl h-[85vh] bg-[#0c051d]/95 border border-violet-500/30 rounded-3xl overflow-hidden flex flex-col sm:flex-row shadow-[0_0_40px_rgba(139,92,246,0.3)]">
        
        {/* Sidebar Nav */}
        <div className="w-full sm:w-56 bg-black/40 border-r border-white/5 p-4 flex flex-row sm:flex-col gap-1 overflow-x-auto shrink-0 scrollbar-none">
          <div className="hidden sm:block pb-4 mb-4 border-b border-white/10">
            <h3 className="text-sm font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wider">Social Suite</h3>
            <p className="text-[10px] text-gray-500">Startup Extensions Panel</p>
          </div>
          {[
            { id: 'vibebot', label: '🤖 AI DJ & VibeBot' },
            { id: 'vibespace', label: '🗺️ VibeSpace 2D' },
            { id: 'games', label: '🎮 Arcade Games' },
            { id: 'friends', label: '👥 Friends & Profile' },
            { id: 'rooms', label: '🌍 Public Rooms' },
            { id: 'karaoke', label: '🎤 Karaoke & Spotify' },
            { id: 'memories', label: '📸 Scrapbook snaps' },
            { id: 'analytics', label: '📊 Listening Stats' },
            { id: 'options', label: '⚙️ Themes & Trans' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-xl text-left text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1 hidden sm:block" />
          <button
            onClick={onClose}
            className="mt-auto px-3 py-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl text-center transition-all w-full"
          >
            Close Panel
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col min-w-0 bg-transparent relative">
          {/* Close button for mobile inside content */}
          <button onClick={onClose} className="sm:hidden absolute top-4 right-4 p-1 rounded bg-white/5 text-gray-400 hover:text-white">✕</button>

          {/* TAB: VibeBot */}
          {activeTab === 'vibebot' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-violet-400">VibeBot AI Playlist Assistant</h4>
                <p className="text-[11px] text-gray-500">Ask the bot to load Tamil hits, workout mood, or lofi soundtracks.</p>
              </div>

              {/* Chat timeline */}
              <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-4 overflow-y-auto space-y-3 mb-4 max-h-[300px]">
                {botChat.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs ${
                      m.sender === 'user'
                        ? 'bg-violet-600/25 text-white border border-violet-500/35 rounded-br-sm'
                        : 'bg-white/5 text-gray-200 border border-white/5 rounded-bl-sm'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {['Tamil Romantic', 'Party Hits', 'Lofi Beats', 'Workout Gym', 'Study Classical'].map((mood) => (
                  <button
                    key={mood}
                    onClick={() => selectMoodPill(mood)}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/40 text-[10px] text-gray-300 transition-all"
                  >
                    ✨ {mood}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form onSubmit={sendBotMsg} className="flex gap-2">
                <input
                  type="text"
                  value={botInput}
                  onChange={(e) => setBotInput(e.target.value)}
                  placeholder="Ask VibeBot... e.g. Play romantic Tamil songs"
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs outline-none focus:border-violet-500"
                />
                <button type="submit" className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-xl transition-all">Send</button>
              </form>
            </div>
          )}

          {/* TAB: VibeSpace */}
          {activeTab === 'vibespace' && (
            <div className="flex-1 flex flex-col justify-center">
              <VibeSpaceCanvas socket={socket} roomId={roomId} username={username} />
            </div>
          )}

          {/* TAB: Mini Games */}
          {activeTab === 'games' && (
            <div className="flex-1 flex flex-col">
              <MiniGamesPack socket={socket} roomId={roomId} username={username} />
            </div>
          )}

          {/* TAB: Friends & Profiles */}
          {activeTab === 'friends' && (
            <div className="space-y-6">
              {/* Profile details */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 items-center">
                <img src={profile.avatar || 'https://api.dicebear.com/7.x/pixel-art/svg'} alt="Avatar" className="w-16 h-16 rounded-xl border border-violet-500/30" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{username}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">🔥 {profile.streaks} day streak</span>
                  </div>
                  {isEditingBio ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        className="px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-gray-200 outline-none"
                      />
                      <button onClick={handleUpdateBio} className="px-2 py-1 bg-violet-600 text-xs rounded">Save</button>
                    </div>
                  ) : (
                    <p onClick={() => setIsEditingBio(true)} className="text-xs text-gray-400 mt-1 cursor-pointer hover:underline">{profile.bio || 'Click to set bio'}</p>
                  )}
                </div>
              </div>

              {/* Badges list */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Unlocked Badges</h4>
                <div className="flex flex-wrap gap-2">
                  {(profile.badges || []).map(b => (
                    <span key={b} className="px-2.5 py-1 rounded-xl bg-violet-600/10 border border-violet-500/30 text-violet-400 text-[10px] font-bold shadow-[0_0_8px_rgba(139,92,246,0.15)]">
                      {b}
                    </span>
                  ))}
                  <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-gray-500 text-[10px]">👑 Top DJ (Unlocks at 100 plays)</span>
                  <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-gray-500 text-[10px]">🎧 Music Addict (100 rooms)</span>
                </div>
              </div>

              {/* Add friend request */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Add Friend</h4>
                  <form onSubmit={sendFriendRequest} className="flex gap-2">
                    <input
                      type="text"
                      value={newFriendInput}
                      onChange={(e) => setNewFriendInput(e.target.value)}
                      placeholder="Type username..."
                      className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs outline-none focus:border-violet-500"
                    />
                    <button type="submit" className="px-3 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg">Add</button>
                  </form>
                  {friendFeedback && <p className="text-[10px] text-green-400 mt-2">{friendFeedback}</p>}

                  {/* Pending requests */}
                  {pendingRequests.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                      <p className="text-[11px] font-bold text-gray-400">Pending Request alerts</p>
                      {pendingRequests.map(r => (
                        <div key={r} className="flex justify-between items-center bg-white/5 p-2 rounded-xl text-xs">
                          <span>{r}</span>
                          <div className="flex gap-1">
                            <button onClick={() => respondFriendRequest(r, true)} className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-[10px]">Accept</button>
                            <button onClick={() => respondFriendRequest(r, false)} className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-[10px]">Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Friends List */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your Friends List</h4>
                  {friendsList.length === 0 ? (
                    <p className="text-xs text-gray-500">No friends added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {friendsList.map(f => (
                        <div key={f.username} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${f.online ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-gray-500'}`} />
                            {f.username}
                          </span>
                          <button onClick={() => socket.emit('friends:invite', { targetUsername: f.username, roomId })} className="px-2.5 py-0.5 bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/40 text-[10px] font-bold rounded">
                            Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Public Rooms */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-violet-400">Discover Public watch parties</h4>
                  <p className="text-[11px] text-gray-500">Join active watch parties created by other users</p>
                </div>
                <button onClick={makeRoomPublic} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-xl transition-all">Make this room public</button>
              </div>

              {/* Categories */}
              <div className="flex gap-1 overflow-x-auto pb-2 shrink-0">
                {['All', 'Tamil', 'English', 'Party', 'Study', 'Gaming'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      activeCategory === cat
                        ? 'bg-violet-600/20 border-violet-500/50 text-violet-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Rooms List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publicRooms
                  .filter(r => activeCategory === 'All' || r.category === activeCategory)
                  .map(r => (
                    <div key={r.roomId} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex justify-between items-center">
                      <div>
                        <span className="text-[9px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded uppercase font-bold">{r.category}</span>
                        <h5 className="text-xs font-bold text-white mt-1.5">{r.roomName}</h5>
                        <p className="text-[10px] text-gray-500">Code: {r.roomId} • {r.participantsCount || 1} watching</p>
                      </div>
                      <a href={`/room/${r.roomId}`} className="px-3 py-1 bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/40 text-xs font-bold rounded-xl text-center">Join</a>
                    </div>
                  ))}
                {publicRooms.length === 0 && <p className="text-xs text-gray-500 py-6">No public rooms active. Be the first to register one!</p>}
              </div>
            </div>
          )}

          {/* TAB: Karaoke & Spotify */}
          {activeTab === 'karaoke' && (
            <div className="space-y-6">
              {/* Spotify Integration Section */}
              <div className="bg-[#1DB954]/10 border border-[#1DB954]/25 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-[#1DB954] uppercase tracking-wider">Spotify sync Integration</h4>
                  <p className="text-xs text-gray-300 mt-1">Link your Spotify account to import playlists and play songs together.</p>
                </div>
                <button
                  onClick={connectSpotify}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-[0_0_12px_rgba(29,185,84,0.3)] ${
                    spotifyConnected ? 'bg-[#1DB954]/40 cursor-default' : 'bg-[#1DB954] hover:bg-[#1ed760]'
                  }`}
                >
                  {spotifyConnected ? 'Spotify Synced' : 'Connect Spotify'}
                </button>
              </div>

              {/* Karaoke Mode Sync */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider">Synced Karaoke lyrics Player</h4>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500">Duet Mode</label>
                    <input
                      type="checkbox"
                      checked={duetActive}
                      onChange={(e) => {
                        setDuetActive(e.target.checked);
                        if (socket) socket.emit('karaoke:duet:toggle', { roomId, isDuet: e.target.checked, duetPartner: 'Bob' });
                      }}
                      className="w-3.5 h-3.5 accent-violet-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Lyrics Highlight Display Box */}
                <div className="bg-black/60 border border-violet-500/20 py-8 px-4 rounded-xl text-center">
                  <p className="text-lg font-black text-violet-300 animate-pulse tracking-wide select-none">{karaokeLyric}</p>
                </div>

                <div className="flex gap-6 justify-center text-xs">
                  <div>
                    <span className="text-[9px] text-gray-500 block uppercase">Karaoke Mic Level</span>
                    <div className="w-24 h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-green-400 animate-pulse" style={{ width: '65%' }} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block uppercase">Perfect Tempo Score</span>
                    <span className="text-xs font-bold text-cyan-400 font-mono">92/100</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Scrapbook snaps memories */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-violet-400">Watch Party Scrapbook</h4>
                  <p className="text-[11px] text-gray-500">Take screenshots and snapshot memories of active player vibes</p>
                </div>
                <button onClick={captureSnap} className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-xl transition-all">Capture Memory Snap</button>
              </div>

              {/* Memories grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {memories.map(m => (
                  <div key={m.id} className="bg-white/5 border border-white/10 p-2.5 rounded-2xl flex flex-col gap-2 group relative overflow-hidden">
                    <img src={m.image} alt="polaroid" className="w-full aspect-square object-cover rounded-xl border border-white/5" />
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="text-[10px] font-bold text-white truncate max-w-[120px]">{m.title}</h5>
                        <p className="text-[8px] text-gray-500">{m.timestamp}</p>
                      </div>
                      <button onClick={() => alert('Memory snapshot downloaded!')} className="p-1 hover:bg-white/10 rounded text-[9px] text-violet-400 hover:text-white">💾</button>
                    </div>
                  </div>
                ))}
                {memories.length === 0 && (
                  <div className="col-span-full py-16 text-center text-xs text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                    📸 Click the button above to capture a new polaroid scrapbook memory!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Analytics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-violet-400">Listening stats & analytics</h4>
                <p className="text-[11px] text-gray-500">Weekly and monthly listening recaps</p>
              </div>

              {/* Listening Time Chart (SVG) */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <h5 className="text-xs font-bold text-gray-400 mb-3">Weekly Listening time (Hours)</h5>
                <svg className="w-full h-32 text-violet-500" viewBox="0 0 300 100">
                  <path d="M10,80 L50,60 L90,70 L130,40 L170,30 L210,50 L250,20 L290,10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  {/* Grid lines */}
                  <line x1="0" y1="90" x2="300" y2="90" stroke="rgba(255,255,255,0.1)" />
                  <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.1)" />
                  <line x1="0" y1="10" x2="300" y2="10" stroke="rgba(255,255,255,0.1)" />
                  {/* Labels */}
                  <text x="10" y="98" fill="rgba(255,255,255,0.4)" fontSize="8">Mon</text>
                  <text x="90" y="98" fill="rgba(255,255,255,0.4)" fontSize="8">Wed</text>
                  <text x="170" y="98" fill="rgba(255,255,255,0.4)" fontSize="8">Fri</text>
                  <text x="250" y="98" fill="rgba(255,255,255,0.4)" fontSize="8">Sun</text>
                </svg>
              </div>

              {/* Top Artists / Songs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <h5 className="text-xs font-bold text-gray-400 mb-2">Top Artists</h5>
                  <ol className="list-decimal list-inside text-xs space-y-1 text-gray-300">
                    <li>Anirudh Ravichander</li>
                    <li>AR Rahman</li>
                    <li>Ed Sheeran</li>
                  </ol>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <h5 className="text-xs font-bold text-gray-400 mb-2">Top Songs</h5>
                  <ol className="list-decimal list-inside text-xs space-y-1 text-gray-300">
                    <li>Anbirkum Undo</li>
                    <li>Uptown Funk</li>
                    <li>Despacito</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Options (Theme & Translation) */}
          {activeTab === 'options' && (
            <div className="space-y-6">
              {/* Dynamic Themes */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Dynamic Themes</h4>
                <div className="grid grid-cols-2 gap-3">
                  {['Cyberpunk', 'Neon', 'AMOLED', 'Glassmorphism'].map(themeName => (
                    <button
                      key={themeName}
                      onClick={() => selectTheme(themeName)}
                      className={`p-3 text-xs font-semibold rounded-2xl border transition-all ${
                        selectedTheme === themeName
                          ? 'bg-violet-600/20 border-violet-500/50 text-violet-400'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {themeName} {selectedTheme === themeName && '✓'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Translation */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider">Live Chat Translation</h4>
                  <p className="text-xs text-gray-400 mt-1">Auto-translate all incoming watch party messages between Tamil, English, and Hindi.</p>
                </div>
                <input
                  type="checkbox"
                  checked={translationActive}
                  onChange={(e) => setTranslationActive(e.target.checked)}
                  className="w-4 h-4 accent-violet-500 cursor-pointer"
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
