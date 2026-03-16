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
  const startVertex = contour.vertices[segment.startIndex];
  const endVertex = contour.vertices[segment.endIndex];
  
  // Calculate the new vertex position
  const newVertexPos = pointAlongSegment(startVertex, endVertex, distanceFromStart);
  
  // Create new vertex
  const newVertex = {
    id: `split-${segmentIndex}-${Date.now()}`,
    name: '', // Will be renamed later
    x: newVertexPos.x,
    y: newVertexPos.y,
    isAnglePoint: false,
    originalIndex: segment.startIndex
  };
  
  // Insert new vertex at the position after startVertex
  const insertIndex = segment.startIndex + 1;
  contour.vertices.splice(insertIndex, 0, newVertex);
  
  // The segment indices after insertion:
  // - The original segment now ends at the new vertex (its endIndex increased by 1)
  // - We need to create a new segment from new vertex to the original end vertex
  const newSegmentStartIndex = insertIndex;
  const newSegmentEndIndex = segment.endIndex + 1; // Original end index shifted by 1
  
  // Update original segment to end at new vertex
  segment.endIndex = newSegmentStartIndex;
  segment.length = distanceFromStart;
  segment.hasArc = false;
  segment.arcInfo = null;
  
  // Create new segment from new vertex to original end
  const newSegment = {
    id: `seg-split-${segmentIndex}-${Date.now()}`,
    startIndex: newSegmentStartIndex,
    endIndex: newSegmentEndIndex,
    length: distance(newVertex, endVertex),
    hasArc: false,
    metadata: {}
  };
  
  // Insert the new segment after the original segment
  contour.segments.splice(segmentIndex + 1, 0, newSegment);
  
  console.log(`[SPLIT] Segment ${segmentIndex} split at ${distanceFromStart.toFixed(1)}mm`);
  console.log(`        New vertex at (${newVertex.x.toFixed(1)}, ${newVertex.y.toFixed(1)})`);
  console.log(`        Original segment now: ${segment.startIndex} -> ${segment.endIndex} (${segment.length.toFixed(1)}mm)`);
  console.log(`        New segment: ${newSegment.startIndex} -> ${newSegment.endIndex} (${newSegment.length.toFixed(1)}mm)`);
  
  return {
    newVertex,
    newVertexIndex: insertIndex,
    newSegment,
    originalSegment: segment
  };
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

    // FIX: Calculate split points on segments BEFORE finding circle intersection
    // According to FR-005:
    // - Short segment case: split longer segment so new adjacent segment = shorter segment length
    // - Normal case: split both segments at 100mm from corner
    // These split points become the circle centers, NOT the original vertices
    const prevSplitPoint = pointAlongSegment(currentVertex, prevVertex, basePrev);
    const nextSplitPoint = pointAlongSegment(currentVertex, nextVertex, baseNext);

    console.log(`[FIX] Split points: prevSplit at ${basePrev.toFixed(1)}mm from corner, nextSplit at ${baseNext.toFixed(1)}mm from corner`);
    console.log(`       prevSplitPoint: (${prevSplitPoint.x.toFixed(1)}, ${prevSplitPoint.y.toFixed(1)})`);
    console.log(`       nextSplitPoint: (${nextSplitPoint.x.toFixed(1)}, ${nextSplitPoint.y.toFixed(1)})`);

    // ACTUALLY split the segments by inserting new vertices into the contour
    // This creates the visual split points that should appear on the preview
    console.log(`[SPLIT] About to split segments for angle at index ${currentIndex}...`);
    console.log(`        Current vertices count: ${updated.vertices.length}`);
    console.log(`        Current segments count: ${updated.segments.length}`);
    
    // Split prev segment (from currentIndex-1 to currentIndex)
    // Note: prevSegIndex connects (currentIndex-1) -> currentIndex
    const prevSplitResult = splitSegmentAtDistance(updated, prevSegIndex, basePrev);
    
    // After splitting prev segment, the vertex indices shift if we inserted before currentIndex
    // But since we split at prevSeg which ends at currentIndex, the insertion is at currentIndex
    // Recalculate indices for next segment split
    // The next segment goes from currentIndex -> currentIndex+1
    // Since we may have added a vertex, we need to recalculate nextSegIndex
    const newNextSegIndex = currentIndex; // The segment after current vertex
    const nextSplitResult = splitSegmentAtDistance(updated, newNextSegIndex, baseNext);
    
    console.log(`[SPLIT] After splitting:`);
    console.log(`        New vertices count: ${updated.vertices.length}`);
    console.log(`        New segments count: ${updated.segments.length}`);
    
    // After splitting, the current vertex index CHANGES because we inserted new vertices before it
    // The original vertex at currentIndex is now at currentIndex + 2 (we inserted 2 vertices)
    // We need to find the current vertex's NEW index
    // The new split vertices are at prevSplitResult.newVertexIndex and nextSplitResult.newVertexIndex
    // The current vertex should be between them
    const newCurrentIndex = prevSplitResult.newVertexIndex + 1;
    const currentVertexAfterSplit = updated.vertices[newCurrentIndex];
    
    console.log(`[INDEX] Original currentIndex: ${currentIndex}, newCurrentIndex: ${newCurrentIndex}`);
    console.log(`[INDEX] Current vertex after split: ${currentVertexAfterSplit.name} at (${currentVertexAfterSplit.x.toFixed(1)}, ${currentVertexAfterSplit.y.toFixed(1)})`);
    
    // The split points are now at indices: prevSplitResult.newVertexIndex and nextSplitResult.newVertexIndex
    const prevSplitVertex = updated.vertices[prevSplitResult.newVertexIndex];
    const nextSplitVertex = updated.vertices[nextSplitResult.newVertexIndex];
    
    console.log(`[SPLIT] Prev split vertex index: ${prevSplitResult.newVertexIndex}, position: (${prevSplitVertex.x.toFixed(1)}, ${prevSplitVertex.y.toFixed(1)})`);
    console.log(`[SPLIT] Next split vertex index: ${nextSplitResult.newVertexIndex}, position: (${nextSplitVertex.x.toFixed(1)}, ${nextSplitVertex.y.toFixed(1)})`);

    const preferredPoint = { x: currentVertexAfterSplit.x, y: currentVertexAfterSplit.y };
    const expectedSign = Math.sign(angle.cross || 0) || -1;

    // DEBUG: Log circle parameters to diagnose intersection failure
    // Now using the actual split vertices from the contour
    const radius1 = basePrev + incrementMm;
    const radius2 = baseNext + incrementMm;
    const centerDistance = distance(prevSplitVertex, nextSplitVertex);
    console.log(`[DEBUG] Angle ${newCurrentIndex} (${currentVertexAfterSplit.name}):`);
    console.log(`  Segment lengths: prev=${prevLen.toFixed(1)}mm, next=${nextLen.toFixed(1)}mm`);
    console.log(`  Type: ${type}`);
    console.log(`  Radii: r1=${radius1.toFixed(1)}mm, r2=${radius2.toFixed(1)}mm`);
    console.log(`  Centers: prevSplitVertex at (${prevSplitVertex.x.toFixed(1)}, ${prevSplitVertex.y.toFixed(1)})`);
    console.log(`          nextSplitVertex at (${nextSplitVertex.x.toFixed(1)}, ${nextSplitVertex.y.toFixed(1)})`);
    console.log(`  Center distance: ${centerDistance.toFixed(1)}mm`);
    console.log(`  Sum of radii: ${(radius1 + radius2).toFixed(1)}mm`);
    console.log(`  Can intersect: ${centerDistance <= radius1 + radius2 ? 'YES' : 'NO - TOO FAR APART'}`);

    const { point, fallbackUsed, iterations } = findCircleIntersection(
      prevSplitVertex,
      basePrev + incrementMm,
      nextSplitVertex,
      baseNext + incrementMm,
      {
        preferredPoint,
        expectedCrossSign: expectedSign,
        crossCheck: (candidate) => {
          const cross = (prevSplitVertex.x - candidate.x) * (nextSplitVertex.y - candidate.y)
            - (prevSplitVertex.y - candidate.y) * (nextSplitVertex.x - candidate.x);
          return cross;
        }
      }
    );
    
    // DEBUG: Log detailed intersection result
    console.log(`  Circle intersection result: point=${point ? `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})` : 'null'}, fallbackUsed=${fallbackUsed}, iterations=${iterations}`);

    if (!point) {
      console.log(`  RESULT: Circle intersection FAILED (fallbackUsed=${fallbackUsed})`);
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

    currentVertexAfterSplit.x = point.x;
    currentVertexAfterSplit.y = point.y;
    console.log(`  RESULT: SUCCESS - new vertex at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    
    // After splitting, we need to find the segments that now connect to currentVertex
    // The segment before currentVertex now ends at currentVertex (was split)
    // The segment after currentVertex now starts at currentVertex (was split)
    // Let's find and update them
    console.log(`[UPDATE] Looking for segments connected to vertex index ${newCurrentIndex}...`);
    console.log(`[UPDATE] Total segments: ${updated.segments.length}, iterating...`);
    
    const updatedPrevSegIndex = updated.segments.findIndex(
      (s, i) => {
        const found = s.endIndex === newCurrentIndex;
        if (found) console.log(`[UPDATE] Found prev segment at index ${i}: start=${s.startIndex}, end=${s.endIndex}`);
        return found;
      }
    );
    const updatedNextSegIndex = updated.segments.findIndex(
      (s, i) => {
        const found = s.startIndex === newCurrentIndex;
        if (found) console.log(`[UPDATE] Found next segment at index ${i}: start=${s.startIndex}, end=${s.endIndex}`);
        return found;
      }
    );
    
    console.log(`[UPDATE] Result: updatedPrevSegIndex=${updatedPrevSegIndex}, updatedNextSegIndex=${updatedNextSegIndex}`);
    
    if (updatedPrevSegIndex !== -1) {
      updated.segments[updatedPrevSegIndex].hasArc = false;
      updated.segments[updatedPrevSegIndex].arcInfo = null;
      console.log(`[UPDATE] Updated prev segment at index ${updatedPrevSegIndex}`);
    }
    if (updatedNextSegIndex !== -1) {
      updated.segments[updatedNextSegIndex].hasArc = false;
      updated.segments[updatedNextSegIndex].arcInfo = null;
      console.log(`[UPDATE] Updated next segment at index ${updatedNextSegIndex}`);
    }

    transformations.push({
      id: `t-${newCurrentIndex}`,
      type,
      vertexIndex: newCurrentIndex,
      vertexName: currentVertexAfterSplit.name,
      angleDegrees: angle.angle,
      prevSegmentIndex: updatedPrevSegIndex !== -1 ? updatedPrevSegIndex : prevSegIndex,
      nextSegmentIndex: updatedNextSegIndex !== -1 ? updatedNextSegIndex : newNextSegIndex,
      prevSegmentLength: prevLen,
      nextSegmentLength: nextLen,
      incrementMm,
      incrementPercent,
      newVertex: { ...currentVertexAfterSplit },
      prevSplitVertex: { ...prevSplitVertex },
      nextSplitVertex: { ...nextSplitVertex },
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
