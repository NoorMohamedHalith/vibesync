import { useState, useRef, useEffect } from 'react';

export default function MiniGamesPack({ socket, roomId, username }) {
  const [activeGame, setActiveGame] = useState(null); // null | 'guess' | 'trivia' | 'emoji' | 'draw' | 'battle'
  const [score, setScore] = useState(0);
  const [lobbyScores, setLobbyScores] = useState([
    { name: username, score: 0 },
    { name: 'Alice', score: 140 },
    { name: 'Bob', score: 85 }
  ]);

  // 1. Guess the Song
  const [songInput, setSongInput] = useState('');
  const [guessFeedback, setGuessFeedback] = useState('');
  const handleGuessSong = (e) => {
    e.preventDefault();
    if (songInput.trim().toLowerCase() === 'despacito') {
      setGuessFeedback('🎉 Correct! +50 Points');
      setScore(prev => prev + 50);
      setSongInput('');
    } else {
      setGuessFeedback('❌ Wrong! Try again.');
    }
  };

  // 2. Trivia Quiz
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const TRIVIA_QUESTIONS = [
    { q: 'Who composed the music for Slumdog Millionaire?', options: ['Anirudh', 'AR Rahman', 'Yuvan Shankar Raja', 'Harris Jayaraj'], correct: 1 },
    { q: 'Which song is famously known as the anthem of chill lofi?', options: ['Lofi Beats', 'Chill Hip Hop', 'Get Lucky', 'Gypsy In My Mind'], correct: 1 }
  ];

  const handleTriviaAnswer = (idx) => {
    setSelectedAnswer(idx);
    if (idx === TRIVIA_QUESTIONS[currentQuestion].correct) {
      setQuizScore(prev => prev + 1);
      setScore(prev => prev + 30);
    }
    setTimeout(() => {
      if (currentQuestion < TRIVIA_QUESTIONS.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        alert(`Trivia Finished! Your score: ${quizScore + (idx === TRIVIA_QUESTIONS[currentQuestion].correct ? 1 : 0)}/${TRIVIA_QUESTIONS.length}`);
        setActiveGame(null);
      }
    }, 1500);
  };

  // 3. Emoji Challenge
  const [emojiInput, setEmojiInput] = useState('');
  const [emojiFeedback, setEmojiFeedback] = useState('');
  const EMOJI_CHALLENGES = [
    { emojis: '👑🦁❤️', hint: 'Tamil Movie Song/Theme', answer: 'leo' },
    { emojis: '🌧️🎵🌧️', hint: 'Classic rain song', answer: 'singing in the rain' }
  ];
  const [currentEmojiIdx, setCurrentEmojiIdx] = useState(0);

  const handleEmojiGuess = (e) => {
    e.preventDefault();
    if (emojiInput.trim().toLowerCase() === EMOJI_CHALLENGES[currentEmojiIdx].answer) {
      setEmojiFeedback('🎉 Bravo! You nailed it! +40 Points');
      setScore(prev => prev + 40);
      setEmojiInput('');
      setTimeout(() => {
        if (currentEmojiIdx < EMOJI_CHALLENGES.length - 1) {
          setCurrentEmojiIdx(prev => prev + 1);
          setEmojiFeedback('');
        } else {
          setActiveGame(null);
        }
      }, 1500);
    } else {
      setEmojiFeedback('❌ Not quite. Check the hint!');
    }
  };

  // 4. Draw & Guess
  const drawCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawGuess, setDrawGuess] = useState('');
  const [drawFeedback, setDrawFeedback] = useState('');

  const startDrawing = (e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleDrawGuessSubmit = (e) => {
    e.preventDefault();
    if (drawGuess.trim().toLowerCase() === 'guitar') {
      setDrawFeedback('🎉 Correct Guess! +60 Points');
      setScore(prev => prev + 60);
      setDrawGuess('');
    } else {
      setDrawFeedback('❌ Incorrect. Keep guessing!');
    }
  };

  // 5. Music Battle (Tapping game)
  const [battleScore, setBattleScore] = useState(0);
  const [battleTimer, setBattleTimer] = useState(10);
  const battleInterval = useRef(null);

  const startBattle = () => {
    setBattleScore(0);
    setBattleTimer(10);
    battleInterval.current = setInterval(() => {
      setBattleTimer(prev => {
        if (prev <= 1) {
          clearInterval(battleInterval.current);
          setScore(p => p + battleScore * 5);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTap = () => {
    if (battleTimer > 0) {
      setBattleScore(prev => prev + 1);
    }
  };

  useEffect(() => {
    return () => clearInterval(battleInterval.current);
  }, []);

  // Update lobby scores on local score changes
  useEffect(() => {
    setLobbyScores(prev =>
      prev.map(p => (p.name === username ? { ...p, score } : p))
    );
  }, [score, username]);

  return (
    <div className="flex flex-col gap-4 bg-gray-950/65 border border-white/10 p-5 rounded-2xl w-full text-white">
      {/* Game Selector Grid */}
      {!activeGame ? (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-bold text-violet-400">VibeSync Arcade Multiplayer Lobby</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Select a game to start playing with friends</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveGame('guess')}
              className="p-3 bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
            >
              <span className="text-2xl">🎵</span>
              <span className="text-xs font-semibold">Guess the Song</span>
            </button>
            <button
              onClick={() => setActiveGame('trivia')}
              className="p-3 bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
            >
              <span className="text-2xl">❓</span>
              <span className="text-xs font-semibold">Trivia Quiz</span>
            </button>
            <button
              onClick={() => setActiveGame('emoji')}
              className="p-3 bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
            >
              <span className="text-2xl">🧩</span>
              <span className="text-xs font-semibold">Emoji Challenge</span>
            </button>
            <button
              onClick={() => setActiveGame('draw')}
              className="p-3 bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
            >
              <span className="text-2xl">🎨</span>
              <span className="text-xs font-semibold">Draw & Guess</span>
            </button>
            <button
              onClick={() => { setActiveGame('battle'); startBattle(); }}
              className="p-3 bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
            >
              <span className="text-2xl">🥊</span>
              <span className="text-xs font-semibold">Music Battle</span>
            </button>
          </div>

          {/* Scoreboard */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Lobby Leaderboard</h4>
            <div className="space-y-1">
              {lobbyScores.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-white/5 last:border-0">
                  <span className="font-medium text-gray-300">{idx + 1}. {p.name}</span>
                  <span className="font-bold text-violet-400">{p.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-violet-400 uppercase">
              {activeGame === 'guess' && 'Guess the Song'}
              {activeGame === 'trivia' && 'Music Trivia'}
              {activeGame === 'emoji' && 'Emoji Challenge'}
              {activeGame === 'draw' && 'Draw & Guess'}
              {activeGame === 'battle' && 'Music Battle'}
            </span>
            <button
              onClick={() => setActiveGame(null)}
              className="text-[10px] text-red-400 hover:text-red-300 font-bold"
            >
              Back to Lobby
            </button>
          </div>

          {/* GAME VIEWPORTS */}

          {/* 1. Guess the Song */}
          {activeGame === 'guess' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Listen to the currently playing Watch Party audio and type the song title below!</p>
              <p className="text-[10px] text-gray-500">Hint: Try guessing "Despacito" for mock points</p>
              <form onSubmit={handleGuessSong} className="flex gap-2">
                <input
                  type="text"
                  value={songInput}
                  onChange={(e) => setSongInput(e.target.value)}
                  placeholder="Type song name..."
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-violet-500"
                />
                <button type="submit" className="px-3 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg">Submit</button>
              </form>
              {guessFeedback && <p className="text-xs font-semibold text-center mt-2">{guessFeedback}</p>}
            </div>
          )}

          {/* 2. Trivia Quiz */}
          {activeGame === 'trivia' && (
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                <p className="text-xs font-bold">{TRIVIA_QUESTIONS[currentQuestion].q}</p>
              </div>
              <div className="flex flex-col gap-2">
                {TRIVIA_QUESTIONS[currentQuestion].options.map((opt, i) => (
                  <button
                    key={i}
                    disabled={selectedAnswer !== null}
                    onClick={() => handleTriviaAnswer(i)}
                    className={`p-2.5 text-left text-xs rounded-xl border transition-all ${
                      selectedAnswer === i
                        ? i === TRIVIA_QUESTIONS[currentQuestion].correct
                          ? 'bg-green-500/20 border-green-500/40 text-green-400'
                          : 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Emoji Challenge */}
          {activeGame === 'emoji' && (
            <div className="space-y-3">
              <div className="text-center bg-white/5 border border-white/10 py-6 rounded-lg text-3xl">
                {EMOJI_CHALLENGES[currentEmojiIdx].emojis}
              </div>
              <p className="text-[10px] text-center text-gray-500">Hint: {EMOJI_CHALLENGES[currentEmojiIdx].hint} (Try: "{EMOJI_CHALLENGES[currentEmojiIdx].answer}")</p>
              <form onSubmit={handleEmojiGuess} className="flex gap-2">
                <input
                  type="text"
                  value={emojiInput}
                  onChange={(e) => setEmojiInput(e.target.value)}
                  placeholder="Guess song or movie..."
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-violet-500"
                />
                <button type="submit" className="px-3 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg">Guess</button>
              </form>
              {emojiFeedback && <p className="text-xs font-semibold text-center mt-2">{emojiFeedback}</p>}
            </div>
          )}

          {/* 4. Draw & Guess */}
          {activeGame === 'draw' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-violet-300">Secret word to draw: <span className="underline">GUITAR</span></span>
                <button onClick={clearDrawCanvas} className="text-gray-400 hover:text-white">Clear</button>
              </div>
              <canvas
                ref={drawCanvasRef}
                width={300}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="bg-gray-950 border border-white/10 rounded-xl cursor-pencil w-full aspect-[3/2]"
              />
              <form onSubmit={handleDrawGuessSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={drawGuess}
                  onChange={(e) => setDrawGuess(e.target.value)}
                  placeholder="Guess what they are drawing..."
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-violet-500"
                />
                <button type="submit" className="px-3 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg">Guess</button>
              </form>
              {drawFeedback && <p className="text-xs font-semibold text-center mt-2">{drawFeedback}</p>}
            </div>
          )}

          {/* 5. Music Battle (Tap tempo) */}
          {activeGame === 'battle' && (
            <div className="space-y-3 text-center">
              <p className="text-xs text-gray-400">Click/Tap the button as fast as you can to catch the tempo!</p>
              
              <div className="flex justify-center gap-6 py-2">
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Time Left</span>
                  <span className="text-xl font-bold text-violet-400 font-mono">{battleTimer}s</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Your Taps</span>
                  <span className="text-xl font-bold text-cyan-400 font-mono">{battleScore}</span>
                </div>
              </div>

              {battleTimer > 0 ? (
                <button
                  onClick={handleTap}
                  className="w-24 h-24 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 shadow-[0_0_15px_rgba(139,92,246,0.5)] flex items-center justify-center font-bold text-sm mx-auto select-none"
                >
                  TAP!
                </button>
              ) : (
                <div className="py-4">
                  <p className="text-xs text-green-400 font-bold">Battle finished! You got {battleScore * 5} pts</p>
                  <button
                    onClick={startBattle}
                    className="mt-3 px-4 py-1.5 bg-white/10 hover:bg-white/15 text-xs rounded-xl font-semibold border border-white/10"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
