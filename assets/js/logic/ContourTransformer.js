import {
  COLUMN_DISTANCE_THRESHOLD,
  MIN_SKIP_LENGTH,
  SPLIT_THRESHOLD_SHORT,
  NEAR_ANGLE_SEGMENT,
  SHORT_INCREMENT_PERCENT,
  NEAR_INCREMENT_MM
} from '../utils/config.js';
import { distance, findCircleIntersection, computeAngle } from '../utils/geometryUtils.js';

function cloneContour(contour) {
  return {
    ...contour,
    vertices: contour.vertices.map((v) => ({ ...v })),
    segments: contour.segments.map((s) => ({ ...s, metadata: { ...s.metadata } })),
    arcs: [...contour.arcs]
  };
}

function indexToName(index) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let n = index;
  let name = '';
  do {
    name = alphabet[n % 26] + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function recomputeSegments(contour) {
  contour.segments.forEach((segment) => {
    const start = contour.vertices[segment.startIndex];
    const end = contour.vertices[segment.endIndex];
    segment.length = distance(start, end);
  });
}

export function transformContour(contour, internalAngles, options = {}) {
  const { skipColumns = true } = options;
  const updated = cloneContour(contour);
  const transformations = [];
  const skipped = new Set();
  let processedCount = 0;
  let skippedCount = 0;

  const angleIndices = internalAngles.map((a) => a.index);

  internalAngles.forEach((angle, idx) => {
    if (skipped.has(angle.index)) {
      return;
    }

    const currentIndex = angle.index;
    const nextAngleIndex = internalAngles[idx + 1]?.index ?? null;
    const currentVertex = updated.vertices[currentIndex];

    if (skipColumns && nextAngleIndex !== null) {
      const nextVertex = updated.vertices[nextAngleIndex];
      if (distance(currentVertex, nextVertex) < COLUMN_DISTANCE_THRESHOLD) {
        skipped.add(currentIndex);
        skipped.add(nextAngleIndex);
        skippedCount += 2;
        transformations.push({
          id: `t-skip-col-${currentIndex}`,
          type: 'SKIPPED_COLUMN',
          vertexIndex: currentIndex,
          vertexName: currentVertex.name,
          angleDegrees: angle.angle,
          prevSegmentIndex: (currentIndex - 1 + updated.segments.length) % updated.segments.length,
          nextSegmentIndex: currentIndex,
          prevSegmentLength: updated.segments[(currentIndex - 1 + updated.segments.length) % updated.segments.length].length,
          nextSegmentLength: updated.segments[currentIndex].length,
          fallbackUsed: false,
          reason: 'COLUMN_DISTANCE_THRESHOLD'
        });
        transformations.push({
          id: `t-skip-col-${nextAngleIndex}`,
          type: 'SKIPPED_COLUMN',
          vertexIndex: nextAngleIndex,
          vertexName: nextVertex.name,
          angleDegrees: internalAngles[idx + 1]?.angle ?? 0,
          prevSegmentIndex: (nextAngleIndex - 1 + updated.segments.length) % updated.segments.length,
          nextSegmentIndex: nextAngleIndex,
          prevSegmentLength: updated.segments[(nextAngleIndex - 1 + updated.segments.length) % updated.segments.length].length,
          nextSegmentLength: updated.segments[nextAngleIndex].length,
          fallbackUsed: false,
          reason: 'COLUMN_DISTANCE_THRESHOLD'
        });
        return;
      }
    }

    const prevSegIndex = (currentIndex - 1 + updated.segments.length) % updated.segments.length;
    const nextSegIndex = currentIndex;
    const prevSeg = updated.segments[prevSegIndex];
    const nextSeg = updated.segments[nextSegIndex];

    const prevLen = prevSeg.length;
    const nextLen = nextSeg.length;
    const minLen = Math.min(prevLen, nextLen);

    if (minLen < MIN_SKIP_LENGTH) {
      skipped.add(currentIndex);
      skippedCount += 1;
      transformations.push({
        id: `t-skip-short-${currentIndex}`,
        type: 'SKIPPED_SHORT_SEGMENT',
        vertexIndex: currentIndex,
        vertexName: currentVertex.name,
        angleDegrees: angle.angle,
        prevSegmentIndex: prevSegIndex,
        nextSegmentIndex: nextSegIndex,
        prevSegmentLength: prevLen,
        nextSegmentLength: nextLen,
        fallbackUsed: false,
        reason: 'MIN_SKIP_LENGTH'
      });
      return;
    }

    let basePrev = prevLen;
    let baseNext = nextLen;
    let incrementMm = 0;
    let incrementPercent = null;
    let type = 'SPLIT_BOTH_SEGMENTS';

    if (minLen < SPLIT_THRESHOLD_SHORT) {
      basePrev = minLen;
      baseNext = minLen;
      incrementPercent = SHORT_INCREMENT_PERCENT;
      incrementMm = (minLen * SHORT_INCREMENT_PERCENT) / 100;
      type = 'SPLIT_SHORT_SEGMENT';
    } else {
      basePrev = Math.min(prevLen, NEAR_ANGLE_SEGMENT);
      baseNext = Math.min(nextLen, NEAR_ANGLE_SEGMENT);
      incrementMm = NEAR_INCREMENT_MM;
      type = 'SPLIT_BOTH_SEGMENTS';
    }

    const prevVertex = updated.vertices[(currentIndex - 1 + updated.vertices.length) % updated.vertices.length];
    const nextVertex = updated.vertices[(currentIndex + 1) % updated.vertices.length];
    const preferredPoint = { x: currentVertex.x, y: currentVertex.y };
    const expectedSign = Math.sign(angle.cross || 0) || -1;

    const { point, fallbackUsed } = findCircleIntersection(
      prevVertex,
      basePrev + incrementMm,
      nextVertex,
      baseNext + incrementMm,
      {
        preferredPoint,
        expectedCrossSign: expectedSign,
        crossCheck: (candidate) => {
          const cross = (prevVertex.x - candidate.x) * (nextVertex.y - candidate.y)
            - (prevVertex.y - candidate.y) * (nextVertex.x - candidate.x);
          return cross;
        }
      }
    );

    if (!point) {
      skipped.add(currentIndex);
      skippedCount += 1;
      transformations.push({
        id: `t-fail-${currentIndex}`,
        type,
        vertexIndex: currentIndex,
        vertexName: currentVertex.name,
        angleDegrees: angle.angle,
        prevSegmentIndex: prevSegIndex,
        nextSegmentIndex: nextSegIndex,
        prevSegmentLength: prevLen,
        nextSegmentLength: nextLen,
        incrementMm,
        incrementPercent,
        fallbackUsed: true,
        reason: 'CIRCLE_INTERSECTION_FAILED'
      });
      return;
    }

    currentVertex.x = point.x;
    currentVertex.y = point.y;
    prevSeg.hasArc = false;
    nextSeg.hasArc = false;
    prevSeg.arcInfo = null;
    nextSeg.arcInfo = null;

    transformations.push({
      id: `t-${currentIndex}`,
      type,
      vertexIndex: currentIndex,
      vertexName: currentVertex.name,
      angleDegrees: angle.angle,
      prevSegmentIndex: prevSegIndex,
      nextSegmentIndex: nextSegIndex,
      prevSegmentLength: prevLen,
      nextSegmentLength: nextLen,
      incrementMm,
      incrementPercent,
      newVertex: { ...currentVertex },
      fallbackUsed
    });
    processedCount += 1;
  });

  recomputeSegments(updated);

  updated.vertices.forEach((vertex, index) => {
    vertex.name = indexToName(index);
  });

  updated.isProcessed = processedCount > 0;
  updated.isProcessedEligible = updated.type === 'outer';

  return {
    contour: updated,
    transformations,
    processedCount,
    skippedCount,
    internalAnglesFound: internalAngles.length
  };
}
