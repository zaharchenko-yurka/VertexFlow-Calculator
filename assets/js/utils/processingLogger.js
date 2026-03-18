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
