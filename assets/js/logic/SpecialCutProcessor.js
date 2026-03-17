import { parseGlc } from '../utils/glcParser.js';
import { buildGlcBytes } from '../utils/glcBuilder.js';
import { findInternalAngles } from './AngleFinder.js';
import { transformContour, CONTOUR_TRANSFORMER_VERSION } from './ContourTransformer.js';
import { DEFAULT_STRETCH_PERCENT } from '../utils/config.js';
import { createProcessingLog, logProcessing } from '../utils/processingLogger.js';

const PROCESSOR_VERSION = '2026-03-17-debug-v1';

function analyzeContourTopology(contour) {
  const vertexCount = contour.vertices.length;
  const segmentCount = contour.segments.length;
  const incoming = new Array(vertexCount).fill(0);
  const outgoing = new Array(vertexCount).fill(0);
  const invalidSegments = [];
  const duplicateDirectedEdges = [];
  const seenEdges = new Set();

  contour.segments.forEach((segment, index) => {
    const start = segment.startIndex;
    const end = segment.endIndex;
    const startValid = Number.isInteger(start) && start >= 0 && start < vertexCount;
    const endValid = Number.isInteger(end) && end >= 0 && end < vertexCount;

    if (!startValid || !endValid) {
      invalidSegments.push({
        segmentIndex: index,
        startIndex: start,
        endIndex: end
      });
      return;
    }

    outgoing[start] += 1;
    incoming[end] += 1;

    const edgeKey = `${start}->${end}`;
    if (seenEdges.has(edgeKey)) {
      duplicateDirectedEdges.push(edgeKey);
    } else {
      seenEdges.add(edgeKey);
    }
  });

  const brokenVertices = [];
  for (let i = 0; i < vertexCount; i += 1) {
    if (incoming[i] !== 1 || outgoing[i] !== 1) {
      brokenVertices.push({
        vertexIndex: i,
        incoming: incoming[i],
        outgoing: outgoing[i]
      });
    }
  }

  return {
    vertexCount,
    segmentCount,
    invalidSegments,
    duplicateDirectedEdges,
    brokenVertices,
    isClosedRing: invalidSegments.length === 0 && duplicateDirectedEdges.length === 0 && brokenVertices.length === 0
  };
}

export function processGlcFile(arrayBuffer, fileName, options = {}) {
  const start = performance.now();
  const parsed = parseGlc(arrayBuffer);
  const geometryErrors = [];
  const logDebugBase = {
    processorVersion: PROCESSOR_VERSION,
    transformerVersion: CONTOUR_TRANSFORMER_VERSION,
    optionsUsed: {
      skipColumns: options.skipColumns !== false
    }
  };

  if (parsed.errors.some((err) => err.severity === 'error')) {
    const durationMs = Math.round(performance.now() - start);
    const log = createProcessingLog({
      fileName,
      results: [],
      errors: parsed.errors,
      durationMs,
      totalContours: 0,
      totalVertices: 0,
      debug: logDebugBase
    });
    logProcessing(log);
    return {
      parsed,
      results: [],
      outputBytes: null,
      log
    };
  }

  const results = [];

  parsed.rooms.forEach((room) => {
    const contour = room.contour;
    const inputVertexCount = contour.vertices.length;
    const inputSegmentCount = contour.segments.length;
    const internalAngles = findInternalAngles(contour);
    const transformed = transformContour(contour, internalAngles, options);

    room.contour = transformed.contour;

    transformed.transformations.forEach((transformation) => {
      if (transformation.reason === 'CIRCLE_INTERSECTION_FAILED') {
        geometryErrors.push({
          code: 'CIRCLE_INTERSECTION_FAILED',
          message: 'Не вдалося знайти перетин окружностей для одного з кутів.',
          contourId: contour.id,
          vertexIndex: transformation.vertexIndex,
          severity: 'warning'
        });
      }
    });

    results.push({
      contourId: contour.id,
      wasModified: transformed.processedCount > 0,
      internalAnglesFound: transformed.internalAnglesFound,
      internalAnglesProcessed: transformed.processedCount,
      internalAnglesSkipped: transformed.skippedCount,
      transformations: transformed.transformations,
      debug: {
        transformerVersion: CONTOUR_TRANSFORMER_VERSION,
        inputVertexCount,
        inputSegmentCount,
        outputVertexCount: transformed.contour.vertices.length,
        outputSegmentCount: transformed.contour.segments.length,
        topology: analyzeContourTopology(transformed.contour)
      },
      stretchParamPer: DEFAULT_STRETCH_PERCENT,
      stretchParamPer2: DEFAULT_STRETCH_PERCENT
    });
  });

  const outputBytes = buildGlcBytes(parsed);
  const durationMs = Math.round(performance.now() - start);
  const totalVertices = parsed.rooms.reduce((sum, room) => sum + room.contour.vertices.length, 0);

  const log = createProcessingLog({
    fileName,
    results,
    errors: [...parsed.errors, ...geometryErrors],
    durationMs,
    totalContours: parsed.rooms.length,
    totalVertices,
    debug: logDebugBase
  });
  logProcessing(log);

  return {
    parsed,
    results,
    outputBytes,
    log
  };
}
