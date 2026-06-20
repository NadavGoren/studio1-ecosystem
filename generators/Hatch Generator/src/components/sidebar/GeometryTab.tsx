/**
 * Geometry Tab - Numeric inputs for shape properties (all in mm)
 */

import React from 'react';
import { useAppStore } from '../../store';
import { rotateShapeAroundCentroid } from '../../lib/geometry';
import { PAPER_PRESETS, type PaperPreset } from '../../types';

interface GeometryTabProps {
  hasSelection: boolean;
}

export function GeometryTab({ hasSelection }: GeometryTabProps) {
  const { 
    shapes, selectedShapeIds, updateShape, 
    paper, setPaper, setPaperPreset, setPaperOrientation, setPaperMargin, setPaperSize,
    pushState, commitState, snapping
  } = useAppStore();
  
  const isSliderActive = React.useRef(false);
  const paperMarginSliderValue = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSliderActive.current) {
        isSliderActive.current = false;
        paperMarginSliderValue.current = null;
        commitState();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [commitState]);
  
  const setSnapping = (newSnap: any) => {
    pushState();
    useAppStore.setState(prev => ({ snapping: { ...prev.snapping, ...newSnap } }));
    commitState();
  };
  
  // --- PAPER SETTINGS (No Selection) ---
  if (!hasSelection) {
    return (
      <div className="space-y-6">
        <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide border-b border-border pb-2">
          Paper Settings
        </div>

        {/* Preset Selector */}
        <label className="block text-sm text-ink">
          Size
          <select 
            value={paper.preset}
            onChange={(e) => setPaperPreset(e.target.value as PaperPreset)}
            className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm bg-white"
          >
            <option value="A5">A5</option>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="A2">A2</option>
            <option value="Custom">Custom</option>
          </select>
        </label>

        {/* Custom Dimensions (Only show if Custom) */}
        {paper.preset === 'Custom' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-ink">
              Width (mm)
              <input
                type="number"
                value={paper.width}
                onChange={(e) => setPaperSize(parseFloat(e.target.value) || 10, paper.height)}
                className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
              />
            </label>
            <label className="block text-sm text-ink">
              Height (mm)
              <input
                type="number"
                value={paper.height}
                onChange={(e) => setPaperSize(paper.width, parseFloat(e.target.value) || 10)}
                className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
              />
            </label>
          </div>
        )}

        {/* Orientation */}
        <div className="space-y-2">
          <label className="text-sm text-ink block">Orientation</label>
          <div className="flex border border-border rounded overflow-hidden">
            <button
              onClick={() => setPaperOrientation('portrait')}
              className={`flex-1 py-1 text-xs font-mono ${paper.orientation === 'portrait' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-50'}`}
            >
              Portrait
            </button>
            <button
              onClick={() => setPaperOrientation('landscape')}
              className={`flex-1 py-1 text-xs font-mono ${paper.orientation === 'landscape' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-50'}`}
            >
              Landscape
            </button>
          </div>
        </div>

        {/* Margin Slider */}
        <label className="block text-sm text-ink">
          Safe Margin ({paper.margin}mm)
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={paperMarginSliderValue.current !== null ? paperMarginSliderValue.current : paper.margin}
            onMouseDown={handleSliderStart}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (isSliderActive.current) {
                paperMarginSliderValue.current = value;
                // Update paper state directly without pushing history
                useAppStore.setState((prev: any) => ({ 
                  paper: { ...prev.paper, margin: value } 
                }));
              }
            }}
            onMouseUp={handleSliderEnd}
            className="w-full mt-2"
          />
        </label>
        
        <div className="text-xs text-ink-lighter pt-4">
          Canvas: {paper.width} x {paper.height} mm
        </div>
      </div>
    );
  }

  const firstShape = shapes.find(s => s.id === selectedShapeIds[0]);
  
  if (!firstShape) {
    return null; 
  }

  const handleUpdate = (updates: Partial<any>) => {
    pushState();
    selectedShapeIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (shape) {
        // Special handling for rotation: rotate around centroid
        if ('rotation' in updates && updates.rotation !== undefined) {
          const rotationUpdates = rotateShapeAroundCentroid(shape, updates.rotation, shapes);
          updateShape(id, rotationUpdates);
        } else {
          updateShape(id, updates);
        }
      }
    });
    commitState(); // Commit state after immediate property changes
  };

  const handleUpdateSilent = (updates: Partial<any>) => {
    selectedShapeIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (shape) {
        // Special handling for rotation: rotate around centroid
        if ('rotation' in updates && updates.rotation !== undefined) {
          const rotationUpdates = rotateShapeAroundCentroid(shape, updates.rotation, shapes);
          updateShape(id, rotationUpdates);
        } else {
          updateShape(id, updates);
        }
      }
    });
  };

  const handleSliderStart = () => {
    if (!isSliderActive.current) {
      isSliderActive.current = true;
      pushState();
    }
  };

  const handleSliderEnd = () => {
    if (isSliderActive.current) {
      isSliderActive.current = false;
      // State is already updated during onChange, just commit it
      paperMarginSliderValue.current = null;
      commitState();
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide mb-4">
        Position (mm)
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm text-ink">
          X (mm)
          <input
            type="number"
            step="0.1"
            value={firstShape.x.toFixed(2)}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleUpdate({ x: value });
            }}
            className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
          />
        </label>

        <label className="block text-sm text-ink">
          Y (mm)
          <input
            type="number"
            step="0.1"
            value={firstShape.y.toFixed(2)}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleUpdate({ y: value });
            }}
            className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
          />
        </label>

        <label className="block text-sm text-ink">
          Rotation (°)
          <input
            type="number"
            step="1"
            value={firstShape.rotation.toFixed(1)}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleUpdate({ rotation: value % 360 });
            }}
            className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
          />
        </label>
      </div>

      {firstShape.type === 'rectangle' && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide">
            Dimensions (mm)
          </div>
          <label className="block text-sm text-ink">
            Width (mm)
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={firstShape.width.toFixed(2)}
              onChange={(e) => {
                const value = Math.max(0.1, parseFloat(e.target.value) || 0);
                handleUpdate({ width: value });
              }}
              className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-ink">
            Height (mm)
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={firstShape.height.toFixed(2)}
              onChange={(e) => {
                const value = Math.max(0.1, parseFloat(e.target.value) || 0);
                handleUpdate({ height: value });
              }}
              className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-ink">
            Corner Radius (mm)
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={Math.min(firstShape.width, firstShape.height) / 2}
                step="0.5"
                value={firstShape.cornerRadius || 0}
                onMouseDown={handleSliderStart}
                onChange={(e) => handleUpdateSilent({ cornerRadius: parseFloat(e.target.value) })}
                onMouseUp={handleSliderEnd}
                className="flex-1"
              />
              <span className="text-xs font-mono w-10 text-right">
                {(firstShape.cornerRadius || 0).toFixed(1)}
              </span>
            </div>
          </label>
        </div>
      )}

      {firstShape.type === 'ellipse' && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide">
            Radius (mm)
          </div>
          <label className="block text-sm text-ink">
            Radius X (mm)
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={firstShape.radiusX.toFixed(2)}
              onChange={(e) => {
                const value = Math.max(0.1, parseFloat(e.target.value) || 0);
                handleUpdate({ radiusX: value });
              }}
              className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-ink">
            Radius Y (mm)
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={firstShape.radiusY.toFixed(2)}
              onChange={(e) => {
                const value = Math.max(0.1, parseFloat(e.target.value) || 0);
                handleUpdate({ radiusY: value });
              }}
              className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
            />
          </label>
        </div>
      )}

      {firstShape.type === 'polygon' && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide">
            Properties
          </div>
          <label className="block text-sm text-ink">
            Radius (mm)
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={firstShape.radius.toFixed(2)}
              onChange={(e) => {
                const value = Math.max(0.1, parseFloat(e.target.value) || 0);
                handleUpdate({ radius: value });
              }}
              className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-ink">
            Sides
            <input
              type="number"
              step="1"
              min="3"
              value={firstShape.sides}
              onChange={(e) => {
                const value = Math.max(3, parseInt(e.target.value) || 3);
                handleUpdate({ sides: value });
              }}
              className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-ink">
            Corner Radius (mm)
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={firstShape.radius / 2}
                step="0.5"
                value={firstShape.cornerRadius || 0}
                onMouseDown={handleSliderStart}
                onChange={(e) => handleUpdateSilent({ cornerRadius: parseFloat(e.target.value) })}
                onMouseUp={handleSliderEnd}
                className="flex-1"
              />
              <span className="text-xs font-mono w-10 text-right">
                {(firstShape.cornerRadius || 0).toFixed(1)}
              </span>
            </div>
          </label>
        </div>
      )}

      {/* Grid Settings are hidden (as requested) but snapping toggles remain */}
      <div className="mt-4 border-t border-border pt-4 space-y-2">
        <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide">
          Snapping
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Snap to Grid removed from UI, but logic persists in backend unless disabled in defaults */}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={snapping.centers} onChange={e => setSnapping({ centers: e.target.checked })} />
            Centers
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={snapping.bounds} onChange={e => setSnapping({ bounds: e.target.checked })} />
            Bounds
          </label>
        </div>
      </div>
    </div>
  );
}