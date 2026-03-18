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
    console.log('[TRANSFORM] Processing angle idx:', idx, 'vertexId:', angle.vertexId, 'skipped:', skippedVertexIds.has(angle.vertexId));
    
    if (skippedVertexIds.has(angle.vertexId)) {
      console.log('[TRANSFORM] Skipping already processed angle');
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

    // Handle column splitting when skipColumns is FALSE and distance is small
    if (!skipColumns && idx + 1 < angleTargets.length) {
      const nextAngle = angleTargets[idx + 1];
      const nextAngleIndexOrig = updated.vertices.findIndex((vertex) => vertex.id === nextAngle.vertexId);
      const nextVertex = nextAngleIndexOrig !== -1 ? updated.vertices[nextAngleIndexOrig] : null;

      const distBetweenAngles = nextVertex ? distance(currentVertex, nextVertex) : Infinity;

      if (
        nextVertex
        && !skippedVertexIds.has(nextAngle.vertexId)
        && nextAngleIndexOrig !== currentIndex
        && distBetweenAngles < COLUMN_DISTANCE_THRESHOLD
        && distBetweenAngles < (2 * SPLIT_THRESHOLD_SHORT)
      ) {
        console.log('[COLUMN_SPLIT] Starting column split:', {
          currentIndex,
          nextAngleIndexOrig,
          distBetweenAngles,
          halfDistance: distBetweenAngles / 2
        });

        // Split the segment between the two angles into two equal halves
        // Split the adjacent segments so new segments near angles = half the distance
        const halfDistance = distBetweenAngles / 2;
        const incrementMm = (halfDistance * SHORT_INCREMENT_PERCENT) / 100;
        const incrementPercent = SHORT_INCREMENT_PERCENT;

        // Store original segment indices before any modifications
        const originalPrevSegIndex = prevSegIndex;
        const originalConnectingSegIndex = nextSegIndex;
        const currentPrevSegLength = getSegmentLength(updated, updated.segments[originalPrevSegIndex]);

        // Get next angle's connections before modifications
        const nextAngleConnectionsOrig = findConnectedSegmentIndices(updated, nextAngleIndexOrig);
        const nextNextSegLength = nextAngleConnectionsOrig.nextSegIndex !== -1
          ? getSegmentLength(updated, updated.segments[nextAngleConnectionsOrig.nextSegIndex])
          : 0;

        // Step 1: Split the segment connecting the two angles at half distance
        console.log('[COLUMN_SPLIT] Step 1: Split connecting segment at halfDistance:', halfDistance);
        const splitResult = splitSegmentAtDistance(updated, originalConnectingSegIndex, halfDistance);

        if (!splitResult) {
          // Cannot split, skip both angles
          markSkipped(angle.vertexId);
          markSkipped(nextAngle.vertexId);
          const nextConnectionsFallback = findConnectedSegmentIndices(updated, nextAngleIndexOrig);
          transformations.push({
            id: `t-skip-col-split-fail-${currentIndex}`,
            type: 'SKIPPED_COLUMN_SPLIT_FAILED',
            vertexIndex: currentIndex,
            vertexName: currentVertex.name,
            angleDegrees: angle.angle,
            prevSegmentIndex: prevSegIndex,
            nextSegmentIndex: nextSegIndex,
            fallbackUsed: true,
            reason: 'COLUMN_SPLIT_FAILED'
          });
          transformations.push({
            id: `t-skip-col-split-fail-${nextAngle.vertexId}`,
            type: 'SKIPPED_COLUMN_SPLIT_FAILED',
            vertexIndex: nextAngleIndexOrig,
            vertexName: nextVertex.name,
            angleDegrees: nextAngle.angle,
            prevSegmentIndex: nextConnectionsFallback.prevSegIndex,
            nextSegmentIndex: nextConnectionsFallback.nextSegIndex,
            fallbackUsed: true,
            reason: 'COLUMN_SPLIT_FAILED'
          });
          return;
        }

        // Step 2: Find updated indices after the split
        const currentIndexAfterSplit1 = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
        const nextAngleIndexAfterSplit1 = updated.vertices.findIndex((vertex) => vertex.id === nextAngle.vertexId);

        // Step 3: Split previous segment of current angle
        // We want the segment NEAR the angle to be halfDistance
        // So we split at: segmentLength - halfDistance (from start of segment)
        const currentConnectionsAfterSplit1 = findConnectedSegmentIndices(updated, currentIndexAfterSplit1);
        const currentPrevSegAfterSplit1 = updated.segments[currentConnectionsAfterSplit1.prevSegIndex];
        const currentPrevSegLengthAfterSplit = getSegmentLength(updated, currentPrevSegAfterSplit1);
        const splitDistanceCurrent = currentPrevSegLengthAfterSplit - halfDistance;

        console.log('[COLUMN_SPLIT] Step 3: Split prev segment of current angle');
        console.log('  currentPrevSegLengthAfterSplit:', currentPrevSegLengthAfterSplit);
        console.log('  splitDistanceCurrent:', splitDistanceCurrent);

        let prevSplitVertexCurrent = null;
        if (splitDistanceCurrent > SPLIT_EPSILON && currentPrevSegLengthAfterSplit > halfDistance) {
          const splitResultCurrent = splitSegmentAtDistance(
            updated,
            currentConnectionsAfterSplit1.prevSegIndex,
            splitDistanceCurrent
          );
          if (splitResultCurrent) {
            prevSplitVertexCurrent = splitResultCurrent.newVertex;
          }
        }

        // Step 4: Find updated indices again after second split
        const currentIndexAfterSplit2 = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
        const nextAngleIndexAfterSplit2 = updated.vertices.findIndex((vertex) => vertex.id === nextAngle.vertexId);

        // Step 5: Split next-next segment of next angle
        // We want the segment NEAR the angle to be halfDistance
        // So we split at: halfDistance (from start of segment, which is the angle vertex)
        const nextConnectionsAfterSplit2 = findConnectedSegmentIndices(updated, nextAngleIndexAfterSplit2);
        const nextNextSegForSplit = nextConnectionsAfterSplit2.nextSegIndex !== -1
          ? updated.segments[nextConnectionsAfterSplit2.nextSegIndex]
          : null;

        console.log('[COLUMN_SPLIT] Step 5: Split next-next segment of next angle');
        console.log('  nextNextSegForSplit:', nextNextSegForSplit ? 'exists' : 'null');
        if (nextNextSegForSplit) {
          const nextNextSegLengthAfterSplit = getSegmentLength(updated, nextNextSegForSplit);
          console.log('  nextNextSegLengthAfterSplit:', nextNextSegLengthAfterSplit);
        }

        let nextSplitVertexNext = null;
        if (nextNextSegForSplit) {
          const nextNextSegLengthAfterSplit = getSegmentLength(updated, nextNextSegForSplit);
          const splitDistanceNext = halfDistance;

          if (splitDistanceNext > SPLIT_EPSILON && nextNextSegLengthAfterSplit > halfDistance) {
            const splitResultNext = splitSegmentAtDistance(
              updated,
              nextConnectionsAfterSplit2.nextSegIndex,
              splitDistanceNext
            );
            if (splitResultNext) {
              nextSplitVertexNext = splitResultNext.newVertex;
            }
          }
        }

        // Step 6: Find final indices and segments for circle intersection
        const currentIndexFinal = updated.vertices.findIndex((vertex) => vertex.id === angle.vertexId);
        const nextAngleIndexFinal = updated.vertices.findIndex((vertex) => vertex.id === nextAngle.vertexId);
        const currentVertexFinal = updated.vertices[currentIndexFinal];
        const nextVertexFinal = updated.vertices[nextAngleIndexFinal];

        const currentConnectionsFinal = findConnectedSegmentIndices(updated, currentIndexFinal);
        const nextConnectionsFinal = findConnectedSegmentIndices(updated, nextAngleIndexFinal);

        // Get the segments connected to current angle
        const currentPrevSeg = updated.segments[currentConnectionsFinal.prevSegIndex];
        const currentNextSeg = updated.segments[currentConnectionsFinal.nextSegIndex];

        // Centers are the far vertices from the current angle:
        // - prevSeg ends at the angle, so startIndex is the far vertex
        // - nextSeg starts at the angle, so endIndex is the far vertex
        const prevCenter = updated.vertices[currentPrevSeg.startIndex];
        const nextCenter = updated.vertices[currentNextSeg.endIndex];

        console.log('[COLUMN_SPLIT] Step 6: Circle intersection setup');
        console.log('  prevCenter:', prevCenter);
        console.log('  nextCenter:', nextCenter);
        console.log('  currentPrevSeg.length:', currentPrevSeg.length);
        console.log('  currentNextSeg.length:', currentNextSeg.length);

        // Step 7: Calculate circle intersection for current angle
        // The segments adjacent to the angle should have length = halfDistance
        // After extension, they should have length = halfDistance + incrementMm
        const radiusPrev = halfDistance + incrementMm;
        const radiusNext = halfDistance + incrementMm;

        const preferredPoint = { x: currentVertexFinal.x, y: currentVertexFinal.y };
        const expectedSign = Math.sign(angle.cross || 0) || -1;

        const { point: intersectionPoint, fallbackUsed } = findCircleIntersection(
          prevCenter,
          radiusPrev,
          nextCenter,
          radiusNext,
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

        console.log('[COLUMN_SPLIT] Step 7: Circle intersection result');
        console.log('  radiusPrev:', radiusPrev, 'radiusNext:', radiusNext);
        console.log('  intersectionPoint:', intersectionPoint);
        console.log('  fallbackUsed:', fallbackUsed);
        console.log('  currentVertexFinal BEFORE:', { x: currentVertexFinal.x, y: currentVertexFinal.y });

        if (!intersectionPoint) {
          markSkipped(angle.vertexId);
          markSkipped(nextAngle.vertexId);
          transformations.push({
            id: `t-col-split-intersection-fail-${currentIndex}`,
            type: 'COLUMN_SPLIT_INTERSECTION_FAILED',
            vertexIndex: currentIndex,
            vertexName: currentVertex.name,
            angleDegrees: angle.angle,
            prevSegmentIndex: currentConnectionsFinal.prevSegIndex,
            nextSegmentIndex: currentConnectionsFinal.nextSegIndex,
            fallbackUsed: true,
            reason: 'CIRCLE_INTERSECTION_FAILED'
          });
          transformations.push({
            id: `t-col-split-intersection-fail-${nextAngle.vertexId}`,
            type: 'COLUMN_SPLIT_INTERSECTION_FAILED',
            vertexIndex: nextAngleIndexFinal,
            vertexName: nextVertex.name,
            angleDegrees: nextAngle.angle,
            prevSegmentIndex: nextConnectionsFinal.prevSegIndex,
            nextSegmentIndex: nextConnectionsFinal.nextSegIndex,
            fallbackUsed: true,
            reason: 'CIRCLE_INTERSECTION_FAILED'
          });
          return;
        }

        // Step 8: Move the current angle vertex to the intersection point
        console.log('[COLUMN_SPLIT] Step 8: Moving first angle vertex to intersection point');
        console.log('  currentVertexFinal BEFORE move:', { x: currentVertexFinal.x, y: currentVertexFinal.y });
        currentVertexFinal.x = intersectionPoint.x;
        currentVertexFinal.y = intersectionPoint.y;
        console.log('  currentVertexFinal AFTER move:', { x: currentVertexFinal.x, y: currentVertexFinal.y });

        // Step 9: Calculate circle intersection for SECOND angle
        // The second angle also needs to be extended
        const nextConnectionsForSecond = findConnectedSegmentIndices(updated, nextAngleIndexFinal);
        const nextPrevSegForSecond = updated.segments[nextConnectionsForSecond.prevSegIndex];
        const nextNextSegForSecond = nextConnectionsForSecond.nextSegIndex !== -1
          ? updated.segments[nextConnectionsForSecond.nextSegIndex]
          : null;

        // Centers for second angle:
        // - prevSeg ends at second angle, so startIndex is the far vertex (mid point)
        // - nextSeg starts at second angle, so endIndex is the far vertex
        const secondPrevCenter = updated.vertices[nextPrevSegForSecond.startIndex];
        const secondNextCenter = nextNextSegForSecond
          ? updated.vertices[nextNextSegForSecond.endIndex]
          : nextVertexFinal;

        const secondRadiusPrev = halfDistance + incrementMm;
        const secondRadiusNext = halfDistance + incrementMm;

        const secondPreferredPoint = { x: nextVertexFinal.x, y: nextVertexFinal.y };
        const secondExpectedSign = Math.sign(nextAngle.cross || 0) || -1;

        console.log('[COLUMN_SPLIT] Step 9: Second angle circle intersection setup');
        console.log('  secondPrevCenter:', secondPrevCenter);
        console.log('  secondNextCenter:', secondNextCenter);
        console.log('  nextPrevSegForSecond.length:', nextPrevSegForSecond.length);
        console.log('  nextNextSegForSecond.length:', nextNextSegForSecond ? nextNextSegForSecond.length : 'N/A');

        const { point: secondIntersectionPoint, fallbackUsed: secondFallbackUsed } = findCircleIntersection(
          secondPrevCenter,
          secondRadiusPrev,
          secondNextCenter,
          secondRadiusNext,
          {
            preferredPoint: secondPreferredPoint,
            expectedCrossSign: secondExpectedSign,
            crossCheck: (candidate) => {
              const cross = (secondPrevCenter.x - candidate.x) * (secondNextCenter.y - candidate.y)
                - (secondPrevCenter.y - candidate.y) * (secondNextCenter.x - candidate.x);
              return cross;
            }
          }
        );

        console.log('[COLUMN_SPLIT] Step 9: Second angle circle intersection result');
        console.log('  secondIntersectionPoint:', secondIntersectionPoint);
        console.log('  secondFallbackUsed:', secondFallbackUsed);

        if (!secondIntersectionPoint) {
          console.log('[COLUMN_SPLIT] WARNING: Second angle intersection failed, using fallback');
        }

        // Step 10: Move the second angle vertex to its intersection point
        console.log('[COLUMN_SPLIT] Step 10: Moving second angle vertex to intersection point');
        console.log('  nextVertexFinal BEFORE move:', { x: nextVertexFinal.x, y: nextVertexFinal.y });
        if (secondIntersectionPoint) {
          nextVertexFinal.x = secondIntersectionPoint.x;
          nextVertexFinal.y = secondIntersectionPoint.y;
        }
        console.log('  nextVertexFinal AFTER move:', { x: nextVertexFinal.x, y: nextVertexFinal.y });

        // Mark both angles as processed
        markSkipped(angle.vertexId);
        markSkipped(nextAngle.vertexId);

        // Recompute segment lengths after vertex moves
        recomputeSegments(updated);

        // Get final segment lengths for logging (first angle)
        const currentConnectionsAfterMove = findConnectedSegmentIndices(updated, currentIndexFinal);
        const finalPrevSeg = updated.segments[currentConnectionsAfterMove.prevSegIndex];
        const finalNextSeg = updated.segments[currentConnectionsAfterMove.nextSegIndex];

        // Get final segment lengths for logging (second angle)
        const nextConnectionsAfterMove = findConnectedSegmentIndices(updated, nextAngleIndexFinal);
        const nextFinalPrevSeg = updated.segments[nextConnectionsAfterMove.prevSegIndex];
        const nextFinalNextSeg = nextConnectionsAfterMove.nextSegIndex !== -1
          ? updated.segments[nextConnectionsAfterMove.nextSegIndex]
          : null;

        console.log('[COLUMN_SPLIT] Final segment lengths after move:');
        console.log('  First angle - prev:', finalPrevSeg.length.toFixed(2), 'next:', finalNextSeg.length.toFixed(2), '(expected:', radiusPrev.toFixed(2), ')');
        console.log('  Second angle - prev:', nextFinalPrevSeg.length.toFixed(2), 'next:', nextFinalNextSeg ? nextFinalNextSeg.length.toFixed(2) : 'N/A', '(expected:', secondRadiusPrev.toFixed(2), ')');

        transformations.push({
          id: `t-col-split-${currentIndex}`,
          type: 'COLUMN_SPLIT',
          vertexIndex: currentIndexFinal,
          vertexName: currentVertexFinal.name,
          angleDegrees: angle.angle,
          prevSegmentIndex: currentConnectionsFinal.prevSegIndex,
          nextSegmentIndex: currentConnectionsFinal.nextSegIndex,
          prevSegmentLength: currentPrevSegLength,
          nextSegmentLength: distBetweenAngles,
          halfDistance,
          incrementMm,
          incrementPercent,
          newVertex: { ...currentVertexFinal },
          prevSplitVertex: prevSplitVertexCurrent ? { ...prevSplitVertexCurrent } : null,
          nextSplitVertex: nextSplitVertexNext ? { ...nextSplitVertexNext } : null,
          fallbackUsed,
          reason: 'COLUMN_SPLIT_SHORT_DISTANCE',
          pairedVertexIndex: nextAngleIndexFinal
        });
        transformations.push({
          id: `t-col-split-${nextAngle.vertexId}`,
          type: 'COLUMN_SPLIT',
          vertexIndex: nextAngleIndexFinal,
          vertexName: nextVertexFinal.name,
          angleDegrees: nextAngle.angle,
          prevSegmentIndex: nextConnectionsFinal.prevSegIndex,
          nextSegmentIndex: nextConnectionsFinal.nextSegIndex,
          prevSegmentLength: distBetweenAngles,
          nextSegmentLength: nextNextSegLength,
          halfDistance,
          incrementMm,
          incrementPercent,
          newVertex: { ...nextVertexFinal },
          fallbackUsed: secondFallbackUsed,
          reason: 'COLUMN_SPLIT_SHORT_DISTANCE',
          pairedVertexIndex: currentIndexFinal
        });

        // Skip further processing of this angle (already handled)
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

  console.log('[TRANSFORM] After all processing - vertex positions:');
  updated.vertices.forEach((v, i) => {
    console.log(`  Vertex ${i} (${v.name}):`, { x: v.x, y: v.y });
  });
  console.log('[TRANSFORM] After all processing - segment lengths:');
  updated.segments.forEach((s, i) => {
    console.log(`  Segment ${i}: length=${s.length.toFixed(2)}, start=${s.startIndex}, end=${s.endIndex}`);
  });

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
