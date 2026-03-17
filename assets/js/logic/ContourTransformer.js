import {
  COLUMN_DISTANCE_THRESHOLD,
  MIN_SKIP_LENGTH,
  SPLIT_THRESHOLD_SHORT,
  NEAR_ANGLE_SEGMENT,
  SHORT_INCREMENT_PERCENT,
  NEAR_INCREMENT_MM
} from '../utils/config.js';
import { distance, findCircleIntersection } from '../utils/geometryUtils.js';

export const CONTOUR_TRANSFORMER_VERSION = '2026-03-17-fix-split-index-v2';

const SPLIT_EPSILON = 1e-6;
let splitCounter = 0;

function createSplitId(prefix) {
  splitCounter += 1;
  return `${prefix}-${Date.now()}-${splitCounter}`;
}

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

function getSegmentLength(contour, segment) {
  const start = contour.vertices[segment.startIndex];
  const end = contour.vertices[segment.endIndex];
  return distance(start, end);
}

function findConnectedSegmentIndices(contour, vertexIndex) {
  let prevSegIndex = -1;
  let nextSegIndex = -1;

  contour.segments.forEach((segment, index) => {
    if (segment.endIndex === vertexIndex) {
      prevSegIndex = index;
    }
    if (segment.startIndex === vertexIndex) {
      nextSegIndex = index;
    }
  });

  return { prevSegIndex, nextSegIndex };
}

function shiftSegmentIndicesAfterInsert(contour, insertIndex) {
  contour.segments.forEach((segment) => {
    if (segment.startIndex >= insertIndex) {
      segment.startIndex += 1;
    }
    if (segment.endIndex >= insertIndex) {
      segment.endIndex += 1;
    }
  });
}

/**
 * Calculates a point at a given distance from the start vertex along the segment
 * pointing towards the end vertex.
 * @param {Object} startVertex - The start vertex of the segment
 * @param {Object} endVertex - The end vertex of the segment
 * @param {number} distanceFromStart - Distance from start vertex
 * @returns {Object} New point {x, y}
 */
function pointAlongSegment(startVertex, endVertex, distanceFromStart) {
  const totalLength = distance(startVertex, endVertex);
  if (totalLength === 0) return { x: startVertex.x, y: startVertex.y };
  
  const t = distanceFromStart / totalLength;
  return {
    x: startVertex.x + (endVertex.x - startVertex.x) * t,
    y: startVertex.y + (endVertex.y - startVertex.y) * t
  };
}

/**
 * Splits a segment by inserting a new vertex at the specified distance from the start.
 * This creates: start -> newVertex -> end (instead of start -> end)
 * @param {Object} contour - The contour to modify
 * @param {number} segmentIndex - Index of the segment to split
 * @param {number} distanceFromStart - Distance from start vertex where to place new vertex
 * @returns {Object} Object with newVertex, newSegment, updatedOriginalSegment
 */
function splitSegmentAtDistance(contour, segmentIndex, distanceFromStart) {
  const segment = contour.segments[segmentIndex];
  if (!segment) {
    return null;
  }

  const startVertex = contour.vertices[segment.startIndex];
  const endVertex = contour.vertices[segment.endIndex];
  const segmentLength = distance(startVertex, endVertex);
  const splitDistance = Math.max(0, Math.min(distanceFromStart, segmentLength));

  // Ignore degenerate splits at segment boundaries.
  if (splitDistance <= SPLIT_EPSILON || segmentLength - splitDistance <= SPLIT_EPSILON) {
    return null;
  }

  const newVertexPos = pointAlongSegment(startVertex, endVertex, splitDistance);
  const insertIndex = segment.endIndex === 0 ? contour.vertices.length : segment.endIndex;

  const newVertex = {
    id: createSplitId(`split-${segmentIndex}`),
    name: '',
    x: newVertexPos.x,
    y: newVertexPos.y,
    isAnglePoint: false,
    originalIndex: segment.startIndex
  };

  contour.vertices.splice(insertIndex, 0, newVertex);
  shiftSegmentIndicesAfterInsert(contour, insertIndex);

  const shiftedOriginalEndIndex = segment.endIndex;
  segment.endIndex = insertIndex;
  segment.length = distance(contour.vertices[segment.startIndex], contour.vertices[insertIndex]);
  segment.hasArc = false;
  segment.arcInfo = null;

  const newSegment = {
    id: createSplitId(`seg-split-${segmentIndex}`),
    startIndex: insertIndex,
    endIndex: shiftedOriginalEndIndex,
    length: distance(contour.vertices[insertIndex], contour.vertices[shiftedOriginalEndIndex]),
    hasArc: false,
    arcInfo: null,
    metadata: {}
  };

  contour.segments.splice(segmentIndex + 1, 0, newSegment);

  return {
    newVertex: contour.vertices[insertIndex],
    newVertexIndex: insertIndex,
    newSegment,
    originalSegment: segment
  };
}

