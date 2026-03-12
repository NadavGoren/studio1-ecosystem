import './App.css';
import { useEffect } from 'react';
import { Toolbar } from './ui/components/Toolbar';
import { LeftSidebar } from './ui/components/LeftSidebar';
import { RightSidebar } from './ui/components/RightSidebar';
import { BottomBar } from './ui/components/BottomBar';
import { ViewportPlaceholder } from './ui/components/ViewportPlaceholder';
import { SVGViewport } from './viewport/SVGViewport';
import { useMeshSlice, useUISlice } from './ui/store';
import { useRendering } from './ui/hooks/useRendering';
import { loadDefaultSTL } from './utils/loadDefaultSTL';
import { useSVGViewportSlice } from './ui/store/svgViewportSlice';

function App() {
  const mesh = useMeshSlice((state) => state.mesh);
  const setMesh = useMeshSlice((state) => state.setMesh);
  const setBoundingBox = useMeshSlice((state) => state.setBoundingBox);
  const setCenterOfMass = useMeshSlice((state) => state.setCenterOfMass);
  const setTriangleCount = useMeshSlice((state) => state.setTriangleCount);
  const setIsLoading = useUISlice((state) => state.setIsLoading);
  const setError = useUISlice((state) => state.setError);
  const resetView = useSVGViewportSlice((state) => state.resetView);
  
  // Initialize rendering pipeline
  useRendering();

  // Load default STL file on mount
  useEffect(() => {
    const loadDefault = async () => {
      if (!mesh) {
        console.log('App: Loading default STL file...');
        await loadDefaultSTL(
          setMesh,
          setBoundingBox,
          setCenterOfMass,
          setTriangleCount,
          setIsLoading,
          setError
        );
        // Reset view to default isometric when default STL is loaded
        resetView();
      }
    };
    loadDefault();
  }, []); // Only run once on mount

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Transform tools (280px fixed) */}
        <LeftSidebar />

        {/* Center Viewport Area - Full width SVG viewport */}
        <main className="flex-1 overflow-hidden">
          {mesh ? (
            <SVGViewport />
          ) : (
            <ViewportPlaceholder />
          )}
        </main>

        {/* Right Sidebar - Canvas, Projection, Rendering, Lighting, Export (280px fixed) */}
        <RightSidebar />
      </div>

      {/* Bottom Bar */}
      <BottomBar />
    </div>
  );
}

export default App;
