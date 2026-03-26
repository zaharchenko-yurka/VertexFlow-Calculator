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
require_once plugin_dir_path(__FILE__) . 'includes/admin/settings-defaults.php';
require_once plugin_dir_path(__FILE__) . 'includes/admin/class-admin-settings.php';

register_activation_hook(__FILE__, ['VertexFlow_Calculator_Activator', 'activate']);
register_deactivation_hook(__FILE__, ['VertexFlow_Calculator_Deactivator', 'deactivate']);

if (is_admin()) {
  new VertexFlow_Calculator_Admin_Settings();
}

function vertexflow_calculator_asset_version($relative_path) {
  $full_path = plugin_dir_path(__FILE__) . ltrim($relative_path, '/\\');
  if (file_exists($full_path)) {
    return (string) filemtime($full_path);
  }
  return VERTEXFLOW_CALCULATOR_VERSION;
}

function vertexflow_calculator_directory_version($relative_path) {
  $full_path = plugin_dir_path(__FILE__) . ltrim($relative_path, '/\\');
  if (!is_dir($full_path)) {
    return vertexflow_calculator_asset_version($relative_path);
  }

  $max_mtime = 0;
  $iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($full_path, FilesystemIterator::SKIP_DOTS)
  );

  foreach ($iterator as $file) {
    if ($file->isFile()) {
      $mtime = $file->getMTime();
      if ($mtime > $max_mtime) {
        $max_mtime = $mtime;
      }
    }
  }

  return $max_mtime > 0 ? (string) $max_mtime : VERTEXFLOW_CALCULATOR_VERSION;
}

function vertexflow_calculator_enqueue_assets() {
  $base_url = plugin_dir_url(__FILE__);
  $style_version = vertexflow_calculator_asset_version('assets/css/style.css');
  $app_version = vertexflow_calculator_directory_version('assets/js');
  wp_enqueue_style(
    'vertexflow-calculator-style',
    $base_url . 'assets/css/style.css',
    [],
    $style_version
  );

  wp_enqueue_script(
    'vertexflow-calculator-app',
    $base_url . 'assets/js/app.js',
    [],
    $app_version,
    true
  );

  $settings = VertexFlow_Calculator_Admin_Settings::get_settings();
  $reset_notice = VertexFlow_Calculator_Admin_Settings::consume_reset_notice();
  wp_localize_script('vertexflow-calculator-app', 'vertexflowConfig', [
    'settings' => $settings,
    'settingsResetNotice' => $reset_notice
  ]);
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
