import { create } from 'zustand';
import { TransformState, Vector3, CoordinateSystem } from '../../core/types';
import { calculateFaceOrientation } from '../../core/transforms';

interface TransformSlice {
  transform: TransformState;
  setTranslation: (translation: Vector3) => void;
  setRotation: (rotation: Vector3) => void;
  setFlipX: (flip: boolean) => void;
  setFlipY: (flip: boolean) => void;
  setFlipZ: (flip: boolean) => void;
  setFaceOrientation: (face: '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z') => void;
  setCoordinateSystem: (system: CoordinateSystem) => void;
  resetTransform: () => void;
  resetOrientation: () => void;
}

const defaultTransform: TransformState = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  flipX: false,
  flipY: false,
  flipZ: false,
  coordinateSystem: 'Z-up', // Default: Z is vertical, X-Y is flow plane
};

export const useTransformSlice = create<TransformSlice>((set) => ({
  transform: defaultTransform,
  setTranslation: (translation) => 
    set((state) => ({ transform: { ...state.transform, translation } })),
  setRotation: (rotation) => 
    set((state) => ({ transform: { ...state.transform, rotation } })),
  setFlipX: (flipX) => 
    set((state) => ({ transform: { ...state.transform, flipX } })),
  setFlipY: (flipY) => 
    set((state) => ({ transform: { ...state.transform, flipY } })),
  setFlipZ: (flipZ) => 
    set((state) => ({ transform: { ...state.transform, flipZ } })),
  setFaceOrientation: (face) => {
    const rotation = calculateFaceOrientation(face);
    set((state) => ({ transform: { ...state.transform, rotation } }));
  },
  setCoordinateSystem: (coordinateSystem) =>
    set((state) => ({ transform: { ...state.transform, coordinateSystem } })),
  resetTransform: () => set({ transform: defaultTransform }),
  resetOrientation: () => 
    set((state) => ({ 
      transform: { 
        ...state.transform, 
        rotation: { x: 0, y: 0, z: 0 },
        flipX: false,
        flipY: false,
        flipZ: false,
      } 
    })),
}));


