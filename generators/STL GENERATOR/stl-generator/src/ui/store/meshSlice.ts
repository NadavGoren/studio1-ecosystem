import { create } from 'zustand';
import type { Mesh, BoundingBox, Vector3 } from '../../core/types';

interface MeshSlice {
  mesh: Mesh | null;
  boundingBox: BoundingBox | null;
  centerOfMass: Vector3 | null;
  triangleCount: number;
  setMesh: (mesh: Mesh) => void;
  setBoundingBox: (bbox: BoundingBox) => void;
  setCenterOfMass: (com: Vector3) => void;
  setTriangleCount: (count: number) => void;
  clearMesh: () => void;
}

export const useMeshSlice = create<MeshSlice>((set) => ({
  mesh: null,
  boundingBox: null,
  centerOfMass: null,
  triangleCount: 0,
  setMesh: (mesh) => set({ mesh }),
  setBoundingBox: (boundingBox) => set({ boundingBox }),
  setCenterOfMass: (centerOfMass) => set({ centerOfMass }),
  setTriangleCount: (triangleCount) => set({ triangleCount }),
  clearMesh: () => set({ 
    mesh: null, 
    boundingBox: null, 
    centerOfMass: null, 
    triangleCount: 0 
  }),
}));

