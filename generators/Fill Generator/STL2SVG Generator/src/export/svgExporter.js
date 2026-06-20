/* ============================================================
   SVG EXPORTER
   Export rendered SVG to file with proper layers
============================================================ */

import { getCanvasDimensions } from '../rendering/renderer.js';

/**
 * Export the SVG canvas to a downloadable file
 * Organizes elements by face into separate layers if face colors are enabled
 */
export function exportSVG() {
  const svg = document.getElementById("svg");
  
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  
  const svgClone = svg.cloneNode(true);
  
  svgClone.setAttribute("width", `${canvasWidth}mm`);
  svgClone.setAttribute("height", `${canvasHeight}mm`);
  svgClone.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  
  if (!svgClone.getAttribute("xmlns")) {
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  // Add Inkscape namespace for layer labels (optional, but helps with compatibility)
  if (!svgClone.getAttribute("xmlns:inkscape")) {
    svgClone.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
  }
  
  // Remove preview-only elements (grid, labels, canvas boundary, margin frame, etc.)
  const previewOnlyElements = svgClone.querySelectorAll('[data-preview-only="true"]');
  previewOnlyElements.forEach(el => el.remove());
  
  // Also remove any rect elements (canvas boundary and margin frame)
  const rects = svgClone.querySelectorAll('rect');
  rects.forEach(rect => rect.remove());
  
  // Check if we should organize by face layers
  const useFaceColors = document.getElementById("useFaceColors")?.checked ?? true;
  
  if (useFaceColors) {
    // Group elements by face into separate layers
    // Get all line elements (convert NodeList to Array for easier manipulation)
    const allLines = Array.from(svgClone.querySelectorAll('line'));
    const faceGroups = new Map();
    
    // Collect all lines and group by face
    allLines.forEach(line => {
      const faceName = line.getAttribute('data-face') || 'unknown';
      if (!faceGroups.has(faceName)) {
        faceGroups.set(faceName, []);
      }
      faceGroups.get(faceName).push(line);
    });
    
    // Remove all lines from SVG (they'll be re-added in groups)
    allLines.forEach(line => {
      if (line.parentNode) {
        line.parentNode.removeChild(line);
      }
    });
    
    // Create a group (layer) for each face
    // Order: bottom, back, left, right, front, top (back to front rendering order)
    const faceOrder = ['bottom', 'back', 'left', 'right', 'front', 'top'];
    faceOrder.forEach(faceName => {
      if (faceGroups.has(faceName)) {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        // Use face name for layer ID (capitalize first letter)
        const layerName = faceName.charAt(0).toUpperCase() + faceName.slice(1);
        group.setAttribute("id", `layer-${faceName}`);
        group.setAttribute("inkscape:label", layerName); // Inkscape layer name
        group.setAttribute("data-face", faceName);
        
        // Move all lines of this face into the group
        faceGroups.get(faceName).forEach(line => {
          group.appendChild(line);
        });
        
        // Append group to SVG
        svgClone.appendChild(group);
      }
    });
    
    // Handle any lines with unknown faces
    if (faceGroups.has('unknown')) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("id", "layer-unknown");
      group.setAttribute("inkscape:label", "Unknown");
      faceGroups.get('unknown').forEach(line => {
        group.appendChild(line);
      });
      svgClone.appendChild(group);
    }
  }
  // If useFaceColors is false, keep everything as-is (single layer - no grouping)
  
  const data = new XMLSerializer().serializeToString(svgClone);
  const blob = new Blob([data], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "3d_isometric_cube.svg";
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Setup SVG export button
 */
export function setupExportButton() {
  const downloadBtn = document.getElementById("download");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", exportSVG);
  }
}



