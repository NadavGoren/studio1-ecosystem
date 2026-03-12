import React from 'react';
import { useMeshSlice, useUISlice, useRenderedDataSlice } from '../store';
import { formatTime } from '../../utils/metrics';

export function BottomBar() {
  const mesh = useMeshSlice((state) => state.mesh);
  const metrics = useRenderedDataSlice((state) => state.metrics);
  const isLoading = useUISlice((state) => state.ui.isLoading);
  const error = useUISlice((state) => state.ui.error);

  const status = error
    ? 'Error'
    : isLoading
    ? 'Loading...'
    : mesh
    ? 'Ready'
    : 'No file loaded';

  return (
    <footer className="h-12 border-t border-border/30 bg-card flex items-center justify-between px-6 flex-shrink-0 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Line Count</span>
          <span className="text-xs font-semibold text-foreground">
            {metrics ? metrics.lineCount.toLocaleString() : '0'}
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Path Length</span>
          <span className="text-xs font-semibold text-foreground">
            {metrics ? `${metrics.pathLength.toFixed(1)} mm` : '0 mm'}
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Plot Time</span>
          <span className="text-xs font-semibold text-foreground">
            {metrics ? formatTime(metrics.estimatedPlotTime) : '0:00'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-md ${
          error ? 'bg-red-50/80 text-red-600 border-red-200/50' : 
          mesh ? 'bg-green-50/80 text-green-600 border-green-200/50' : 
          'bg-secondary/80 text-muted-foreground border-border/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            error ? 'bg-red-500' : 
            mesh ? 'bg-green-500' : 
            'bg-muted-foreground'
          }`}></div>
          <span className="text-xs font-medium">{status}</span>
        </div>
      </div>
    </footer>
  );
}

