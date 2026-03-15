# Спецификация: Повторно используемые модули

## Источник

**Проект:** DXF to GLC Converter  
**Репозиторий:** `D:\repos\arkulatoro_crack\dxf-glc-converter`  
**Дата импорта:** 15 марта 2026 г.  
**Статус:** Готовые протестированные модули

---

## Обзор

В проекте используются готовые модули из завершенного проекта-калькулятора. Эти модули прошли тестирование в production и могут быть использованы как есть или модифицированы при необходимости.

### Расположение

```
assets/
├── README.md            # Полная документация по API
├── style.css            # Стили UI
└── js/
    ├── svgRenderer.js   # SVG превью с пан/зумом
    ├── glcBuilder.js    # Сборщик GLC файлов
    └── unitConverter.js # Утилиты форматирования
```

---

## Модули и их назначение

### 1. svgRenderer.js

**Назначение:** Отрисовка превью геометрии в SVG с интерактивной навигацией.

**Основной API:**
```javascript
import { renderRawEntities } from './assets/js/svgRenderer.js';

renderRawEntities(svgElement, rawEntities);
```

**Функционал:**
- ✅ Панорамирование (перетаскивание мышью)
- ✅ Зум (колесо мыши, диапазон 0.1x – 100x)
- ✅ Сброс вида (двойной клик)
- ✅ Автоматическое определение границ геометрии
- ✅ Инверсия оси Y для совместимости

**Формат данных (rawEntities):**
```javascript
[
  {
    type: "line",
    start: { x: 0, y: 0 },
    end: { x: 100, y: 100 }
  },
  {
    type: "arc",
    center: { x: 50, y: 50 },
    radius: 25,
    start: { x: 75, y: 50 },
    end: { x: 50, y: 75 },
    startAngleDeg: 0,
    endAngleDeg: 90,
    sweepDeg: 90,
    clockwise: false
  }
]
```

**Возможные модификации:**
- Изменить цвета линий (по умолчанию `#1f2a24`)
- Настроить толщину линий (по умолчанию `1.4`)
- Добавить поддержку дополнительных типов (сплайны, эллипсы)
- Изменить скорость панорамирования (`PAN_SPEED = 1`)
- Настроить диапазон зума (`MIN_SCALE = 0.1`, `MAX_SCALE = 100`)

---

### 2. glcBuilder.js

**Назначение:** Генерация файлов формата GLC для приложения Arkulator.

**Основной API:**
```javascript
import { buildGlc } from './assets/js/glcBuilder.js';

const glcContent = buildGlc(contours);
```

**Формат данных (contours):**
```javascript
[
  {
    closed: true,
    segments: [ /* массив сегментов */ ],
    perimeter: 12345.67,
    signedArea: 98765.43,
    winding: "CCW"
  }
]
```

**Структура выходного GLC:**
- ROOMBEGIN / ROOMEND — определение комнаты
- POINTS / POINTSEND — координаты вершин
- OTRARCS / OTRARCSEND — данные дуг
- otrlist_ / otrlist_end — список отрезков
- ZONESLIST / ZONESLISTEND — зоны
- GValsBegin / GValsEnd — метрики (площадь, периметр)
- PARAMS2_BEGIN / PARAMS2_END — параметры (усадка и др.)

**Возможные модификации:**
- Изменить генерацию UID (функция `uuid()`)
- Настроить префиксы имен комнат (`RoomName Ceiling_`)
- Добавить поддержку дополнительных параметров GLC
- Изменить форматирование чисел (функция `formatNumber`)
- Добавить кастомные метрики в GVals

---

### 3. unitConverter.js

**Назначение:** Утилиты для форматирования чисел.

**Основной API:**
```javascript
import { formatNumber } from './assets/js/unitConverter.js';

const formatted = formatNumber(123.456, 2); // "123.46"
```

**Функции:**
- `formatNumber(value, digits = 4)` — форматирование числа с указанным количеством знаков

**Возможные модификации:**
- Изменить точность по умолчанию (сейчас 4 знака)
- Добавить локализацию (разделители тысяч/десятичных)
- Добавить дополнительные утилиты форматирования

---

### 4. style.css

**Назначение:** Стилизация UI компонентов.

**CSS переменные:**
```css
:root {
  --bg: #f2f4f1;
  --panel: #fbfcf8;
  --text: #1f2a24;
  --muted: #5e6c63;
  --line: #d0d8d1;
  --accent: #2f6d4e;
  --error: #b42318;
  --warn: #b26d00;
}
```

