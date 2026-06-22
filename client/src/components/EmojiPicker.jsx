import { useState } from 'react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩',
      '😊', '🙂', '😇', '🥳', '😜', '🤪', '😝', '🤗',
      '🤔', '😏', '😬', '🫠', '😅', '😆', '😋', '🤤',
      '😲', '😱', '🥹', '😢', '😭', '🤯', '🫡', '🫣',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟',
      '🤘', '👌', '💪', '🫶', '👋', '🤚', '✋', '🖐️',
      '☝️', '👆', '👇', '👈', '👉', '🫵', '🙏', '🤙',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💗', '💖', '💝', '💘', '💕', '💞', '❤️‍🔥', '💔',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '🔥', '⚡', '✨', '🎉', '🎊', '🎵', '🎶', '🎬',
      '📺', '🎮', '🎯', '🏆', '🥇', '💎', '🚀', '🌟',
      '🍿', '☕', '🍕', '🍔', '🌮', '🍩', '🎂', '🍻',
    ],
  },
];

function EmojiPicker({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="glass rounded-xl p-3 animate-scale-in">
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 border-b border-white/10 pb-2">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(idx)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === idx
                ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 max-h-36 overflow-y-auto pr-1">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-brand-100 dark:hover:bg-white/10 hover:scale-125 transition-all duration-150"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiPicker;
