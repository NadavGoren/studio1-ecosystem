import React from 'react';
import { useAppStore } from '../store';
import { Section, Label, Input, Slider, Switch } from './ui/DesignSystem';
import { getShapeBounds, rotateShapeAroundCentroid } from '../lib/geometry';
import { 
  Copy, Trash2
} from 'lucide-react';

export function RightPanel() {
  const store = useAppStore();
  const { 
    selectedShapeIds, shapes, hatchParams, paper, 
    setPaperSize, setPaperMargin, updateShape, setHatchParams, setHatchParamsSilent,
    duplicateSelection, deleteShapes, snapping, pushState, commitState
  } = store;

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

  const setSnapping = (updates: Partial<typeof snapping>) => {
    pushState();
    useAppStore.setState((prev) => ({ 
      snapping: { ...prev.snapping, ...updates } 
    }));
    commitState();
  };

  const handleUpdate = (updates: any) => { 
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

  const handleUpdateSilent = (updates: any) => {
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

  const handleHatchUpdate = (updates: any) => { 
    selectedShapeIds.forEach(id => setHatchParams(id, updates)); 
  };

  const handleHatchUpdateSilent = (updates: any) => { 
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

  const hasSelection = selectedShapeIds.length > 0;
  const isMultiple = selectedShapeIds.length > 1;
  const firstShapeId = selectedShapeIds[0];
  const firstShape = shapes.find(s => s.id === firstShapeId);
  const commonHatch = firstShapeId ? hatchParams[firstShapeId] : null;

  if (!hasSelection) {
    return (
      <div className="w-72 flex flex-col border-l border-gray-200 bg-white h-full z-20 shadow-sm overflow-y-auto">
        <div className="h-12 flex items-center px-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Canvas Settings</h2>
        </div>

        {/* SNAPPING */}
        <Section title="Snapping" defaultOpen={false}>
           <div className="space-y-3">
             <Switch label="Snap to Centers" checked={snapping.centers} onChange={(v) => setSnapping({ centers: v })} />
             <Switch label="Snap to Bounds" checked={snapping.bounds} onChange={(v) => setSnapping({ bounds: v })} />
           </div>
        </Section>

        <Section title="Paper Size" defaultOpen={false}>
          <div className="mb-3">
            <Label>Template</Label>
            <div className="flex gap-2">
              <select 
                value={paper.preset} 
                onChange={(e) => store.setPaperPreset(e.target.value as any)}
                className="flex-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              >
                <option value="A5">A5</option>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Custom">Custom</option>
              </select>
              <button 
                onClick={() => store.setPaperOrientation(paper.orientation === 'portrait' ? 'landscape' : 'portrait')}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-xs font-medium"
              >
                {paper.orientation === 'portrait' ? 'Port' : 'Land'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div><Label>Width (mm)</Label><Input type="number" value={paper.width} onChange={(e) => setPaperSize(Number(e.target.value), paper.height)} /></div>
            <div><Label>Height (mm)</Label><Input type="number" value={paper.height} onChange={(e) => setPaperSize(paper.width, Number(e.target.value))} /></div>
          </div>
          <div className="mb-2 mt-4">
            <Slider label="Margin" min={0} max={50} step={1} value={paper.margin} onChange={(v) => {
              if (isSliderActive.current) {
                useAppStore.setState((prev: any) => ({ 
                  paper: { ...prev.paper, margin: v } 
                }));
              } else {
                setPaperMargin(v);
              }
            }} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <Switch 
              label="Show Margins" 
              checked={store.showMargins} 
              onChange={(v) => store.setShowMargins(v)} 
            />
          </div>
        </Section>

        <Section title="Global Appearance" defaultOpen={false}>
           <Slider label="Master Stroke" min={0.1} max={5} step={0.1} value={paper.globalStrokeWidth} onChange={(v) => {
             if (isSliderActive.current) {
               useAppStore.setState((prev: any) => ({ 
                 paper: { ...prev.paper, globalStrokeWidth: v } 
               }));
             } else {
               store.setPaper({ globalStrokeWidth: v });
             }
           }} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
           <div className="mt-4 pt-4 border-t border-gray-200">
             <Label>Canvas Color</Label>
             <div className="flex gap-2 items-center mt-2">
               <input 
                 type="color" 
                 value={paper.canvasColor} 
                 onChange={(e) => store.setPaper({ canvasColor: e.target.value })} 
                 className="w-10 h-10 rounded border border-gray-300 cursor-pointer" 
               />
               <Input 
                 type="text" 
                 value={paper.canvasColor} 
                 onChange={(e) => store.setPaper({ canvasColor: e.target.value })} 
                 className="flex-1" 
               />
             </div>
           </div>
           <div className="mt-4 pt-4 border-t border-gray-200">
             <Switch 
               label="Override All Colors" 
               checked={paper.globalColorOverride} 
               onChange={(v) => store.setPaper({ globalColorOverride: v })} 
             />
             {paper.globalColorOverride && (
               <div className="mt-3">
                 <Label>Override Color</Label>
                 <div className="flex gap-2 items-center">
                   <input 
                     type="color" 
                     value={paper.globalColor} 
                     onChange={(e) => store.setPaper({ globalColor: e.target.value })} 
                     className="w-10 h-10 rounded border border-gray-300 cursor-pointer" 
                   />
                   <Input 
                     type="text" 
                     value={paper.globalColor} 
                     onChange={(e) => store.setPaper({ globalColor: e.target.value })} 
                     className="flex-1" 
                   />
                 </div>
               </div>
             )}
           </div>
        </Section>
      </div>
    );
  }

  const getDisplayDimensions = () => {
    if (!firstShape) return { width: 0, height: 0 };
    if (firstShape.type === 'rectangle' || firstShape.type === 'group') {
      return { width: (firstShape as any).width || 0, height: (firstShape as any).height || 0 };
    }
    if (firstShape.type === 'ellipse') {
      const ellipse = firstShape as any;
      return { width: (ellipse.radiusX || 0) * 2, height: (ellipse.radiusY || 0) * 2 };
    }
    const bounds = getShapeBounds(firstShape, shapes);
    return { width: bounds.width, height: bounds.height };
  };

  const displayDims = getDisplayDimensions();
  const displayName = isMultiple 
    ? `${selectedShapeIds.length} Items Selected` 
    : (firstShape?.name || (firstShape?.type ? firstShape.type.charAt(0).toUpperCase() + firstShape.type.slice(1) : 'Shape'));

  return (
    <div className="w-72 flex flex-col border-l border-gray-200 bg-white h-full z-20 shadow-sm overflow-y-auto pb-20">
      <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100 bg-blue-50/30">
        <h2 className="text-xs font-bold text-blue-800 uppercase tracking-wider truncate max-w-[160px]" title={displayName}>{displayName}</h2>
        <div className="flex gap-1">
           <button onClick={() => duplicateSelection()} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded" title="Duplicate"><Copy size={14}/></button>
           <button onClick={() => deleteShapes(selectedShapeIds)} className="p-1.5 hover:bg-red-100 text-red-600 rounded" title="Delete"><Trash2 size={14}/></button>
        </div>
      </div>

      <Section title="Transform" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><Label>X Position</Label><Input type="number" value={Math.round(firstShape?.x || 0)} onChange={(e) => handleUpdate({ x: Number(e.target.value) })} /></div>
          <div><Label>Y Position</Label><Input type="number" value={Math.round(firstShape?.y || 0)} onChange={(e) => handleUpdate({ y: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><Label>Width</Label><Input type="number" value={Math.round(displayDims.width)} onChange={(e) => {
            const newWidth = Number(e.target.value);
            if (firstShape?.type === 'rectangle' || firstShape?.type === 'group') handleUpdate({ width: newWidth });
            else if (firstShape?.type === 'ellipse') handleUpdate({ radiusX: newWidth / 2 });
          }} /></div>
          <div><Label>Height</Label><Input type="number" value={Math.round(displayDims.height)} onChange={(e) => {
            const newHeight = Number(e.target.value);
            if (firstShape?.type === 'rectangle' || firstShape?.type === 'group') handleUpdate({ height: newHeight });
            else if (firstShape?.type === 'ellipse') handleUpdate({ radiusY: newHeight / 2 });
          }} /></div>
        </div>
        <div className="mb-2">
           <Slider label="Rotation" min={0} max={360} step={1} value={firstShape?.rotation || 0} onChange={(v) => isSliderActive.current ? handleUpdateSilent({ rotation: v }) : handleUpdate({ rotation: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="°" snapPoints={[45, 90, 180, 270]} />
        </div>
        {(firstShape?.type === 'rectangle' || firstShape?.type === 'polygon' || firstShape?.type === 'polyline') && (
           <div className="mt-4 pt-4 border-t border-gray-100">
             <Slider label="Corner Radius" min={0} max={50} step={1} value={(firstShape as any).cornerRadius || 0} onChange={(v) => isSliderActive.current ? handleUpdateSilent({ cornerRadius: v }) : handleUpdate({ cornerRadius: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
           </div>
        )}
        {firstShape?.type === 'polygon' && (
           <div className="mt-2"><Slider label="Sides" min={3} max={12} step={1} value={(firstShape as any).sides || 6} onChange={(v) => isSliderActive.current ? handleUpdateSilent({ sides: v }) : handleUpdate({ sides: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} /></div>
        )}
      </Section>

      <Section title="Appearance" defaultOpen={false}>
        <div className="mb-3">
          <Label>Stroke Color</Label>
          <div className="flex gap-2">
            <input type="color" value={firstShape?.color || '#000000'} onChange={(e) => handleUpdate({ color: e.target.value })} className="w-8 h-8 rounded border-0 cursor-pointer" />
            <Input type="text" value={firstShape?.color || '#000000'} onChange={(e) => handleUpdate({ color: e.target.value })} className="flex-1" />
          </div>
        </div>
        {commonHatch && (
           <Switch label="Show Outline" checked={commonHatch.renderOutline} onChange={(v) => handleHatchUpdate({ renderOutline: v })} />
        )}
      </Section>

      {commonHatch && (
        <Section title="Hatching" defaultOpen={false} extra={<Switch label="" checked={commonHatch.enabled} onChange={(v) => handleHatchUpdate({ enabled: v })} />}>
          <div className={`flex flex-col gap-4 ${!commonHatch.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <Slider label="Density" min={0.5} max={20} step={0.5} value={commonHatch.density} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ density: v }) : handleHatchUpdate({ density: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
            <div className="flex flex-col gap-1.5 w-full mb-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Angle</span>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min={0} 
                    max={180} 
                    step={0.1}
                    value={commonHatch.angle} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= 180) {
                        handleHatchUpdate({ angle: val });
                      }
                    }}
                    className="w-16 text-right"
                  />
                  <span className="text-xs font-mono font-bold text-gray-900">°</span>
                </div>
              </div>
              <Slider label="" min={0} max={180} step={1} value={commonHatch.angle} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ angle: v }) : handleHatchUpdate({ angle: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="°" snapPoints={[45, 90, 180]} />
            </div>
            <Slider label="Offset" min={0} max={50} step={1} value={commonHatch.offset} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ offset: v }) : handleHatchUpdate({ offset: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
            
            <div className="pt-2 border-t border-gray-200 mt-2">
              <Label className="mt-2">Crosshatch</Label>
              <Switch label="Enable Crosshatch" checked={commonHatch.crossHatchEnabled} onChange={(v) => handleHatchUpdate({ crossHatchEnabled: v })} />
              {commonHatch.crossHatchEnabled && (
                 <div className="mt-2 pl-2 border-l-2 border-gray-200">
                    <Switch label="Perpendicular (90°)" checked={commonHatch.crossHatchPerpendicular} onChange={(v) => handleHatchUpdate({ crossHatchPerpendicular: v })} />
                    {!commonHatch.crossHatchPerpendicular && (
                      <div className="flex flex-col gap-1.5 w-full mb-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Cross Angle</span>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              min={0} 
                              max={180} 
                              step={0.1}
                              value={commonHatch.crossHatchAngle} 
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0 && val <= 180) {
                                  handleHatchUpdate({ crossHatchAngle: val });
                                }
                              }}
                              className="w-16 text-right"
                            />
                            <span className="text-xs font-mono font-bold text-gray-900">°</span>
                          </div>
                        </div>
                        <Slider label="" min={0} max={180} step={1} value={commonHatch.crossHatchAngle} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ crossHatchAngle: v }) : handleHatchUpdate({ crossHatchAngle: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="°" snapPoints={[45, 90, 180]} />
                      </div>
                    )}
                 </div>
              )}
            </div>

            {/* FIX: Restored Gradient Hatching */}
            <div className="pt-2 border-t border-gray-200 mt-2">
               <Label className="mt-2">Gradient</Label>
               <Switch label="Enable Gradient" checked={commonHatch.gradientEnabled} onChange={(v) => handleHatchUpdate({ gradientEnabled: v })} />
               {commonHatch.gradientEnabled && (
                  <div className="mt-2 pl-2 border-l-2 border-gray-200 space-y-3">
                     <Slider label="Start Density" min={0.1} max={10} step={0.1} value={commonHatch.gradientStart} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ gradientStart: v }) : handleHatchUpdate({ gradientStart: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
                     <Slider label="End Density" min={0.1} max={10} step={0.1} value={commonHatch.gradientEnd} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ gradientEnd: v }) : handleHatchUpdate({ gradientEnd: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="mm" />
                     <Slider label="Gradient Angle" min={0} max={360} step={1} value={commonHatch.gradientAngle ?? 90} onChange={(v) => isSliderActive.current ? handleHatchUpdateSilent({ gradientAngle: v }) : handleHatchUpdate({ gradientAngle: v })} onMouseDown={handleSliderStart} onMouseUp={handleSliderEnd} suffix="°" snapPoints={[45, 90, 180, 270]} />
                  </div>
               )}
            </div>
            
            <div className="pt-2 border-t border-gray-200 mt-2">
               <Label className="mt-2">Effects</Label>
               <Switch label="Zig-Zag Connect" checked={commonHatch.zigZagEnabled} onChange={(v) => handleHatchUpdate({ zigZagEnabled: v })} />
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}