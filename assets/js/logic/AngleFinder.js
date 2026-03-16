import { computeAngle } from '../utils/geometryUtils.js';

export function findInternalAngles(contour) {
  if (!contour || contour.type !== 'outer') {
    return [];
  }
  const vertices = contour.vertices;
  const angles = [];

  for (let i = 0; i < vertices.length; i += 1) {
    const prev = vertices[(i - 1 + vertices.length) % vertices.length];
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const { angle, isReflex, cross } = computeAngle(prev, current, next, true);
    if (angle > 180) {
      angles.push({
        index: i,
        angle,
        cross,
        prevIndex: (i - 1 + vertices.length) % vertices.length,
        nextIndex: (i + 1) % vertices.length
      });
    }
  }

  return angles;
}
