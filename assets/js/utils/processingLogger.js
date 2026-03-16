export function createProcessingLog({
  fileName,
  results,
  errors,
  durationMs,
  totalContours,
  totalVertices
}) {
  return {
    timestamp: new Date().toISOString(),
    fileName,
    totalContours,
    totalVertices,
    results,
    errors,
    durationMs
  };
}

export function logProcessing(log) {
  if (typeof console === 'undefined') {
    return;
  }
  console.log('[VertexFlow] Processing log', log);
}

export function exportLogToJson(log) {
  return JSON.stringify(log, null, 2);
}
