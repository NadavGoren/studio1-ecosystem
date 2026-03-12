import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { Pipette, Move, Plus, X, ChevronDown, ChevronRight, Palette } from 'lucide-react';

// Pilot G-Tec-C 8-Color Set
const PILOT_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Green', hex: '#008000' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Light Blue', hex: '#00BFFF' }, // Deep Sky Blue (Cyan-ish)
  { name: 'Yellow', hex: '#FFD700' },     // Gold
  { name: 'Purple', hex: '#a333ff' },
];

export function ColorPanel() {
  const { 
    selectedShapeIds, updateShape, 
    tool, setTool, eyedropperMode, setEyedropperMode,
    swatches, addSwatch, removeSwatch, pushState
  } = useAppStore();

  // FIX: Positioned at x=320 to avoid overlapping the Left Panel (288px width)
  const [position, setPosition] = useState({ x: 320, y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(true);

  // Drag Logic
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const handleUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging]);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const applyColor = (hex: string) => {
    if (selectedShapeIds.length > 0) {
      pushState();
      selectedShapeIds.forEach(id => updateShape(id, { color: hex }));
    }
  };

  return (
    <div 
      className="fixed flex flex-col w-64 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 z-50"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-grab active:cursor-grabbing bg-gray-50/50 rounded-t-xl"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
          <Palette size={12} /> Color & Style
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-gray-200 rounded">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4">
          
          {/* Eyedropper Toggle & Settings */}
          <div className="space-y-2">
            <button 
              onClick={() => setTool(tool === 'eyedropper' ? 'select' : 'eyedropper')}
              className={`w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium border transition-colors
                ${tool === 'eyedropper' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}
              `}
            >
              <Pipette size={14} /> Eyedropper Tool (I)
            </button>

            {tool === 'eyedropper' && (
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded border border-gray-100">
                <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={eyedropperMode.copyColor} onChange={e => setEyedropperMode({ copyColor: e.target.checked })} /> Color
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={eyedropperMode.copyStroke} onChange={e => setEyedropperMode({ copyStroke: e.target.checked })} /> Stroke
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={eyedropperMode.copyHatch} onChange={e => setEyedropperMode({ copyHatch: e.target.checked })} /> Hatching
                </label>
              </div>
            )}
          </div>

          {/* Pilot G-Tec Colors (7 Count) */}
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Pilot G-Tec-C</div>
            <div className="grid grid-cols-7 gap-1.5">
              {PILOT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => applyColor(c.hex)}
                  className="w-6 h-6 rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform relative group"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  <span className="sr-only">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Swatches */}
          <div>
            <div className="flex items-center justify-between mb-2">
               <div className="text-[10px] font-bold text-gray-400 uppercase">My Swatches</div>
               <button onClick={() => addSwatch('#000000')} className="text-gray-400 hover:text-black"><Plus size={12}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {swatches.map((hex, i) => (
                <div key={i} className="relative group">
                   <button
                    onClick={() => applyColor(hex)}
                    className="w-6 h-6 rounded-md border border-gray-200 shadow-sm"
                    style={{ backgroundColor: hex }}
                   />
                   <button 
                     onClick={(e) => { e.stopPropagation(); removeSwatch(hex); }}
                     className="absolute -top-1 -right-1 bg-white rounded-full shadow border border-gray-200 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <X size={8} />
                   </button>
                   <input 
                      type="color" 
                      value={hex}
                      onChange={(e) => {
                         const newSwatches = [...swatches];
                         newSwatches[i] = e.target.value;
                         useAppStore.setState({ swatches: newSwatches });
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                   />
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}