export function transformContour(contour, internalAngles, options = {}) {
  const { skipColumns = true } = options;
  const updated = cloneContour(contour);
  const transformations = [];
  const skippedVertexIds = new Set();
  let processedCount = 0;
  let skippedCount = 0;

  const angleTargets = internalAngles
    .map((angle, order) => ({
      ...angle,
      order,
      vertexId: contour.vertices[angle.index]?.id ?? null
    }))
    .filter((angle) => angle.vertexId !== null);

  const markSkipped = (vertexId) => {
    if (!skippedVertexIds.has(vertexId)) {
      skippedVertexIds.add(vertexId);
      skippedCount += 1;
    }
  };

  angleTargets.forEach((angle, idx) => {
    if (skippedVertexIds.has(angle.vertexId)) {
      return;
    }

    const currentIndex = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
    if (currentIndex === -1) {
      return;
    }

    const currentVertex = updated.vertices[currentIndex];
    let { prevSegIndex, nextSegIndex } = findConnectedSegmentIndices(updated, currentIndex);

    if (prevSegIndex === -1 || nextSegIndex === -1) {
      markSkipped(angle.vertexId);
      transformations.push({
        id: `t-fail-topology-${currentIndex}`,
        type: 'INVALID_TOPOLOGY',
        vertexIndex: currentIndex,
        vertexName: currentVertex.name,
        angleDegrees: angle.angle,
        prevSegmentIndex: prevSegIndex,
        nextSegmentIndex: nextSegIndex,
        fallbackUsed: true,
        reason: 'SEGMENT_TOPOLOGY_MISMATCH'
      });
      return;
    }

    if (skipColumns && idx + 1 < angleTargets.length) {
      const nextAngle = angleTargets[idx + 1];
      const nextAngleIndex = updated.vertices.findIndex((vertex) => vertex.id === nextAngle.vertexId);
      const nextVertex = nextAngleIndex !== -1 ? updated.vertices[nextAngleIndex] : null;

      if (
        nextVertex
        && !skippedVertexIds.has(nextAngle.vertexId)
        && nextAngleIndex !== currentIndex
        && distance(currentVertex, nextVertex) < COLUMN_DISTANCE_THRESHOLD
      ) {
        const currentPrevSeg = updated.segments[prevSegIndex];
        const currentNextSeg = updated.segments[nextSegIndex];
        const nextConnections = findConnectedSegmentIndices(updated, nextAngleIndex);
        const nextPrevSeg = nextConnections.prevSegIndex === -1 ? null : updated.segments[nextConnections.prevSegIndex];
        const nextNextSeg = nextConnections.nextSegIndex === -1 ? null : updated.segments[nextConnections.nextSegIndex];

        markSkipped(angle.vertexId);
        markSkipped(nextAngle.vertexId);

        transformations.push({
          id: `t-skip-col-${currentIndex}`,
          type: 'SKIPPED_COLUMN',
          vertexIndex: currentIndex,
          vertexName: currentVertex.name,
          angleDegrees: angle.angle,
          prevSegmentIndex: prevSegIndex,
          nextSegmentIndex: nextSegIndex,
          prevSegmentLength: currentPrevSeg ? getSegmentLength(updated, currentPrevSeg) : 0,
          nextSegmentLength: currentNextSeg ? getSegmentLength(updated, currentNextSeg) : 0,
          fallbackUsed: false,
          reason: 'COLUMN_DISTANCE_THRESHOLD'
        });
        transformations.push({
          id: `t-skip-col-${nextAngle.vertexId}`,
          type: 'SKIPPED_COLUMN',
          vertexIndex: nextAngleIndex,
          vertexName: nextVertex.name,
          angleDegrees: nextAngle.angle,
          prevSegmentIndex: nextConnections.prevSegIndex,
          nextSegmentIndex: nextConnections.nextSegIndex,
          prevSegmentLength: nextPrevSeg ? getSegmentLength(updated, nextPrevSeg) : 0,
          nextSegmentLength: nextNextSeg ? getSegmentLength(updated, nextNextSeg) : 0,
          fallbackUsed: false,
          reason: 'COLUMN_DISTANCE_THRESHOLD'
        });
        return;
      }
    }

    const prevSeg = updated.segments[prevSegIndex];
    const nextSeg = updated.segments[nextSegIndex];

    const prevLen = getSegmentLength(updated, prevSeg);
    const nextLen = getSegmentLength(updated, nextSeg);
    const minLen = Math.min(prevLen, nextLen);

    if (minLen < MIN_SKIP_LENGTH) {
      markSkipped(angle.vertexId);
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
    let splitPrev = false;
    let splitNext = false;

    if (minLen < SPLIT_THRESHOLD_SHORT) {
      basePrev = minLen;
      baseNext = minLen;
      incrementPercent = SHORT_INCREMENT_PERCENT;
      incrementMm = (minLen * SHORT_INCREMENT_PERCENT) / 100;
      type = 'SPLIT_SHORT_SEGMENT';

      if (prevLen - nextLen > SPLIT_EPSILON) {
        splitPrev = true;
      } else if (nextLen - prevLen > SPLIT_EPSILON) {
        splitNext = true;
      }
    } else {
      basePrev = Math.min(prevLen, NEAR_ANGLE_SEGMENT);
      baseNext = Math.min(nextLen, NEAR_ANGLE_SEGMENT);
      incrementMm = NEAR_INCREMENT_MM;
      type = 'SPLIT_BOTH_SEGMENTS';
      splitPrev = prevLen - basePrev > SPLIT_EPSILON;
      splitNext = nextLen - baseNext > SPLIT_EPSILON;
    }

    let prevSplitVertex = null;
    let nextSplitVertex = null;

    if (splitPrev) {
      const currentIndexBeforeSplit = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
      const prevConnection = findConnectedSegmentIndices(updated, currentIndexBeforeSplit);
      const prevSegmentToSplit = updated.segments[prevConnection.prevSegIndex];
      const prevSegmentLength = getSegmentLength(updated, prevSegmentToSplit);
      const splitDistanceFromStart = prevSegmentLength - basePrev;
      const splitResult = splitSegmentAtDistance(updated, prevConnection.prevSegIndex, splitDistanceFromStart);
      if (splitResult) {
        prevSplitVertex = splitResult.newVertex;
      }
    }

    if (splitNext) {
      const currentIndexBeforeSplit = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
      const nextConnection = findConnectedSegmentIndices(updated, currentIndexBeforeSplit);
      const splitResult = splitSegmentAtDistance(updated, nextConnection.nextSegIndex, baseNext);
      if (splitResult) {
        nextSplitVertex = splitResult.newVertex;
      }
    }

    const currentIndexAfterSplit = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
    const currentVertexAfterSplit = updated.vertices[currentIndexAfterSplit];
    const finalConnections = findConnectedSegmentIndices(updated, currentIndexAfterSplit);
    const updatedPrevSegIndex = finalConnections.prevSegIndex;
    const updatedNextSegIndex = finalConnections.nextSegIndex;
    const updatedPrevSeg = updated.segments[updatedPrevSegIndex];
    const updatedNextSeg = updated.segments[updatedNextSegIndex];

    const prevCenter = prevSplitVertex ?? updated.vertices[updatedPrevSeg.startIndex];
    const nextCenter = nextSplitVertex ?? updated.vertices[updatedNextSeg.endIndex];

    const preferredPoint = { x: currentVertexAfterSplit.x, y: currentVertexAfterSplit.y };
    const expectedSign = Math.sign(angle.cross || 0) || -1;

    const { point, fallbackUsed } = findCircleIntersection(
      prevCenter,
      basePrev + incrementMm,
      nextCenter,
      baseNext + incrementMm,
      {
        preferredPoint,
        expectedCrossSign: expectedSign,
        crossCheck: (candidate) => {
          const cross = (prevCenter.x - candidate.x) * (nextCenter.y - candidate.y)
            - (prevCenter.y - candidate.y) * (nextCenter.x - candidate.x);
          return cross;
        }
      }
    );

    if (!point) {
      markSkipped(angle.vertexId);
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

    currentVertexAfterSplit.x = point.x;
    currentVertexAfterSplit.y = point.y;

    if (updatedPrevSegIndex !== -1) {
      updated.segments[updatedPrevSegIndex].hasArc = false;
      updated.segments[updatedPrevSegIndex].arcInfo = null;
    }
    if (updatedNextSegIndex !== -1) {
      updated.segments[updatedNextSegIndex].hasArc = false;
      updated.segments[updatedNextSegIndex].arcInfo = null;
    }

    transformations.push({
      id: `t-${currentIndexAfterSplit}`,
      type,
      vertexIndex: currentIndexAfterSplit,
      vertexName: currentVertexAfterSplit.name,
      angleDegrees: angle.angle,
      prevSegmentIndex: updatedPrevSegIndex !== -1 ? updatedPrevSegIndex : prevSegIndex,
      nextSegmentIndex: updatedNextSegIndex !== -1 ? updatedNextSegIndex : nextSegIndex,
      prevSegmentLength: prevLen,
      nextSegmentLength: nextLen,
      incrementMm,
      incrementPercent,
      newVertex: { ...currentVertexAfterSplit },
      prevSplitVertex: { ...prevCenter },
      nextSplitVertex: { ...nextCenter },
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
