<?php

if (!defined('ABSPATH')) {
  exit;
}

class VertexFlow_Calculator_Admin_Settings {
  const OPTION_NAME = 'vertexflow_calculator_settings';
  const RESET_NOTICE_OPTION = 'vertexflow_calculator_settings_reset_notice';
  const SETTINGS_GROUP = 'vertexflow_calculator_settings_group';
  const SETTINGS_PAGE_SLUG = 'vertexflow-calculator-settings';

  public function __construct() {
    add_action('admin_menu', [$this, 'add_admin_menu']);
    add_action('admin_init', [$this, 'register_settings']);
    add_action('admin_post_vertexflow_reset_settings', [$this, 'handle_reset']);
    add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
  }

  public static function get_settings() {
    $defaults = get_vertexflow_default_settings();
    $settings = get_option(self::OPTION_NAME, null);

    if (!is_array($settings)) {
      update_option(self::OPTION_NAME, $defaults);
      update_option(self::RESET_NOTICE_OPTION, 1);
      return $defaults;
    }

    $merged = array_merge($defaults, $settings);
    $sanitized = self::sanitize_settings($merged);

    if ($sanitized != $settings) {
      update_option(self::OPTION_NAME, $sanitized);
    }

    return $sanitized;
  }

  public static function consume_reset_notice() {
    $flag = (bool) get_option(self::RESET_NOTICE_OPTION, false);
    if ($flag) {
      delete_option(self::RESET_NOTICE_OPTION);
    }
    return $flag;
  }

  public function add_admin_menu() {
    add_options_page(
      'VertexFlow Calculator',
      'VertexFlow Calculator',
      'manage_options',
      self::SETTINGS_PAGE_SLUG,
      [$this, 'render_settings_page']
    );
  }

  public function register_settings() {
    register_setting(
      self::SETTINGS_GROUP,
      self::OPTION_NAME,
      [
        'type' => 'array',
        'sanitize_callback' => [self::class, 'sanitize_settings'],
        'default' => get_vertexflow_default_settings()
      ]
    );

    add_settings_section(
      'vertexflow_calculator_main',
      '',
      '__return_null',
      self::SETTINGS_PAGE_SLUG
    );

    foreach (self::get_fields() as $field) {
      add_settings_field(
        $field['id'],
        $field['label'],
        [$this, 'render_field'],
        self::SETTINGS_PAGE_SLUG,
        'vertexflow_calculator_main',
        $field
      );
    }
  }

  public function render_settings_page() {
    if (!current_user_can('manage_options')) {
      return;
    }

    $reset_notice = isset($_GET['settings-reset']) ? true : false;
    ?>
    <div class="wrap vertexflow-settings">
      <h1>VertexFlow Calculator</h1>
      <?php if ($reset_notice) : ?>
        <div class="notice notice-success is-dismissible">
          <p>Налаштування скинуто до значень за замовчуванням.</p>
        </div>
      <?php endif; ?>
      <form method="post" action="options.php">
        <?php
          settings_fields(self::SETTINGS_GROUP);
          do_settings_sections(self::SETTINGS_PAGE_SLUG);
          submit_button('Зберегти');
        ?>
      </form>
      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('vertexflow_reset_settings', 'vertexflow_reset_nonce'); ?>
        <input type="hidden" name="action" value="vertexflow_reset_settings" />
        <?php submit_button('Скинути до дефолтних', 'secondary', 'submit', false, [
          'onclick' => "return confirm('Скинути всі налаштування до значень за замовчуванням?');"
        ]); ?>
      </form>
    </div>
    <?php
  }

  public function render_field($field) {
    $settings = self::get_settings();
    $id = $field['id'];
    $value = isset($settings[$id]) ? $settings[$id] : '';
    $step = isset($field['step']) ? $field['step'] : '1';
    $min = isset($field['min']) ? $field['min'] : '0';
    ?>
      <input
        type="number"
        id="<?php echo esc_attr($id); ?>"
        name="<?php echo esc_attr(self::OPTION_NAME); ?>[<?php echo esc_attr($id); ?>]"
        value="<?php echo esc_attr($value); ?>"
        step="<?php echo esc_attr($step); ?>"
        min="<?php echo esc_attr($min); ?>"
        class="small-text"
      />
    <?php
  }

  public function handle_reset() {
    if (!current_user_can('manage_options')) {
      wp_die('Insufficient permissions.');
    }

    check_admin_referer('vertexflow_reset_settings', 'vertexflow_reset_nonce');

    update_option(self::OPTION_NAME, get_vertexflow_default_settings());
    update_option(self::RESET_NOTICE_OPTION, 1);

    wp_safe_redirect(add_query_arg(
      'settings-reset',
      'true',
      admin_url('options-general.php?page=' . self::SETTINGS_PAGE_SLUG)
    ));
    exit;
  }

  public function enqueue_admin_assets($hook) {
    if ($hook !== 'settings_page_' . self::SETTINGS_PAGE_SLUG) {
      return;
    }

    wp_register_style('vertexflow-admin-settings', false);
    wp_enqueue_style('vertexflow-admin-settings');
    wp_add_inline_style('vertexflow-admin-settings', '.vertexflow-settings .form-table th{width:340px;}');
  }

  public static function sanitize_settings($input) {
    $defaults = get_vertexflow_default_settings();
    if (!is_array($input)) {
      return $defaults;
    }

    $sanitized = [];
    foreach ($defaults as $key => $default) {
      if (isset($input[$key]) && is_numeric($input[$key])) {
        $sanitized[$key] = $input[$key] + 0;
      } else {
        $sanitized[$key] = $default;
      }
    }

    return $sanitized;
  }

  private static function get_fields() {
    return [
      [
        'id' => 'column_distance_threshold',
        'label' => 'Порогова ширина колони (мм)',
        'step' => '1',
        'min' => '0'
      ],
      [
        'id' => 'min_skip_length',
        'label' => 'Мінімальна довжина обробляємого кута (мм)',
        'step' => '1',
        'min' => '0'
      ],
      [
        'id' => 'split_threshold_short',
        'label' => 'Якщо довжина сегмента більше... (мм)',
        'step' => '1',
        'min' => '0'
      ],
      [
        'id' => 'near_angle_segment',
        'label' => '...створювати сегмент довжиною... (мм)',
        'step' => '1',
        'min' => '0'
      ],
            [
        'id' => 'near_increment_mm',
        'label' => '...і збільшувати його на (мм)',
        'step' => '1',
        'min' => '0'
      ],
      [
        'id' => 'short_increment_percent',
        'label' => 'Збільшувати короткий сегмент на (%)',
        'step' => '1',
        'min' => '0'
      ],
      [
        'id' => 'default_stretch_percent',
        'label' => 'Усадка для стель зі спецрозкроєм (%)',
        'step' => '1',
        'min' => '0'
      ]
    ];
  }
}
