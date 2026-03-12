import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { 
  Combine, Minus, X, Square, 
  ChevronDown, ChevronRight, 
  Layers, Ungroup, Move,
  AlignLeft, AlignCenter, AlignRight,
  ArrowUpToLine, FoldVertical, ArrowDownToLine
} from 'lucide-react';

export function PathfinderPanel() {
  const { 
    performBooleanOperation, 
    groupSelection, 
    ungroupSelection, 
    selectedShapeIds, 
    shapes,
    alignSelection
  } = useAppStore();
  
  // FIX: Calculate position to prevent overlap with Right Panel
  // RightPanel (w-72) = 288px
  // Pathfinder (w-56) = 224px
  // Gap = ~28px
  // Total Offset = 540px from right edge
  const [position, setPosition] = useState({ x: window.innerWidth - 540, y: 70 });
  
  // Update position on mount to ensure it captures the correct window size
  useEffect(() => {
    setPosition({ x: window.innerWidth - 540, y: 70 });
  }, []);

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

  const hasSelection = selectedShapeIds.length > 0;
  const isMultiple = selectedShapeIds.length > 1;
  const canGroup = isMultiple;
  const canUngroup = selectedShapeIds.some(id => shapes.find(s => s.id === id)?.type === 'group');
  const canBoolean = isMultiple;
  const canAlign = selectedShapeIds.length >= 1; // Can align with 1 shape (to margins) or multiple shapes

  const getOpacity = (active: boolean) => active ? 'opacity-100 cursor-pointer hover:bg-gray-100' : 'opacity-40 cursor-not-allowed';

  return (
    <div 
      className="fixed flex flex-col w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 z-50 transition-shadow duration-200"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-grab active:cursor-grabbing bg-gray-50/50 rounded-t-xl"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
          <Move size={12} /> Actions
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-gray-200 rounded">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4">
          
          {/* Alignment */}
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Align</div>
            <div className="space-y-2">
              {/* Horizontal Alignment */}
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => canAlign && alignSelection('left')} 
                  disabled={!canAlign}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canAlign)}`}
                  title="Align Left"
                >
                  <AlignLeft size={18} className="text-gray-700"/>
                </button>
                <button 
                  onClick={() => canAlign && alignSelection('center')}
                  disabled={!canAlign}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canAlign)}`}
                  title="Align Center"
                >
                  <AlignCenter size={18} className="text-gray-700"/>
                </button>
                <button 
                  onClick={() => canAlign && alignSelection('right')}
                  disabled={!canAlign}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canAlign)}`}
                  title="Align Right"
                >
                  <AlignRight size={18} className="text-gray-700"/>
                </button>
              </div>
              {/* Vertical Alignment */}
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => canAlign && alignSelection('top')}
                  disabled={!canAlign}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canAlign)}`}
                  title="Align Top"
                >
                  <ArrowUpToLine size={18} className="text-gray-700"/>
                </button>
                <button 
                  onClick={() => canAlign && alignSelection('middle')}
                  disabled={!canAlign}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canAlign)}`}
                  title="Align Middle"
                >
                  <FoldVertical size={18} className="text-gray-700"/>
                </button>
                <button 
                  onClick={() => canAlign && alignSelection('bottom')}
                  disabled={!canAlign}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canAlign)}`}
                  title="Align Bottom"
                >
                  <ArrowDownToLine size={18} className="text-gray-700"/>
                </button>
              </div>
            </div>
          </div>

          {/* Boolean Operations */}
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Pathfinder</div>
            <div className="grid grid-cols-4 gap-2">
              <button 
                onClick={() => canBoolean && performBooleanOperation('union')} 
                disabled={!canBoolean}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canBoolean)}`}
                title="Union"
              >
                <Combine size={18} className="text-gray-700"/>
              </button>
              <button 
                onClick={() => canBoolean && performBooleanOperation('subtract')}
                disabled={!canBoolean}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canBoolean)}`}
                title="Subtract"
              >
                <Minus size={18} className="text-gray-700"/>
              </button>
              <button 
                onClick={() => canBoolean && performBooleanOperation('intersect')}
                disabled={!canBoolean}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canBoolean)}`}
                title="Intersect"
              >
                <Square size={18} className="text-gray-700"/>
              </button>
              <button 
                onClick={() => canBoolean && performBooleanOperation('exclude')}
                disabled={!canBoolean}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent transition-all ${getOpacity(canBoolean)}`}
                title="Exclude"
              >
                <X size={18} className="text-gray-700"/>
              </button>
            </div>
          </div>

          {/* Grouping */}
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Grouping</div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={groupSelection} 
                disabled={!canGroup}
                className={`flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 transition-colors ${!canGroup ? 'opacity-50' : 'hover:bg-gray-50'}`}
              >
                <Layers size={14}/> Group
              </button>
              <button 
                onClick={ungroupSelection} 
                disabled={!canUngroup}
                className={`flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 transition-colors ${!canUngroup ? 'opacity-50' : 'hover:bg-gray-50'}`}
              >
                <Ungroup size={14}/> Ungroup
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}