**Основные классы:**
- `.app` — главная сетка
- `.panel` — карточки/панели
- `.drop-zone` — зона drag-and-drop
- `.field` — поля формы
- `.actions` — кнопки
- `.preview` — панель превью
- `.status` — статусные сообщения
- `.error-panel` — ошибки/предупреждения

**Возможные модификации:**
- Изменить цветовую схему (через CSS переменные)
- Настроить размеры и отступы
- Добавить темную тему
- Адаптировать под мобильные устройства

---

## Интеграция в проект

### Подключение модулей

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <div class="app">
    <section class="panel controls">
      <!-- Элементы управления -->
    </section>
    
    <section class="panel preview">
      <h2>SVG Preview</h2>
      <div class="svg-wrap">
        <svg id="previewSvg"></svg>
      </div>
    </section>
  </div>
  
  <script type="module">
    import { renderRawEntities } from './assets/js/svgRenderer.js';
    import { buildGlc } from './assets/js/glcBuilder.js';
    import { formatNumber } from './assets/js/unitConverter.js';
    
    // Использование
    const svgEl = document.getElementById('previewSvg');
    renderRawEntities(svgEl, entities);
    
    const glc = buildGlc(contours);
    const num = formatNumber(123.456, 2);
  </script>
</body>
</html>
```

---

## Модификация модулей

### Общие принципы

1. **Сохраняйте обратную совместимость** — не меняйте сигнатуры экспортируемых функций
2. **Документируйте изменения** — обновляйте `assets/README.md`
3. **Тестируйте изменения** — проверяйте работу с реальными данными GLC
4. **Сохраняйте стиль кода** — следуйте существующим конвенциям (ES6, const/let, стрелочные функции)

### Пример: Изменение цвета линий в SVG

```javascript
// assets/js/svgRenderer.js, функция renderSegment

// Было:
renderSegment(dxfLayer, seg, "#1f2a24", 1.4);

// Стало (например, синий цвет):
renderSegment(dxfLayer, seg, "#0066cc", 1.4);
```

### Пример: Изменение формата чисел

```javascript
// assets/js/unitConverter.js, функция formatNumber

// Было (округление):
const fixed = n.toFixed(digits);
return fixed.replace(/\.?0+$/, "") || "0";

// Стало (с разделителями тысяч):
const fixed = n.toFixed(digits);
const [int, dec] = fixed.split('.');
const withSpaces = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
return dec ? `${withSpaces},${dec}` : withSpaces;
```

### Пример: Добавление параметра в GLC

```javascript
// assets/js/glcBuilder.js, функция buildRoom

// Добавить в PARAMS2_BEGIN / PARAMS2_END:
lines.push("CustomParam 123");
```

---

## Тестирование

### SVG Renderer

1. Откройте файл с геометрией
2. Проверьте панорамирование (левая кнопка мыши + перетаскивание)
3. Проверьте зум (колесо мыши)
4. Проверьте сброс вида (двойной клик)
5. Убедитесь, что геометрия отображается корректно

### GLC Builder

1. Сгенерируйте GLC файл
2. Откройте в Arkulator
3. Проверьте соответствие геометрии
4. Проверьте метрики (площадь, периметр)

---

## Зависимости между модулями

```
glcBuilder.js
  └── unitConverter.js (formatNumber)

svgRenderer.js
  └── (нет зависимостей)

style.css
  └── (нет зависимостей)
```

---

## Известные ограничения

### svgRenderer.js
- Не поддерживает 3D геометрию
- Не отображает размеры (DIMENSION entities)
- Текст отображается без учета сложных шрифтов

### glcBuilder.js
- Генерирует только потолочные контуры (Ceiling_)
- Не поддерживает многослойные конструкции
- UID генерируются случайно (не детерминировано)

### unitConverter.js
- Минимальный набор функций (только formatNumber)
- Нет поддержки локали

---

## Контакты и поддержка

При возникновении проблем с модулями:
1. Проверьте `assets/README.md`
2. Изучите исходный проект: `D:\repos\arkulatoro_crack\dxf-glc-converter`
3. Проверьте спецификацию GLC: `.docs/GLC_FORMAL_SPECIFICATION`

---

## Версия документа

**Версия:** 1.0  
**Дата:** 15 марта 2026 г.  
**Статус:** Актуально
