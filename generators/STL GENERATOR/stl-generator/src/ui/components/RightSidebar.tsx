import { useCanvasSlice, useLightingSlice, useRenderingSlice } from '../store';
import { useSVGViewportSlice } from '../store';
import { ExportButton } from './ExportButton';

export function RightSidebar() {
  const canvas = useCanvasSlice((state) => state.canvas);
  const setWidth = useCanvasSlice((state) => state.setWidth);
  const setHeight = useCanvasSlice((state) => state.setHeight);
  const setPreset = useCanvasSlice((state) => state.setPreset);
  const setMargins = useCanvasSlice((state) => state.setMargins);
  const setStrokeWidth = useCanvasSlice((state) => state.setStrokeWidth);
  const toggleOrientation = useCanvasSlice((state) => state.toggleOrientation);

  const lighting = useLightingSlice((state) => state.lighting);
  const setAzimuth = useLightingSlice((state) => state.setAzimuth);
  const setElevation = useLightingSlice((state) => state.setElevation);
  const setIntensity = useLightingSlice((state) => state.setIntensity);
  const setContrast = useLightingSlice((state) => state.setContrast);

  const rendering = useRenderingSlice((state) => state.rendering);
  const setMode = useRenderingSlice((state) => state.setMode);
  const setViewMode = useRenderingSlice((state) => state.setViewMode);
  const setPerspectiveStrength = useRenderingSlice((state) => state.setPerspectiveStrength);
  
  const showGrid = useSVGViewportSlice((state) => state.showGrid);
  const setShowGrid = useSVGViewportSlice((state) => state.setShowGrid);

  return (
    <aside className="w-[280px] border-l border-border bg-background overflow-y-auto flex-shrink-0 scrollbar-thin">
      <div className="p-6 space-y-6">
        {/* Canvas Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Canvas
          </h2>
          <div className="space-y-5">
            {/* Preset */}
            <div>
              <label className="block text-xs font-medium mb-2.5 text-foreground">
                Preset
              </label>
              <select
                value={canvas.preset}
                onChange={(e) => setPreset(e.target.value as any)}
                className="w-full px-3 py-2.5 text-sm border border-border/60 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 cursor-pointer transition-all shadow-sm hover:shadow-md"
              >
                <option value="A3">A3 (420 × 297 mm)</option>
                <option value="A4">A4 (297 × 210 mm)</option>
                <option value="A5">A5 (210 × 148 mm)</option>
                <option value="A6">A6 (148 × 105 mm)</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {/* Orientation */}
            <div>
              <label className="block text-xs font-medium mb-2.5 text-foreground">
                Orientation
              </label>
              <button
                onClick={toggleOrientation}
                className="w-full px-4 py-2.5 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                {canvas.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
              </button>
            </div>

            {/* Width */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Width</span>
                <span className="text-muted-foreground font-normal">{canvas.width} mm</span>
              </label>
              <input
                type="number"
                min="20"
                max="1000"
                value={canvas.width}
                onChange={(e) => {
                  const width = parseFloat(e.target.value);
                  if (!isNaN(width) && width >= 20 && width <= 1000) {
                    setWidth(width);
                  }
                }}
                className="w-full px-3 py-2.5 text-sm border border-border/60 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm hover:shadow-md"
              />
            </div>

            {/* Height */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Height</span>
                <span className="text-muted-foreground font-normal">{canvas.height} mm</span>
              </label>
              <input
                type="number"
                min="20"
                max="1000"
                value={canvas.height}
                onChange={(e) => {
                  const height = parseFloat(e.target.value);
                  if (!isNaN(height) && height >= 20 && height <= 1000) {
                    setHeight(height);
                  }
                }}
                className="w-full px-3 py-2.5 text-sm border border-border/60 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm hover:shadow-md"
              />
            </div>

            {/* Margins */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Margins</span>
                <span className="text-muted-foreground font-normal">{canvas.margins} mm</span>
              </label>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={canvas.margins}
                onChange={(e) => setMargins(parseFloat(e.target.value))}
                className="slider w-full"
              />
            </div>

            {/* Stroke Width */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Stroke Width</span>
                <span className="text-muted-foreground font-normal">{canvas.strokeWidth.toFixed(1)} mm</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="4.0"
                step="0.1"
                value={canvas.strokeWidth}
                onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                className="slider w-full"
              />
            </div>
          </div>
        </section>

        {/* Projection Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Projection
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-2.5 text-foreground">
                View Mode
              </label>
              <select
                value={rendering.viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="w-full px-3 py-2.5 text-sm border border-border/60 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 cursor-pointer transition-all shadow-sm hover:shadow-md"
              >
                <option value="isometric">Isometric</option>
                <option value="perspective">Perspective</option>
              </select>
            </div>

            {rendering.viewMode === 'perspective' && (
              <div>
                <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                  <span>Perspective Strength</span>
                  <span className="text-muted-foreground font-normal">{rendering.perspectiveStrength.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={rendering.perspectiveStrength}
                  onChange={(e) => setPerspectiveStrength(parseFloat(e.target.value))}
                  className="slider w-full"
                />
              </div>
            )}

            <div className="h-px bg-border/60 my-3"></div>

            {/* Grid Toggle */}
            <div className="flex items-center justify-between py-1">
              <label className="text-xs font-medium text-foreground">Show 3D Grid</label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Rendering Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Rendering
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-2.5 text-foreground">
                Mode
              </label>
              <select
                value={rendering.mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-3 py-2.5 text-sm border border-border/60 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 cursor-pointer transition-all shadow-sm hover:shadow-md"
              >
                <option value="contour-only">Contour Only</option>
                <option value="contour-sharp">Contour + Sharp</option>
                <option value="wireframe">Wireframe</option>
              </select>
            </div>
          </div>
        </section>

        {/* Lighting Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Lighting
          </h2>
          <div className="space-y-5">
            {/* Azimuth */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Azimuth</span>
                <span className="text-muted-foreground font-normal">{lighting.azimuth}°</span>
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={lighting.azimuth}
                onChange={(e) => setAzimuth(parseFloat(e.target.value))}
                className="slider w-full"
              />
            </div>

            {/* Elevation */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Elevation</span>
                <span className="text-muted-foreground font-normal">{lighting.elevation}°</span>
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={lighting.elevation}
                onChange={(e) => setElevation(parseFloat(e.target.value))}
                className="slider w-full"
              />
            </div>

            {/* Intensity */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Intensity</span>
                <span className="text-muted-foreground font-normal">{lighting.intensity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={lighting.intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
                className="slider w-full"
              />
            </div>

            {/* Contrast */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Contrast</span>
                <span className="text-muted-foreground font-normal">{lighting.contrast.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={lighting.contrast}
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="slider w-full"
              />
            </div>
          </div>
        </section>

        {/* Export Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Export
          </h2>
          <ExportButton canvas={canvas} />
        </section>
      </div>
    </aside>
  );
}

