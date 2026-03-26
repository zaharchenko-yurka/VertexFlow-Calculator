<?php

if (!defined('ABSPATH')) {
  exit;
}

function get_vertexflow_default_settings() {
  return [
    'column_distance_threshold' => 250,
    'min_skip_length' => 40,
    'split_threshold_short' => 110,
    'near_angle_segment' => 100,
    'short_increment_percent' => 10,
    'near_increment_mm' => 20,
    'default_stretch_percent' => 10
  ];
}
