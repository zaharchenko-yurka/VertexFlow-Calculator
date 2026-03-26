<?php

class VertexFlow_Calculator_Activator {
  public static function activate() {
    require_once plugin_dir_path(__FILE__) . 'admin/settings-defaults.php';

    if (get_option('vertexflow_calculator_settings', null) === null) {
      update_option('vertexflow_calculator_settings', get_vertexflow_default_settings());
    }
  }
}
