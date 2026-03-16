import { parseGlc } from '../utils/glcParser.js';
import { buildGlcBytes } from '../utils/glcBuilder.js';
import { findInternalAngles } from './AngleFinder.js';
import { transformContour } from './ContourTransformer.js';
import { DEFAULT_STRETCH_PERCENT } from '../utils/config.js';
import { createProcessingLog, logProcessing } from '../utils/processingLogger.js';

export function processGlcFile(arrayBuffer, fileName, options = {}) {
  const start = performance.now();
  const parsed = parseGlc(arrayBuffer);
  const geometryErrors = [];

  if (parsed.errors.some((err) => err.severity === 'error')) {
    const durationMs = Math.round(performance.now() - start);
    const log = createProcessingLog({
      fileName,
      results: [],
      errors: parsed.errors,
      durationMs,
      totalContours: 0,
      totalVertices: 0
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
    totalVertices
  });
  logProcessing(log);

  return {
    parsed,
    results,
    outputBytes,
    log
  };
}
