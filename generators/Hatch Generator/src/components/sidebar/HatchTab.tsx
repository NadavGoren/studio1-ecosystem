/**
 * Hatch Tab - Controls for hatching parameters (all in mm)
 */

import React from 'react';
import { useAppStore } from '../../store';

interface HatchTabProps {
  hasSelection: boolean;
}

export function HatchTab({ hasSelection }: HatchTabProps) {
  const { shapes, selectedShapeIds, hatchParams, setHatchParams, setHatchParamsSilent, pushState, commitState } = useAppStore();
  const firstShape = shapes.find(s => s.id === selectedShapeIds[0]);
  const isSliderActive = React.useRef(false);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSliderActive.current) {
        isSliderActive.current = false;
        commitState();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [commitState]);

  if (!hasSelection || !firstShape) {
    return (
      <div className="text-sm text-ink-lighter text-center py-8">
        No shape selected
      </div>
    );
  }

  // Handler to update all selected shapes
  const handleHatchUpdate = (updates: Partial<any>) => {
    selectedShapeIds.forEach(id => setHatchParams(id, updates));
  };

  const handleHatchUpdateSilent = (updates: Partial<any>) => {
    selectedShapeIds.forEach(id => setHatchParamsSilent(id, updates));
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
      commitState();
    }
  };

  // Helper function to snap angle values to common angles (45, 90, 180, 270)
  const snapAngle = (value: number, snapPoints: number[] = [45, 90, 180, 270]): number => {
    const threshold = 5; // Snap if within 5 degrees
    const normalizedVal = ((value % 360) + 360) % 360; // Normalize to 0-360
    
    let nearestSnapPoint = normalizedVal;
    let minDistance = Infinity;
    
    for (const point of snapPoints) {
      const normalizedPoint = ((point % 360) + 360) % 360;
      // Check both direct distance and wrapped distance (e.g., 359 to 0)
      const dist1 = Math.abs(normalizedVal - normalizedPoint);
      const dist2 = 360 - dist1;
      const distance = Math.min(dist1, dist2);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestSnapPoint = normalizedPoint;
      }
    }
    
    // If we're close enough to a snap point, return it; otherwise return original value
    return minDistance <= threshold ? nearestSnapPoint : value;
  };

  const params = hatchParams[firstShape.id] || {
    enabled: false,
    density: 2,
    angle: 45,
    offset: 0,
    originX: firstShape.x,
    originY: firstShape.y,
    gradientEnabled: false,
    gradientStart: 2,
    gradientEnd: 5,
    gradientAngle: 90,
    crossHatchEnabled: false,
    crossHatchAngle: 135,
    zigZagEnabled: false,
    spaceMode: 'local',
    renderOutline: false,
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={params.enabled}
          onChange={(e) => handleHatchUpdate({ enabled: e.target.checked })}
          className="w-4 h-4"
        />
        Enable Hatching
      </label>

      {params.enabled && (
        <>
          <div className="space-y-3 pt-2">
            <label className="block text-sm text-ink">
              Density (mm spacing)
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.1"
                value={params.density}
                onMouseDown={handleSliderStart}
                onChange={(e) =>
                  handleHatchUpdateSilent({ density: parseFloat(e.target.value) })
                }
                onMouseUp={handleSliderEnd}
                className="w-full mt-1"
              />
              <div className="text-xs text-ink-lighter font-mono mt-1">
                {params.density.toFixed(2)} mm
              </div>
            </label>

            <label className="block text-sm text-ink">
              <div className="flex justify-between items-center mb-1">
                <span>Angle (°)</span>
                <input
                  type="number"
                  min="0"
                  max="360"
                  step="0.1"
                  value={params.angle}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 360) {
                      handleHatchUpdate({ angle: val });
                    }
                  }}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-ink font-mono text-right"
                />
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={params.angle}
                onMouseDown={handleSliderStart}
                onChange={(e) => {
                  const rawValue = parseFloat(e.target.value);
                  const snappedValue = snapAngle(rawValue, [45, 90, 180, 270]);
                  handleHatchUpdateSilent({ angle: snappedValue });
                }}
                onMouseUp={handleSliderEnd}
                className="w-full mt-1"
              />
              <div className="text-xs text-ink-lighter font-mono mt-1">
                {params.angle.toFixed(1)}°
              </div>
            </label>

            <label className="block text-sm text-ink">
              Offset (mm)
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={params.offset}
                onMouseDown={handleSliderStart}
                onChange={(e) =>
                  handleHatchUpdateSilent({ offset: parseFloat(e.target.value) })
                }
                onMouseUp={handleSliderEnd}
                className="w-full mt-1"
              />
              <div className="text-xs text-ink-lighter font-mono mt-1">
                {params.offset >= 0 ? '+' : ''}{params.offset.toFixed(2)} mm
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide">
              Advanced
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={params.crossHatchEnabled}
                onChange={(e) =>
                  handleHatchUpdate({ crossHatchEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              Cross-Hatch
            </label>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={params.zigZagEnabled}
                onChange={(e) =>
                  handleHatchUpdate({ zigZagEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              Zig-Zag Path
            </label>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={params.renderOutline ?? false}
                onChange={(e) =>
                  handleHatchUpdate({ renderOutline: e.target.checked })
                }
                className="w-4 h-4"
              />
              Show Outline
            </label>

            <label className="block text-sm text-ink">
              Space Mode
              <select
                value={params.spaceMode}
                onChange={(e) =>
                  handleHatchUpdate({
                    spaceMode: e.target.value as 'local' | 'world',
                  })
                }
                className="w-full mt-1 px-2 py-1 border border-border rounded font-mono text-sm"
              >
                <option value="local">Local (rotates with shape)</option>
                <option value="world">World (static mask)</option>
              </select>
            </label>

            <div className="text-xs font-mono font-semibold text-ink-light uppercase tracking-wide pt-2">
              Gradient
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={params.gradientEnabled}
                onChange={(e) =>
                  handleHatchUpdate({ gradientEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              Enable Density Gradient
            </label>

            {params.gradientEnabled && (
              <div className="pl-4 space-y-2 border-l-2 border-border ml-1">
                <label className="block text-sm text-ink">
                  Start Density (mm)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.gradientStart}
                    onChange={(e) =>
                      handleHatchUpdate({ gradientStart: parseFloat(e.target.value) })
                    }
                    className="w-full mt-1 px-2 py-1 border rounded font-mono text-sm"
                  />
                </label>
                <label className="block text-sm text-ink">
                  End Density (mm)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.gradientEnd}
                    onChange={(e) =>
                      handleHatchUpdate({ gradientEnd: parseFloat(e.target.value) })
                    }
                    className="w-full mt-1 px-2 py-1 border rounded font-mono text-sm"
                  />
                </label>
                <label className="block text-sm text-ink">
                  <div className="flex justify-between items-center mb-1">
                    <span>Gradient Angle (°)</span>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      step="0.1"
                      value={params.gradientAngle ?? 90}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0 && val <= 360) {
                          handleHatchUpdate({ gradientAngle: val });
                        }
                      }}
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-ink font-mono text-right"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={params.gradientAngle ?? 90}
                    onMouseDown={handleSliderStart}
                    onChange={(e) => {
                      const rawValue = parseFloat(e.target.value);
                      const snappedValue = snapAngle(rawValue, [45, 90, 180, 270]);
                      handleHatchUpdateSilent({ gradientAngle: snappedValue });
                    }}
                    onMouseUp={handleSliderEnd}
                    className="w-full mt-1"
                  />
                  <div className="text-xs text-ink-lighter font-mono mt-1">
                    {(params.gradientAngle ?? 90).toFixed(1)}°
                  </div>
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}









