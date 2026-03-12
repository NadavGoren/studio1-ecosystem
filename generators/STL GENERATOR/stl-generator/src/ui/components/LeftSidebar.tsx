import { useTransformSlice } from '../store';
import { CoordinateSystem } from '../../core/types';

export function LeftSidebar() {
  const transform = useTransformSlice((state) => state.transform);
  const setRotation = useTransformSlice((state) => state.setRotation);
  const setTranslation = useTransformSlice((state) => state.setTranslation);
  const setFlipX = useTransformSlice((state) => state.setFlipX);
  const setFlipY = useTransformSlice((state) => state.setFlipY);
  const setFlipZ = useTransformSlice((state) => state.setFlipZ);
  const setFaceOrientation = useTransformSlice((state) => state.setFaceOrientation);
  const setCoordinateSystem = useTransformSlice((state) => state.setCoordinateSystem);
  const resetTransform = useTransformSlice((state) => state.resetTransform);
  const resetOrientation = useTransformSlice((state) => state.resetOrientation);

  return (
    <aside className="w-[280px] border-r border-border bg-background overflow-y-auto flex-shrink-0 scrollbar-thin">
      <div className="p-6 space-y-6">
        {/* Transform Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Transform
          </h2>
          <div className="space-y-5">
            {/* Rotation X */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Rotation X</span>
                <span className="text-muted-foreground font-normal">{transform.rotation.x.toFixed(1)}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={transform.rotation.x}
                onChange={(e) => setRotation({ ...transform.rotation, x: parseFloat(e.target.value) })}
                className="slider w-full"
              />
            </div>

            {/* Rotation Y */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Rotation Y</span>
                <span className="text-muted-foreground font-normal">{transform.rotation.y.toFixed(1)}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={transform.rotation.y}
                onChange={(e) => setRotation({ ...transform.rotation, y: parseFloat(e.target.value) })}
                className="slider w-full"
              />
            </div>

            {/* Rotation Z */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Rotation Z</span>
                <span className="text-muted-foreground font-normal">{transform.rotation.z.toFixed(1)}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={transform.rotation.z}
                onChange={(e) => setRotation({ ...transform.rotation, z: parseFloat(e.target.value) })}
                className="slider w-full"
              />
            </div>

            <div className="h-px bg-border/60 my-3"></div>

            {/* Translation X */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Translation X</span>
                <span className="text-muted-foreground font-normal">{transform.translation.x.toFixed(1)} mm</span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="0.1"
                value={transform.translation.x}
                onChange={(e) => setTranslation({ ...transform.translation, x: parseFloat(e.target.value) })}
                className="slider w-full"
              />
            </div>

            {/* Translation Y */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Translation Y</span>
                <span className="text-muted-foreground font-normal">{transform.translation.y.toFixed(1)} mm</span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="0.1"
                value={transform.translation.y}
                onChange={(e) => setTranslation({ ...transform.translation, y: parseFloat(e.target.value) })}
                className="slider w-full"
              />
            </div>

            {/* Translation Z */}
            <div>
              <label className="flex justify-between text-xs font-medium mb-2.5 text-foreground">
                <span>Translation Z</span>
                <span className="text-muted-foreground font-normal">{transform.translation.z.toFixed(1)} mm</span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="0.1"
                value={transform.translation.z}
                onChange={(e) => setTranslation({ ...transform.translation, z: parseFloat(e.target.value) })}
                className="slider w-full"
              />
            </div>

            <div className="h-px bg-border/60 my-3"></div>

            {/* Flip Controls */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-1">
                <label className="text-xs font-medium text-foreground">Flip X</label>
                <input
                  type="checkbox"
                  checked={transform.flipX}
                  onChange={(e) => setFlipX(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <label className="text-xs font-medium text-foreground">Flip Y</label>
                <input
                  type="checkbox"
                  checked={transform.flipY}
                  onChange={(e) => setFlipY(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <label className="text-xs font-medium text-foreground">Flip Z</label>
                <input
                  type="checkbox"
                  checked={transform.flipZ}
                  onChange={(e) => setFlipZ(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
              </div>
            </div>

            <div className="h-px bg-border my-2"></div>

            {/* Reset Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={resetOrientation}
                className="w-full px-4 py-2.5 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                Reset Orientation
              </button>
              <button
                onClick={resetTransform}
                className="w-full px-4 py-2.5 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                Reset All Transforms
              </button>
            </div>
          </div>
        </section>

        {/* Coordinate System Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Coordinate System
          </h2>
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground mb-4">
              Set the vertical axis. Z-up means Z is vertical (up/down) and X-Y is the flow plane (horizontal).
            </p>
            <div>
              <label className="block text-xs font-medium mb-2.5 text-foreground">
                Vertical Axis
              </label>
              <select
                value={transform.coordinateSystem || 'Z-up'}
                onChange={(e) => setCoordinateSystem(e.target.value as CoordinateSystem)}
                className="w-full px-3 py-2.5 text-sm border border-border/60 rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 cursor-pointer transition-all shadow-sm hover:shadow-md"
              >
                <option value="Z-up">Z-up (Z = vertical, X-Y = flow plane)</option>
                <option value="Y-up">Y-up (Y = vertical, X-Z = flow plane)</option>
                <option value="X-up">X-up (X = vertical, Y-Z = flow plane)</option>
              </select>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Current System:</p>
              <p>
                {transform.coordinateSystem === 'Z-up' && 'Z axis is vertical (up/down), X-Y plane is horizontal (flow plane)'}
                {transform.coordinateSystem === 'Y-up' && 'Y axis is vertical (up/down), X-Z plane is horizontal (flow plane)'}
                {transform.coordinateSystem === 'X-up' && 'X axis is vertical (up/down), Y-Z plane is horizontal (flow plane)'}
              </p>
            </div>
          </div>
        </section>

        {/* Face Placement Section */}
        <section className="bg-card rounded-xl border border-border/20 p-5 shadow-lg hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-sm font-semibold mb-5 text-foreground tracking-tight">
            Face Placement
          </h2>
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground mb-4">
              Orient the model so a principal face is facing down
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setFaceOrientation('+X')}
                className="px-3 py-2 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                +X
              </button>
              <button
                onClick={() => setFaceOrientation('-X')}
                className="px-3 py-2 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                -X
              </button>
              <button
                onClick={() => setFaceOrientation('+Y')}
                className="px-3 py-2 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                +Y
              </button>
              <button
                onClick={() => setFaceOrientation('-Y')}
                className="px-3 py-2 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                -Y
              </button>
              <button
                onClick={() => setFaceOrientation('+Z')}
                className="px-3 py-2 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                +Z
              </button>
              <button
                onClick={() => setFaceOrientation('-Z')}
                className="px-3 py-2 text-xs font-medium border border-border/40 rounded-lg bg-secondary/80 hover:bg-secondary hover:border-border/60 text-foreground transition-all shadow-md hover:shadow-lg duration-200"
              >
                -Z
              </button>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

