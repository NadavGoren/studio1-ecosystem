import { FileImport } from './FileImport';
import { useMeshSlice, useUISlice } from '../store';

export function Toolbar() {
  const triangleCount = useMeshSlice((state) => state.triangleCount);
  const error = useUISlice((state) => state.ui.error);
  const isLoading = useUISlice((state) => state.ui.isLoading);

  return (
    <header className="h-16 border-b border-border/30 bg-card flex items-center justify-between px-6 flex-shrink-0 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">STL to SVG Generator</h1>
        {triangleCount > 0 && (
          <div className="px-3 py-1.5 rounded-lg bg-secondary/80 text-xs font-medium text-secondary-foreground shadow-md border border-border/30">
            {triangleCount.toLocaleString()} triangles
          </div>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading...
          </div>
        )}
        {error && (
          <div className="px-3 py-1.5 rounded-lg bg-red-50/80 text-xs font-medium text-red-600 border border-red-200/50 shadow-md">
            {error}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <FileImport />
      </div>
    </header>
  );
}
