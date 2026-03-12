import { parseSTLFromBuffer } from '../core/stlParser';
import { processMesh, normalizeMesh } from '../core/geometry';
import { WorkerMessage, STLParseResult, GeometryProcessResult } from '../core/types';

// Worker message handler
self.onmessage = function (e: MessageEvent) {
  const message: WorkerMessage = e.data;

  try {
    if (message.type === 'parse-stl') {
      const buffer = message.payload as ArrayBuffer;
      const result: STLParseResult = parseSTLFromBuffer(buffer);

      // Process mesh (calculate bbox, COM, adjacency)
      const processed = processMesh(result.mesh);

      self.postMessage({
        type: 'stl-parsed',
        payload: {
          mesh: processed,
          triangleCount: result.triangleCount,
        },
      } as WorkerMessage);
    } else if (message.type === 'process-geometry') {
      const { mesh, targetSize } = message.payload as {
        mesh: any;
        targetSize?: number;
      };

      // Normalize mesh
      const normalized = normalizeMesh(mesh, targetSize);

      // Process again to update bbox and COM
      const processed = processMesh(normalized);

      self.postMessage({
        type: 'geometry-processed',
        payload: {
          mesh: processed,
          normalized: true,
        } as GeometryProcessResult,
      } as WorkerMessage);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    } as WorkerMessage);
  }
};












