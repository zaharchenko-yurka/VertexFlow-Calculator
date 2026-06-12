import {
  CIRCLE_INTERSECTION_EPSILON,
  CIRCLE_INTERSECTION_MAX_ITERATIONS
} from './config.js';

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointToSegmentDistance(point, segStart, segEnd) {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return distance(point, segStart);
  }
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projection = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy
  };
  return distance(point, projection);
}

export function doesCircleIntersectSegment(point, radius, segStart, segEnd) {
  const dist = pointToSegmentDistance(point, segStart, segEnd);
  return dist < radius;
}

export function computeAngle(prevPoint, currentPoint, nextPoint, clockwise = true) {
  const v1 = { x: prevPoint.x - currentPoint.x, y: prevPoint.y - currentPoint.y };
  const v2 = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const len1 = Math.hypot(v1.x, v1.y) || 1;
  const len2 = Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.min(1, Math.max(-1, dot / (len1 * len2)));
  const baseAngle = (Math.acos(cos) * 180) / Math.PI; // 0..180
  const cross = v1.x * v2.y - v1.y * v2.x;
  const isReflex = clockwise ? cross < 0 : cross > 0;
  const angle = isReflex ? 360 - baseAngle : baseAngle;
  return { angle, isReflex, cross };
}

function circleIntersections(c1, r1, c2, r2) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);

  if (d === 0) {
    return [];
  }
  if (d > r1 + r2) {
    return [];
  }
  if (d < Math.abs(r1 - r2)) {
    return [];
  }

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  if (hSq < 0) {
    return [];
  }
  const h = Math.sqrt(hSq);

  const xm = c1.x + (a * dx) / d;
  const ym = c1.y + (a * dy) / d;

  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;

  return [
    { x: xm + rx, y: ym + ry },
    { x: xm - rx, y: ym - ry }
  ];
}

export function findCircleIntersection(c1, r1, c2, r2, options = {}) {
  const {
    epsilon = CIRCLE_INTERSECTION_EPSILON,
    maxIterations = CIRCLE_INTERSECTION_MAX_ITERATIONS,
    preferredPoint = null,
    crossCheck = null,
    expectedCrossSign = null
  } = options;

  let currentR1 = r1;
  let currentR2 = r2;
  let fallbackUsed = false;
  let iterations = 0;

  while (iterations <= maxIterations) {
    const points = circleIntersections(c1, currentR1, c2, currentR2);
    if (points.length) {
      let chosen = points[0];
      if (points.length === 2) {
        if (crossCheck && expectedCrossSign !== null) {
          const cross1 = crossCheck(points[0]);
          const cross2 = crossCheck(points[1]);
          const sign1 = Math.sign(cross1);
          const sign2 = Math.sign(cross2);
          if (sign1 === expectedCrossSign && sign2 !== expectedCrossSign) {
            chosen = points[0];
          } else if (sign2 === expectedCrossSign && sign1 !== expectedCrossSign) {
            chosen = points[1];
          } else if (preferredPoint) {
            chosen = distance(preferredPoint, points[0]) <= distance(preferredPoint, points[1])
              ? points[0]
              : points[1];
          }
        } else if (preferredPoint) {
          chosen = distance(preferredPoint, points[0]) <= distance(preferredPoint, points[1])
            ? points[0]
            : points[1];
        }
      }
      return { point: chosen, fallbackUsed, iterations };
    }
    fallbackUsed = true;
    currentR1 += epsilon;
    currentR2 += epsilon;
    iterations += 1;
  }

  return { point: null, fallbackUsed: true, iterations };
}
