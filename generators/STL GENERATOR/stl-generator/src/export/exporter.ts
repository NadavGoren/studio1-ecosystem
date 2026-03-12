/**
 * Download a file to the user's computer
 * 
 * @param content - File content (string or blob)
 * @param filename - Name of the file to download
 * @param mimeType - MIME type of the file
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string = 'application/octet-stream'
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download SVG file
 */
export function downloadSVG(svgContent: string, filename: string = 'output.svg'): void {
  downloadFile(svgContent, filename, 'image/svg+xml');
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string = 'stl-render', extension: string = 'svg'): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds and 'Z'
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Export SVG with automatic filename
 */
export function exportSVG(svgContent: string, customName?: string): void {
  const filename = customName || generateFilename('stl-render', 'svg');
  downloadSVG(svgContent, filename);
}
