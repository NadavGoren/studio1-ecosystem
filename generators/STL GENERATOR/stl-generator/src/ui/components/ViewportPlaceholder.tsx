export function ViewportPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="text-center space-y-6 max-w-md px-8">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-primary/10 rounded-full"></div>
          <svg width="80" height="80" className="mx-auto text-primary/60 relative" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-foreground">Welcome to STL Generator</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get started by uploading your 3D model. Click the "Load STL File" button in the toolbar above to begin creating beautiful 2D projections.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
            <span>Transform</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
            <span>Render</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
            <span>Export</span>
          </div>
        </div>
      </div>
    </div>
  );
}

