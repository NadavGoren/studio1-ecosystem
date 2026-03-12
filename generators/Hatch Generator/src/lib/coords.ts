import type { ViewTransform, PaperSettings } from '../types';

export function calculateViewBoxDimensions(
  containerRect: { width: number; height: number },
  paper: PaperSettings,
  viewTransform: ViewTransform
) {
  // If container is 0 (collapsed), fallback to 1 to prevent NaN
  const cW = containerRect.width || 100;
  const cH = containerRect.height || 100;
  
  const containerAspect = cW / cH;
  const paperW = paper.width + 100; // padding
  const paperH = paper.height + 100;
  const paperAspect = paperW / paperH;

  let viewW, viewH;
  if (containerAspect > paperAspect) {
    viewH = paperH / viewTransform.scale;
    viewW = viewH * containerAspect;
  } else {
    viewW = paperW / viewTransform.scale;
    viewH = viewW / containerAspect;
  }
  
  return {
    viewBoxX: viewTransform.centerX - viewW / 2,
    viewBoxY: viewTransform.centerY - viewH / 2,
    viewWidthMM: viewW,
    viewHeightMM: viewH
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  containerRect: DOMRect,
  paper: PaperSettings,
  viewTransform: ViewTransform
) {
  const { viewBoxX, viewBoxY, viewWidthMM, viewHeightMM } = calculateViewBoxDimensions(containerRect, paper, viewTransform);
  
  const pctX = (screenX - containerRect.left) / containerRect.width;
  const pctY = (screenY - containerRect.top) / containerRect.height;
  
  return {
    x: viewBoxX + pctX * viewWidthMM,
    y: viewBoxY + pctY * viewHeightMM
  };
}




