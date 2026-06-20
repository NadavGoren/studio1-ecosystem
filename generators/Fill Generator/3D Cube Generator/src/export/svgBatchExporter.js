/* ============================================================
   SVG BATCH EXPORTER
   Export turntable frames as individual SVG files into a folder
   chosen by the user (File System Access API), or as sequential
   downloads if the API is unavailable.
============================================================ */

import { draw } from '../rendering/renderer.js';
import { setOrbitHorizontal } from '../ui/controls.js';
import { buildExportSVGString } from './svgExporter.js';

let isExporting = false;
let cancelled = false;

function padIndex(i, total) {
  const width = String(total).length;
  return String(i).padStart(width, '0');
}

async function writeFile(dirHandle, filename, contents) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

function downloadFallback(filename, contents) {
  const blob = new Blob([contents], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportBatch() {
  if (isExporting) return;

  const startAngle = parseFloat(document.getElementById('animStartAngle')?.value || 0);
  const endAngle = parseFloat(document.getElementById('animEndAngle')?.value || 360);
  const frameCount = parseInt(document.getElementById('animFrameCount')?.value || 120);

  if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle) || !frameCount) {
    alert('Invalid animation parameters.');
    return;
  }
  if (startAngle === endAngle) {
    alert('Start and end angles must be different.');
    return;
  }
  if (frameCount < 1) {
    alert('Frame count must be at least 1.');
    return;
  }

  // Pick destination folder
  let dirHandle = null;
  const hasFsApi = typeof window.showDirectoryPicker === 'function';
  if (hasFsApi) {
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user cancelled picker
      console.warn('showDirectoryPicker failed, falling back to downloads:', err);
    }
  } else {
    const ok = confirm(
      `Your browser does not support choosing a folder. ${frameCount} SVG files will be downloaded individually to your default downloads folder. Continue?`
    );
    if (!ok) return;
  }

  // Try to stop preview animation if it's running
  try {
    const animationModule = await import('../../3d-generator.js');
    if (typeof animationModule.stopAnimationPreview === 'function') {
      animationModule.stopAnimationPreview();
    }
  } catch (e) {
    // non-fatal
  }

  const btn = document.getElementById('exportSvgBatch');
  const status = document.getElementById('svgBatchStatus');
  isExporting = true;
  cancelled = false;
  if (btn) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Cancel Export';
    btn.disabled = false;
    btn.classList.add('cancelling');
  }
  const cancelHandler = () => { cancelled = true; };
  if (btn) btn.addEventListener('click', cancelHandler, { once: true });

  const angleRange = endAngle - startAngle;
  const angleStep = frameCount > 1 ? angleRange / (frameCount - 1) : 0;
  const baseName = 'cube';

  try {
    for (let i = 0; i < frameCount; i++) {
      if (cancelled) break;

      const angle = startAngle + i * angleStep;
      setOrbitHorizontal(angle);
      draw(angle);

      // Wait for the browser to actually render
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));

      const svgString = buildExportSVGString();
      const filename = `${baseName}_${padIndex(i + 1, frameCount)}.svg`;

      if (dirHandle) {
        await writeFile(dirHandle, filename, svgString);
      } else {
        downloadFallback(filename, svgString);
        // Small delay so the browser doesn't choke on bulk downloads
        await new Promise(r => setTimeout(r, 80));
      }

      if (status) {
        status.textContent = `Exported ${i + 1} / ${frameCount}`;
      }
    }

    if (status) {
      status.textContent = cancelled
        ? `Cancelled (${status.textContent || '0 frames written'})`
        : `Done — ${frameCount} SVG file${frameCount === 1 ? '' : 's'} exported.`;
    }
  } catch (err) {
    console.error('SVG batch export failed:', err);
    alert('SVG batch export failed: ' + (err?.message || err));
    if (status) status.textContent = 'Export failed.';
  } finally {
    isExporting = false;
    if (btn) {
      btn.classList.remove('cancelling');
      btn.textContent = btn.dataset.originalText || 'Export Frames as SVGs';
      btn.disabled = false;
      btn.removeEventListener('click', cancelHandler);
    }
  }
}

export function setupSvgBatchExporter() {
  const btn = document.getElementById('exportSvgBatch');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!isExporting) exportBatch();
  });
}
