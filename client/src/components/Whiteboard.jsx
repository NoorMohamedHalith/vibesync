import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function Whiteboard({ roomId }) {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#8b5cf6'); // Default brand purple
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState('pencil'); // 'pencil' | 'brush' | 'line' | 'rectangle' | 'circle' | 'eraser' | 'text'
  
  // History arrays for Undo/Redo
  const [history, setHistory] = useState([]);
  const [redoList, setRedoList] = useState([]);
  const historyRef = useRef([]);
  const redoRef = useRef([]);

  // Coordinates for shapes
  const startCoords = useRef({ x: 0, y: 0 });
  const lastCoords = useRef({ x: 0, y: 0 });

  // For text input placement
  const [textInput, setTextInput] = useState(null); // { x, y, value }

  // Sync ref values with state
  const updateHistory = (newHistory) => {
    historyRef.current = newHistory;
    setHistory(newHistory);
  };

  const addToHistory = (element) => {
    const newHistory = [...historyRef.current, element];
    historyRef.current = newHistory;
    setHistory(newHistory);
  };

  useEffect(() => {
    redoRef.current = redoList;
  }, [redoList]);

  // Redraw all elements in the history stack
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw elements
    historyRef.current.forEach((el) => {
      drawElement(ctx, el);
    });
  };

  const drawElement = (ctx, el) => {
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (el.tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
    }

    if (el.type === 'segment') {
      ctx.beginPath();
      ctx.moveTo(el.x0, el.y0);
      ctx.lineTo(el.x1, el.y1);
      ctx.stroke();
    } else if (el.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(el.x0, el.y0);
      ctx.lineTo(el.x1, el.y1);
      ctx.stroke();
    } else if (el.type === 'rectangle') {
      ctx.beginPath();
      ctx.rect(el.x0, el.y0, el.x1 - el.x0, el.y1 - el.y0);
      ctx.stroke();
    } else if (el.type === 'circle') {
      ctx.beginPath();
      const radius = Math.sqrt(Math.pow(el.x1 - el.x0, 2) + Math.pow(el.y1 - el.y0, 2));
      ctx.arc(el.x0, el.y0, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (el.type === 'text') {
      ctx.font = `${el.size * 3 + 12}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(el.text, el.x0, el.y0);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = 500 * 2;
    canvas.style.height = '500px';

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    contextRef.current = context;

    redrawCanvas();

    // Socket listeners
    const handleDrawEvent = (data) => {
      if (data.type === 'history-update') {
        updateHistory(data.history || []);
        redrawCanvas();
      } else if (data.type === 'live-segment') {
        const ctx = contextRef.current;
        if (ctx) drawElement(ctx, data);
        addToHistory(data);
      }
    };

    const handleClearEvent = () => {
      updateHistory([]);
      setRedoList([]);
      redrawCanvas();
    };

    const handleRequestState = ({ requesterId }) => {
      if (socket) {
        socket.emit('whiteboard-state-response', {
          targetId: requesterId,
          history: historyRef.current,
        });
      }
    };

    const handleReceiveState = ({ history: remoteHistory }) => {
      updateHistory(remoteHistory || []);
      redrawCanvas();
    };

    if (socket) {
      socket.on('whiteboard-draw', handleDrawEvent);
      socket.on('whiteboard-clear', handleClearEvent);
      socket.on('whiteboard-request-state', handleRequestState);
      socket.on('whiteboard-receive-state', handleReceiveState);
      socket.emit('whiteboard-request-state', { roomId });
    }

    return () => {
      if (socket) {
        socket.off('whiteboard-draw', handleDrawEvent);
        socket.off('whiteboard-clear', handleClearEvent);
        socket.off('whiteboard-request-state', handleRequestState);
        socket.off('whiteboard-receive-state', handleReceiveState);
      }
    };
  }, [socket, roomId]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    if (tool === 'text') {
      const coords = getCoordinates(e);
      setTextInput({ x: coords.x, y: coords.y, value: '' });
      return;
    }

    const coords = getCoordinates(e);
    startCoords.current = coords;
    lastCoords.current = coords;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;
    e.preventDefault();

    const currentCoords = getCoordinates(e);
    const ctx = contextRef.current;

    // For pencil/brush/eraser, draw segments dynamically
    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      const segment = {
        type: 'segment',
        tool,
        x0: lastCoords.current.x,
        y0: lastCoords.current.y,
        x1: currentCoords.x,
        y1: currentCoords.y,
        color,
        size: tool === 'brush' ? brushSize * 2 : tool === 'eraser' ? brushSize * 3 : brushSize,
      };

      drawElement(ctx, segment);
      addToHistory(segment);

      if (socket) {
        socket.emit('whiteboard-draw', { roomId, type: 'live-segment', ...segment });
      }
      lastCoords.current = currentCoords;
    } else {
      // Shapes: draw local preview on redraw
      redrawCanvas();
      
      // Draw live shape outline
      const tempElement = {
        type: tool,
        tool,
        x0: startCoords.current.x,
        y0: startCoords.current.y,
        x1: currentCoords.x,
        y1: currentCoords.y,
        color,
        size: brushSize,
      };
      drawElement(ctx, tempElement);
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'line' || tool === 'rectangle' || tool === 'circle') {
      const currentCoords = getCoordinates(e);
      const newShape = {
        type: tool,
        tool,
        x0: startCoords.current.x,
        y0: startCoords.current.y,
        x1: currentCoords.x,
        y1: currentCoords.y,
        color,
        size: brushSize,
      };

      const updatedHistory = [...historyRef.current, newShape];
      updateHistory(updatedHistory);
      setRedoList([]);
      redrawCanvas();

      if (socket) {
        socket.emit('whiteboard-draw', { roomId, type: 'history-update', history: updatedHistory });
      }
    }
  };

  const handleTextSubmit = (e) => {
    if (e.key === 'Enter' && textInput && textInput.value.trim()) {
      const newText = {
        type: 'text',
        tool: 'text',
        x0: textInput.x,
        y0: textInput.y,
        text: textInput.value.trim(),
        color,
        size: brushSize,
      };

      const updatedHistory = [...historyRef.current, newText];
      updateHistory(updatedHistory);
      setRedoList([]);
      setTextInput(null);
      redrawCanvas();

      if (socket) {
        socket.emit('whiteboard-draw', { roomId, type: 'history-update', history: updatedHistory });
      }
    } else if (e.key === 'Escape') {
      setTextInput(null);
    }
  };

  const handleUndo = () => {
    if (historyRef.current.length === 0) return;
    const item = historyRef.current[historyRef.current.length - 1];
    
    const newHistory = historyRef.current.slice(0, -1);
    updateHistory(newHistory);
    setRedoList((prev) => [item, ...prev]);
    redrawCanvas();

    if (socket) {
      socket.emit('whiteboard-draw', { roomId, type: 'history-update', history: newHistory });
    }
  };

  const handleRedo = () => {
    if (redoRef.current.length === 0) return;
    const item = redoRef.current[0];
    
    setRedoList((prev) => prev.slice(1));
    const newHistory = [...historyRef.current, item];
    updateHistory(newHistory);
    redrawCanvas();

    if (socket) {
      socket.emit('whiteboard-draw', { roomId, type: 'history-update', history: newHistory });
    }
  };

  const handleClearBoard = () => {
    updateHistory([]);
    setRedoList([]);
    redrawCanvas();
    if (socket) {
      socket.emit('whiteboard-clear', { roomId });
      addToast({ type: 'info', message: 'Whiteboard cleared!' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden animate-fade-in text-gray-900">
      {/* Tool bar controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 border-b border-gray-200 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tool Selector */}
          <div className="flex items-center bg-gray-200/60 p-1 rounded-xl flex-wrap gap-1">
            {[
              { id: 'pencil', label: 'Pencil', icon: '✏️' },
              { id: 'brush', label: 'Brush', icon: '🖌️' },
              { id: 'line', label: 'Line', icon: '📏' },
              { id: 'rectangle', label: 'Rect', icon: '⬛' },
              { id: 'circle', label: 'Circle', icon: '⭕' },
              { id: 'eraser', label: 'Eraser', icon: '🧹' },
              { id: 'text', label: 'Text', icon: '🔤' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setTool(t.id); setTextInput(null); }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  tool === t.id ? 'bg-white shadow text-brand-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Color palette */}
          {tool !== 'eraser' && (
            <div className="flex items-center gap-1.5">
              {['#8b5cf6', '#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#000000'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border transition-transform ${
                    color === c ? 'scale-110 border-gray-400 ring-2 ring-brand-500/20' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 overflow-hidden"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Size picker */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Size</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-20 accent-brand-500"
            />
            <span className="text-xs font-mono text-gray-700 w-5">{brushSize}px</span>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          {/* Undo/Redo Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold transition-all"
              title="Undo"
            >
              ↩️
            </button>
            <button
              onClick={handleRedo}
              disabled={redoList.length === 0}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold transition-all"
              title="Redo"
            >
              ↪️
            </button>
          </div>

          <button
            onClick={handleClearBoard}
            className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors flex items-center gap-1"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex-1 bg-white relative cursor-crosshair h-[400px]">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full bg-white touch-none"
        />

        {/* Dynamic Text Input Box */}
        {textInput && (
          <div
            className="absolute z-20 p-1 bg-white border border-violet-500 rounded-lg shadow-lg"
            style={{ left: `${textInput.x}px`, top: `${textInput.y}px` }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Enter text..."
              value={textInput.value}
              onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
              onKeyDown={handleTextSubmit}
              onBlur={() => setTextInput(null)}
              className="px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-800"
            />
            <div className="text-[9px] text-gray-400 px-2 mt-0.5">Press Enter to place, Esc to cancel</div>
          </div>
        )}
      </div>
    </div>
  );
}
