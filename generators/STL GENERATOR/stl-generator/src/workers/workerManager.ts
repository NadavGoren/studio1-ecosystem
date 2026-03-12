import { WorkerMessage, Mesh, TransformState, LightingState, RenderingMode } from '../core/types';

export class WorkerManager {
  private geometryWorker: Worker | null = null;
  private edgeWorker: Worker | null = null;

  constructor() {
    // Workers will be created on demand
  }

  /**
   * Get or create geometry worker
   */
  private getGeometryWorker(): Worker {
    if (!this.geometryWorker) {
      this.geometryWorker = new Worker(
        new URL('./geometryWorker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.geometryWorker;
  }

  /**
   * Get or create edge worker
   */
  private getEdgeWorker(): Worker {
    if (!this.edgeWorker) {
      this.edgeWorker = new Worker(
        new URL('./edgeWorker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.edgeWorker;
  }

  /**
   * Parse STL file in worker
   */
  parseSTL(buffer: ArrayBuffer): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.getGeometryWorker();
      const handler = (e: MessageEvent) => {
        const message: WorkerMessage = e.data;
        if (message.type === 'stl-parsed') {
          worker.removeEventListener('message', handler);
          resolve(message.payload);
        } else if (message.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(message.error || 'Unknown error'));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'parse-stl',
        payload: buffer,
      } as WorkerMessage);
    });
  }

  /**
   * Process geometry in worker
   */
  processGeometry(mesh: Mesh, targetSize?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.getGeometryWorker();
      const handler = (e: MessageEvent) => {
        const message: WorkerMessage = e.data;
        if (message.type === 'geometry-processed') {
          worker.removeEventListener('message', handler);
          resolve(message.payload);
        } else if (message.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(message.error || 'Unknown error'));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'process-geometry',
        payload: { mesh, targetSize },
      } as WorkerMessage);
    });
  }

  /**
   * Extract edges in worker
   */
  extractEdges(
    mesh: Mesh,
    transform: TransformState,
    lighting: LightingState,
    mode: RenderingMode
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.getEdgeWorker();
      const handler = (e: MessageEvent) => {
        const message: WorkerMessage = e.data;
        if (message.type === 'edges-extracted') {
          worker.removeEventListener('message', handler);
          resolve(message.payload);
        } else if (message.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(message.error || 'Unknown error'));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'extract-edges',
        payload: { mesh, transform, lighting, mode },
      } as WorkerMessage);
    });
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    if (this.geometryWorker) {
      this.geometryWorker.terminate();
      this.geometryWorker = null;
    }
    if (this.edgeWorker) {
      this.edgeWorker.terminate();
      this.edgeWorker = null;
    }
  }
}












