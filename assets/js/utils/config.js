const DEFAULT_SETTINGS = {
  column_distance_threshold: 250,
  min_skip_length: 40,
  split_threshold_short: 110,
  near_angle_segment: 100,
  short_increment_percent: 10,
  near_increment_mm: 20,
  default_stretch_percent: 10
};

function readSettings() {
  if (typeof window === 'undefined') {
    return {};
  }
  const config = window.vertexflowConfig;
  if (!config || typeof config !== 'object') {
    return {};
  }
  return config.settings || {};
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function getCalculatedConfig() {
  const settings = readSettings();
  return {
    column_distance_threshold: normalizeNumber(
      settings.column_distance_threshold,
      DEFAULT_SETTINGS.column_distance_threshold
    ),
    min_skip_length: normalizeNumber(
      settings.min_skip_length,
      DEFAULT_SETTINGS.min_skip_length
    ),
    split_threshold_short: normalizeNumber(
      settings.split_threshold_short,
      DEFAULT_SETTINGS.split_threshold_short
    ),
    near_angle_segment: normalizeNumber(
      settings.near_angle_segment,
      DEFAULT_SETTINGS.near_angle_segment
    ),
    short_increment_percent: normalizeNumber(
      settings.short_increment_percent,
      DEFAULT_SETTINGS.short_increment_percent
    ),
    near_increment_mm: normalizeNumber(
      settings.near_increment_mm,
      DEFAULT_SETTINGS.near_increment_mm
    ),
    default_stretch_percent: normalizeNumber(
      settings.default_stretch_percent,
      DEFAULT_SETTINGS.default_stretch_percent
    )
  };
}

const calculatedConfig = getCalculatedConfig();

export const COLUMN_DISTANCE_THRESHOLD = calculatedConfig.column_distance_threshold; // mm
export const MIN_SKIP_LENGTH = calculatedConfig.min_skip_length; // mm
export const SPLIT_THRESHOLD_SHORT = calculatedConfig.split_threshold_short; // mm
export const NEAR_ANGLE_SEGMENT = calculatedConfig.near_angle_segment; // mm
export const SHORT_INCREMENT_PERCENT = calculatedConfig.short_increment_percent; // percent
export const NEAR_INCREMENT_MM = calculatedConfig.near_increment_mm; // mm
export const DEFAULT_STRETCH_PERCENT = calculatedConfig.default_stretch_percent; // percent

export const CIRCLE_INTERSECTION_EPSILON = 0.1; // mm
export const CIRCLE_INTERSECTION_MAX_ITERATIONS = 1000;

export const DEFAULT_ZOOM_MIN = 0.1;
export const DEFAULT_ZOOM_MAX = 10;

export default {
  COLUMN_DISTANCE_THRESHOLD,
  MIN_SKIP_LENGTH,
  SPLIT_THRESHOLD_SHORT,
  NEAR_ANGLE_SEGMENT,
  SHORT_INCREMENT_PERCENT,
  NEAR_INCREMENT_MM,
  DEFAULT_STRETCH_PERCENT,
  CIRCLE_INTERSECTION_EPSILON,
  CIRCLE_INTERSECTION_MAX_ITERATIONS,
  DEFAULT_ZOOM_MIN,
  DEFAULT_ZOOM_MAX
};
