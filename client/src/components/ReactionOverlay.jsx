import { useState, useImperativeHandle, forwardRef } from 'react';

const ReactionOverlay = forwardRef((props, ref) => {
  const [items, setItems] = useState([]);

  useImperativeHandle(ref, () => ({
    addReaction(emoji) {
      const id = Math.random().toString(36).substring(2, 9);
      const style = {
        left: `${20 + Math.random() * 60}%`, // random start horizontal offset (20% to 80% width)
        '--drift-x': `${(Math.random() - 0.5) * 120}px`, // random horizontal drift
        animationDuration: `${2.5 + Math.random() * 1.2}s`, // random rise duration
      };
      
      setItems((prev) => [...prev, { id, emoji, style }]);
      
      // Auto clean-up after the animation ends
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, 4000);
    }
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      <style>{`
        .floating-reaction {
          position: absolute;
          bottom: 12px;
          font-size: 2.5rem;
          opacity: 0;
          animation: floatUp 3s ease-out forwards;
          will-change: transform, opacity;
          filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.4));
        }
        @keyframes floatUp {
          0% {
            transform: translateY(100%) scale(0.5);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translateY(80%) scale(1.2);
          }
          50% {
            transform: translateY(40%) translateX(calc(var(--drift-x) * 0.5)) scale(1.0);
            opacity: 0.95;
          }
          100% {
            transform: translateY(-20%) translateX(var(--drift-x)) scale(0.7);
            opacity: 0;
          }
        }
      `}</style>
      {items.map((item) => (
        <span
          key={item.id}
          style={item.style}
          className="floating-reaction select-none"
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
});

ReactionOverlay.displayName = 'ReactionOverlay';
export default ReactionOverlay;
