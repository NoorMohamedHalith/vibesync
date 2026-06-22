import { useState, useRef, useEffect } from 'react';
import EmojiPicker from './EmojiPicker';

export default function Chat({ messages = [], socket, roomId, username }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // socketId -> username
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket listener for typing indicators
  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = ({ socketId, username: typingUsername, isTyping }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (isTyping) {
          next[socketId] = typingUsername;
        } else {
          delete next[socketId];
        }
        return next;
      });
    };

    socket.on('user-typing', handleUserTyping);

    return () => {
      socket.off('user-typing', handleUserTyping);
    };
  }, [socket]);

  const sendMessage = () => {
    if (!text.trim() || !socket) return;
    
    // Send message and reset typing state
    socket.emit('send-message', { roomId, text: text.trim() });
    socket.emit('typing', { roomId, isTyping: false });
    socket.emit('activity:update', { roomId, activity: 'Watching...' });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    setText('');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);

    if (socket) {
      socket.emit('typing', { roomId, isTyping: true });
      socket.emit('activity:update', { roomId, activity: 'Typing...' });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { roomId, isTyping: false });
        socket.emit('activity:update', { roomId, activity: 'Watching...' });
      }, 2000);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleReaction = (messageId, emoji) => {
    if (!socket) return;
    socket.emit('add-reaction', { roomId, messageId, emoji });
  };

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickReactions = ['👍', '❤️', '😂', '🔥', '👏'];
  const typingList = Object.values(typingUsers);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Chat</h3>
          <span className="text-xs text-gray-500">{messages.length} messages</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm">No messages yet</span>
            <span className="text-xs mt-1">Start the conversation!</span>
          </div>
        )}

        {messages.map((msg, index) => {
          const isOwn = msg.username === username;
          const isSystem = msg.username === 'System';

          if (isSystem) {
            return (
              <div key={msg.id || index} className="flex justify-center animate-fade-in">
                <span className="px-3 py-1 text-xs text-gray-400 bg-white/5 border border-white/5 rounded-full">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id || index}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Username & Time */}
                <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {!isOwn && (
                    <span className="text-xs font-bold text-violet-400">
                      {msg.username}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-500">{formatTimestamp(msg.timestamp)}</span>
                </div>

                {/* Message bubble */}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words border ${
                    isOwn
                      ? 'bg-gradient-to-br from-violet-500/20 to-indigo-600/25 border-violet-500/30 text-white rounded-br-md shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                      : 'bg-white/5 border-white/5 text-gray-200 rounded-bl-md'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        type="button"
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-110 ${
                          users?.includes(username)
                            ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400'
                            : 'bg-white/5 border border-white/5 text-gray-400'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{users?.length || 0}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick reactions */}
                <div className={`flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(msg.id, emoji)}
                      type="button"
                      className="p-1 text-xs rounded hover:bg-white/5 hover:scale-125 transition-all text-gray-400 hover:text-white"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicators */}
      {typingList.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-gray-400 italic flex items-center gap-2 shrink-0 animate-pulse">
          <span className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span>
            {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      {/* Input Form container */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="relative">
          {showEmoji && (
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmoji(false)}
            />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              type="button"
              className={`p-2.5 rounded-xl transition-all ${
                showEmoji
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (socket) {
                  socket.emit('activity:update', { roomId, activity: 'Typing...' });
                }
              }}
              onBlur={() => {
                if (socket) {
                  socket.emit('activity:update', { roomId, activity: 'Watching...' });
                }
              }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />

            <button
              onClick={sendMessage}
              disabled={!text.trim()}
              type="button"
              className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 disabled:opacity-40 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
