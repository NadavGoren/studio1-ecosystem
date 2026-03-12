import { Metrics as MetricsType } from '../../core/types';
import { formatTime } from '../../utils/metrics';

interface MetricsProps {
  metrics: MetricsType | null;
}

export function Metrics({ metrics }: MetricsProps) {
  if (!metrics) {
    return (
      <div className="text-xs text-muted-foreground">
        No metrics available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Line Count</span>
        <span className="text-xs font-semibold text-foreground">{metrics.lineCount.toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-center py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Path Length</span>
        <span className="text-xs font-semibold text-foreground">{metrics.pathLength.toFixed(2)} mm</span>
      </div>
      <div className="flex justify-between items-center py-2">
        <span className="text-xs font-medium text-muted-foreground">Plot Time</span>
        <span className="text-xs font-semibold text-foreground">{formatTime(metrics.estimatedPlotTime)}</span>
      </div>
    </div>
  );
}
