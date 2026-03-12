import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import { 
  Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, 
  Circle, Square, Hexagon, Minus, Folder 
} from 'lucide-react';
import type { Shape } from '../../types';

interface LayersTabProps {
  hideHeader?: boolean;
}

// Bundle props to avoid prop-drilling hell
interface LayerContext {
  expandedGroups: Set<string>;
  toggleGroup: (e: React.MouseEvent, id: string) => void;
  editingId: string | null;
  editValue: string;
  setEditValue: (val: string) => void;
  saveRename: () => void;
  startEditing: (shape: Shape) => void;
  cancelEditing: () => void;
  editInputRef: React.RefObject<HTMLInputElement>;
  draggedId: string | null;
  dropTarget: { id: string; pos: 'before' | 'after' | 'inside' } | null;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent, id: string, isGroup: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  tree: { shapeMap: Map<string, Shape> };
}

// --- EXTRACTED COMPONENT (Fixes Focus Loss) ---
const LayerItem = ({ shape, depth = 0, ctx }: { shape: Shape, depth?: number, ctx: LayerContext }) => {
  const { selectedShapeIds, toggleSelection, selectShape, updateShape } = useAppStore();
  const pushState = useAppStore(s => s.pushState);
  
  const isSelected = selectedShapeIds.includes(shape.id);
  const isGroup = shape.type === 'group';
  const isExpanded = ctx.expandedGroups.has(shape.id);
  const isEditing = ctx.editingId === shape.id;

  let Icon = Square;
  if (shape.type === 'ellipse') Icon = Circle;
  if (shape.type === 'polygon') Icon = Hexagon;
  if (shape.type === 'line' || shape.type === 'polyline') Icon = Minus;
  if (shape.type === 'group') Icon = Folder;

  let children: Shape[] = [];
  if (isGroup && (shape as any).childrenIds) {
    children = (shape as any).childrenIds
      .map((id: string) => ctx.tree.shapeMap.get(id))
      .filter(Boolean)
      .reverse();
  }

  return (
    <div 
      onDragOver={(e) => ctx.handleDragOver(e, shape.id, isGroup)} 
      onDragLeave={() => { /* Optional: debounce clear */ }} 
      onDrop={ctx.handleDrop}
    >
      <div 
        className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer border-b border-gray-100 text-sm select-none transition-colors
          ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
          ${ctx.dropTarget?.id === shape.id ? (ctx.dropTarget.pos === 'inside' ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ctx.dropTarget.pos === 'before' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500') : ''}
          ${ctx.draggedId === shape.id ? 'opacity-50' : 'opacity-100'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={(e) => {
           e.stopPropagation();
           if (!isEditing) {
             if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelection(shape.id);
             else selectShape(shape.id);
           }
        }}
        onDoubleClick={(e) => {
           e.stopPropagation();
           e.preventDefault();
           ctx.startEditing(shape);
        }}
        draggable={!isEditing}
        onDragStart={(e) => ctx.handleDragStart(e, shape.id)}
      >
        <div className="w-4 h-4 flex items-center justify-center shrink-0 hover:bg-black/5 rounded" onClick={(e) => isGroup && ctx.toggleGroup(e, shape.id)}>
          {isGroup && (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </div>

        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
           <div className="absolute w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: shape.color, right: -1, bottom: -1 }} />
           <Icon size={14} className={isSelected ? 'text-blue-600' : 'text-gray-400'} />
        </div>

        {/* RENAME INPUT */}
        {isEditing ? (
          <input 
            ref={ctx.editInputRef}
            value={ctx.editValue}
            onChange={(e) => ctx.setEditValue(e.target.value)}
            onBlur={ctx.saveRename}
            onKeyDown={(e) => { 
              e.stopPropagation(); 
              if (e.key === 'Enter') ctx.saveRename();
              if (e.key === 'Escape') ctx.cancelEditing();
            }}
            onMouseDown={(e) => e.stopPropagation()} 
            onClick={(e) => e.stopPropagation()} 
            className="flex-1 bg-white border border-blue-400 rounded px-1 py-0.5 text-xs text-black min-w-0 select-text cursor-text shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        ) : (
          <span className="flex-1 truncate font-medium">
            {shape.name || (isGroup ? 'Group' : shape.type.charAt(0).toUpperCase() + shape.type.slice(1))}
          </span>
        )}

        {!isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { 
              e.stopPropagation(); 
              pushState(); 
              updateShape(shape.id, { visible: !shape.visible }); 
              commitState(); 
            }} className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-black">
              {shape.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button onClick={(e) => { 
              e.stopPropagation(); 
              pushState(); 
              updateShape(shape.id, { locked: !shape.locked }); 
              commitState(); 
            }} className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-black">
              {shape.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        )}
      </div>
      {isGroup && isExpanded && children.map(c => <LayerItem key={c.id} shape={c} depth={depth + 1} ctx={ctx} />)}
    </div>
  );
};

export function LayersTab({ hideHeader = false }: LayersTabProps) {
  const { shapes, updateShape, reorderShape, pushState, commitState } = useAppStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string, pos: 'before' | 'after' | 'inside' } | null>(null);
  
  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const toggleGroup = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(expandedGroups);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedGroups(next);
  };

  const tree = useMemo(() => {
    const shapeMap = new Map(shapes.map(s => [s.id, s]));
    const roots = shapes.slice().reverse().filter(s => !s.groupId || !shapeMap.has(s.groupId));
    return { roots, shapeMap };
  }, [shapes]);

  const startEditing = (shape: Shape) => {
    if (!shape.id) { setEditingId(null); return; } // Cancel logic
    setEditingId(shape.id);
    setEditValue(shape.name || shape.type);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveRename = () => {
    if (editingId && editValue.trim()) {
      pushState();
      updateShape(editingId, { name: editValue.trim() });
      commitState();
    }
    setEditingId(null);
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (editingId) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string, isGroup: boolean) => {
    e.preventDefault();
    if (draggedId === id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (isGroup && y > h * 0.25 && y < h * 0.75) setDropTarget({ id, pos: 'inside' });
    else if (y < h * 0.5) setDropTarget({ id, pos: 'before' });
    else setDropTarget({ id, pos: 'after' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedId && dropTarget) reorderShape(draggedId, dropTarget.id, dropTarget.pos);
    setDraggedId(null);
    setDropTarget(null);
  };

  // Context bundle
  const ctx: LayerContext = {
    expandedGroups, toggleGroup, editingId, editValue, setEditValue, saveRename, startEditing, cancelEditing,
    editInputRef, draggedId, dropTarget, handleDragStart, handleDragOver, handleDrop, tree
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {!hideHeader && <div className="p-3 border-b border-gray-200"><h3 className="text-xs font-bold text-gray-500 uppercase">Layers</h3></div>}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tree.roots.length === 0 ? <div className="p-4 text-xs text-gray-400 text-center italic">No layers</div> : tree.roots.map(s => <LayerItem key={s.id} shape={s} ctx={ctx} />)}
      </div>
    </div>
  );
}







