<?php
/**
 * Plugin Name: VertexFlow Calculator
 * Description: Калькулятор спецрозкрою внутрішніх кутів для GLC-файлів.
 * Version: 1.0.0
 * Author: VertexFlow
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
  exit;
}

define('VERTEXFLOW_CALCULATOR_VERSION', '1.0.0');

require_once plugin_dir_path(__FILE__) . 'includes/class-activator.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-deactivator.php';

register_activation_hook(__FILE__, ['VertexFlow_Calculator_Activator', 'activate']);
register_deactivation_hook(__FILE__, ['VertexFlow_Calculator_Deactivator', 'deactivate']);

function vertexflow_calculator_enqueue_assets() {
  $base_url = plugin_dir_url(__FILE__);
  wp_enqueue_style(
    'vertexflow-calculator-style',
    $base_url . 'assets/css/style.css',
    [],
    VERTEXFLOW_CALCULATOR_VERSION
  );

  wp_enqueue_script(
    'vertexflow-calculator-app',
    $base_url . 'assets/js/app.js',
    [],
    VERTEXFLOW_CALCULATOR_VERSION,
    true
  );
}

function vertexflow_calculator_shortcode() {
  vertexflow_calculator_enqueue_assets();
  return '<div id="vertexflow-calculator"></div>';
}

add_shortcode('vertexflow_calculator', 'vertexflow_calculator_shortcode');

add_filter('script_loader_tag', function ($tag, $handle, $src) {
  if ($handle === 'vertexflow-calculator-app') {
    return '<script type="module" src="' . esc_url($src) . '"></script>';
  }
  return $tag;
}, 10, 3);
