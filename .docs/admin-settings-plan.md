# План: Адмінська сторінка налаштувань плагіна

## Мета
Винести налаштування калькулятора з файлу `assets/js/utils/config.js` на сторінку в адмін-панелі WordPress (меню "Налаштування").

---

## Архітектура

### Зберігання даних
- Всі 7 параметрів зберігаються в `wp_options` як один масив
- Опція: `vertexflow_calculator_settings`
- Структура:
```php
[
    'column_distance_threshold' => 250,
    'min_skip_length' => 40,
    'split_threshold_short' => 110,
    'near_angle_segment' => 100,
    'short_increment_percent' => 10,
    'near_increment_mm' => 20,
    'default_stretch_percent' => 10,
]
```

### Fallback-логіка
Якщо при завантаженні калькулятора налаштування не знайдені в БД:
1. Записати дефолтні значення
2. Встановити прапорець `settings_reset_notice`
3. Передати в JS для відображення alert

---

## Структура файлів

```
includes/
└── admin/
    ├── class-admin-settings.php    # Клас для сторінки налаштувань
    └── settings-defaults.php       # Дефолтні значення

assets/
└── js/
    └── utils/
        └── config.js               # Змінити на читання з window.vertexflowConfig
```

---

## План реалізації

### Крок 1. Файл з дефолтними значеннями
**Файл:** `includes/admin/settings-defaults.php`
- Функція `get_vertexflow_default_settings()`
- Повертає асоціативний масив з 7 параметрів

### Крок 2. Клас адмінської сторінки
**Файл:** `includes/admin/class-admin-settings.php`
- Метод `add_admin_menu()` — реєстрація пункту в меню "Налаштування"
- Метод `register_settings()` — реєстрація полів через Settings API
- Метод `render_settings_page()` — HTML форми
- Метод `get_settings()` — отримання налаштувань з fallback-логікою
- Метод `reset_to_defaults()` — для кнопки скидання

### Крок 3. Ініціалізація в головному файлі
**Файл:** `vertexflow-calculator.php`
- Підключення файлів з `includes/admin/`
- Виклик ініціалізації класу
- Хук `register_activation_hook` — запис дефолтних налаштувань

### Крок 4. Передача налаштувань в JS
**Файл:** `vertexflow-calculator.php` (енкві скриптів)
- `wp_localize_script()` з даними з БД
- Додатково: прапорець `settingsResetNotice`

### Крок 5. Зміни в config.js
**Файл:** `assets/js/utils/config.js`
- Експорт функції `getCalculatedConfig()`
- Читання з `window.vertexflowConfig.settings`
- Fallback на дефолтні значення (тільки як крайній випадок)

### Крок 6. Alert при скиданні налаштувань
**Файл:** `assets/js/calculator.js` (або інший основний файл)
- Перевірка `window.vertexflowConfig.settingsResetNotice`
- Показ alert, якщо прапорець встановлено

---

## UI адмінської сторінки

```
Заголовок: VertexFlow Calculator

[Поле] Порогова відстань між колонами (мм) — 250
[Поле] Мінімальна довжина пропуску (мм) — 40
[Поле] Поріг розбиття для коротких (мм) — 110
[Поле] Сегмент для близького кута (мм) — 100
[Поле] Відсоток короткого кроку (%) — 10
[Поле] Крок у мм для близького (мм) — 20
[Поле] Відсоток розтягування (%) — 10

[Зберегти] [Скинути до дефолтних]
```

---

## Хуки WordPress

| Хук | Дія |
|-----|-----|
| `admin_menu` | Додавання пункту меню |
| `admin_init` | Реєстрація налаштувань |
| `register_activation_hook` | Запис дефолтних значень |
| `admin_enqueue_scripts` | Стилі для сторінки налаштувань |

---

## Примітки

- Валідація: WordPress Settings API автоматично санітізує дані
- Nonce: обробляється автоматично через Settings API
- Доступ: `manage_options` (стандартно для адмінів)
