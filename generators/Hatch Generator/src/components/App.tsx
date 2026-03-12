import { Canvas } from './Canvas';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { ColorPanel } from './ColorPanel';
import { PathfinderPanel } from './PathfinderPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

function App() {
  useKeyboardShortcuts();

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full w-full overflow-hidden text-gray-900">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <LeftPanel />
          <main className="flex-1 relative bg-gray-100 overflow-hidden">
            <Canvas />
          </main>
          <RightPanel />
        </div>
        
        <ColorPanel />
        <PathfinderPanel />
      </div>
    </ErrorBoundary>
  );
}

export default App;




