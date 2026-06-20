/* ============================================================
   3D TRANSFORMATIONS
   Rotation functions for 3D points
============================================================ */

export function rotateX(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * cos - point.z * sin,
    z: point.y * sin + point.z * cos
  };
}

export function rotateY(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos + point.z * sin,
    y: point.y,
    z: -point.x * sin + point.z * cos
  };
}

export function rotateZ(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
    z: point.z
  };
}

export function rotatePoint(point, rx, ry, rz) {
  let p = { ...point };
  if (rx !== 0) p = rotateX(p, rx);
  if (ry !== 0) p = rotateY(p, ry);
  if (rz !== 0) p = rotateZ(p, rz);
  return p;
}



