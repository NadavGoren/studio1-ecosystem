import { useRef, useState, useEffect } from 'react';

interface ResizableSplitterProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftWidth?: number; // Percentage (0-100)
  minLeftWidth?: number; // Percentage
  minRightWidth?: number; // Percentage
}

export function ResizableSplitter({
  left,
  right,
  initialLeftWidth = 50,
  minLeftWidth = 20,
  minRightWidth = 20,
}: ResizableSplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain to min/max widths
      const constrainedWidth = Math.max(
        minLeftWidth,
        Math.min(100 - minRightWidth, newLeftWidth)
      );

      setLeftWidth(constrainedWidth);
      
      // Dispatch custom event to trigger resize in viewports
      window.dispatchEvent(new Event('splitter-resize'));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <div ref={containerRef} className="flex w-full h-full relative">
      {/* Left panel */}
      <div
        className="h-full overflow-hidden flex-shrink-0"
        style={{ 
          width: `${leftWidth}%`,
          minWidth: 0,
          maxWidth: `${leftWidth}%`
        }}
      >
        {left}
      </div>

      {/* Resizable splitter */}
      <div
        ref={splitterRef}
        onMouseDown={handleMouseDown}
        className={`
          h-full bg-border/60 cursor-col-resize hover:bg-primary/30 transition-all
          flex items-center justify-center relative z-10 flex-shrink-0
          ${isDragging ? 'bg-primary/50' : ''}
        `}
        style={{ width: '6px', minWidth: '6px' }}
      >
        {/* Visual indicator - modern handle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-1 h-12 bg-muted-foreground/30 rounded-full"></div>
        </div>
      </div>

      {/* Right panel */}
      <div
        className="h-full overflow-hidden flex-shrink-0"
        style={{ 
          width: `${100 - leftWidth}%`,
          minWidth: 0,
          maxWidth: `${100 - leftWidth}%`
        }}
      >
        {right}
      </div>
    </div>
  );
}

