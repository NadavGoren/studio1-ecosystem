import React from 'react';
import { CanvasConfig } from '../../core/types';
import { useMeshSlice, useUISlice, useRenderedDataSlice } from '../store';
import { exportSVG } from '../../export/exporter';

interface ExportButtonProps {
  canvas: CanvasConfig;
}

export function ExportButton({ canvas }: ExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  
  // Get state from stores
  const mesh = useMeshSlice((state) => state.mesh);
  const svgContent = useRenderedDataSlice((state) => state.svgContent);
  const setError = useUISlice((state) => state.setError);

  const hasData = mesh !== null && svgContent.length > 0;

  const handleExport = () => {
    if (!hasData || !svgContent) {
      alert('No geometry to export. Please load an STL file first.');
      return;
    }

    setIsExporting(true);
    try {
      // Export the already-rendered SVG
      exportSVG(svgContent);

      console.log('SVG exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export SVG';
      setError(errorMessage);
      alert('Failed to export SVG. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !hasData}
      type="button"
      className={`
        w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shadow-md
        ${isExporting || !hasData
          ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
          : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]'
        }
      `}
    >
      {isExporting ? (
        <span className="flex items-center justify-center gap-2">
          <svg width="14" height="14" className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Exporting...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export SVG
        </span>
      )}
    </button>
  );
}
