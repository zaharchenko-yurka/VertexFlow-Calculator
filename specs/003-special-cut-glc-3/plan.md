# Implementation Plan: Спецраскрой внутренних углов (.glc)

**Branch**: `003-special-cut-glc-3` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-special-cut-glc-3/spec.md`

## Summary

Реализация функции специального раскроя внутренних углов для GLC-контуров. Калькулятор принимает GLC-файл, находит внутренние углы (>180°) **только во внешних контурах помещений**, применяет геометрические трансформации согласно правилам (пропуск колон/простенков, разделение сегментов), и экспортирует модифицированный GLC-файл с суффиксом `_special_cut`. **Внутренние вырезы (VIREZS) и зоны (ZONESLIST) не обрабатываются**. Вся обработка выполняется на стороне клиента.

## Technical Context

**Language/Version**: JavaScript ES6+ (модули), PHP 7.4+ (WordPress плагин)
**Primary Dependencies**: WordPress 5.0+, vanilla JS (без фреймворков)
**Storage**: N/A (клиентская обработка, без хранения)
**Testing**: Ручное интеграционное тестирование с реальными GLC-файлами
**Target Platform**: Браузер (клиент WordPress плагина)
**Project Type**: WordPress плагин (клиентский калькулятор)
**Performance Goals**: Обработка файла до 5 сек для 50 контуров
**Constraints**: 100% клиентская обработка, сохранение формата GLC (windows-1251, CRLF)
**Scale/Scope**: Без явных ограничений на количество вершин/контуров

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Соответствие | Обоснование |
|---------|--------------|-------------|
| I. Клиентская сторона | ✅ PASS | Вся обработка геометрии выполняется в браузере, без серверных вызовов |
| II. Точность GLC | ✅ PASS | Сохранение структуры GLC, кодировки windows-1251, всех геометрических данных |
| III. Дизайн-система | ✅ PASS | UI следует токенам из `.docs/design-system.json` |
| IV. Модульная архитектура | ✅ PASS | Код организуется как ES6-модули (components/, logic/, utils/) |
| V. Лучшие практики WordPress | ✅ PASS | Плагин с хуками активации, шорткод, wp_enqueue_* |
| VI. Качество и производительность | ✅ PASS | Обработка ошибок, логирование, SC-003 (5 сек для 50 контуров) |

**GATE STATUS**: ✅ PASS — Все принципы соблюдены

## Project Structure

### Documentation (this feature)

```text
specs/003-special-cut-glc-3/
├── plan.md              # Этот файл
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (GLC interface contracts)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
vertexflow-calculator/
├── vertexflow-calculator.php
├── includes/
│   ├── class-activator.php
│   └── class-deactivator.php
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── components/
│       │   ├── FileUpload.js
│       │   ├── ContourPreview.js
│       │   ├── ProcessingControls.js
│       │   └── ResultDisplay.js
│       ├── logic/
│       │   ├── SpecialCutProcessor.js
│       │   ├── AngleFinder.js
│       │   ├── ContourTransformer.js
│       │   └── StateManager.js
│       ├── utils/
│       │   ├── glcParser.js
│       │   ├── glcBuilder.js
│       │   ├── geometryUtils.js
│       │   ├── circleIntersection.js
│       │   └── processingLogger.js
│       └── app.js
├── specs/003-special-cut-glc-3/
│   ├── spec.md
│   ├── plan.md
│   ├── research.md
│   ├── data-model.md
│   └── contracts/
│       └── glc-format-contract.md
└── README.md
```

**Structure Decision**: Single project (WordPress плагин) с модульной организацией JS-кода. GLC-обработка добавляется в существующую структуру `assets/js/utils/` и `assets/js/logic/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |

---

## Phase 0: Research ✅ COMPLETED

**Goal**: Resolve all technical unknowns and establish implementation patterns.

### Research Tasks

1. **Circle Intersection Algorithm** ✅ DONE
   - Аналитический метод с fallback (постепенное увеличение радиусов на 1 мм)
   - Максимум итераций: 100 (100 мм суммарного увеличения)

2. **GLC Encoding** ✅ DONE
   - windows-1251, CRLF
   - TextDecoder в браузере для импорта
   - Требуется полифилл TextEncoder для windows-1251

3. **SVG Pan/Zoom Pattern** ✅ DONE
   - viewBox трансформация с wheel/mouse событиями
   - Минимальный зум: 0.001x, Максимальный зум: 10x

**Output**: [research.md](./research.md)

---

## Phase 1: Design & Contracts ✅ COMPLETED

**Prerequisites**: `research.md` complete

### Deliverables

1. **data-model.md** ✅ DONE
   - Сущности: Contour, Vertex, Segment, ArcInfo, ProcessingResult, Transformation, ProcessingLog
   - Configuration constants (FR-010)
   - State transitions, validation rules

2. **contracts/glc-format-contract.md** ✅ DONE
   - Import contract (парсер): блоки ROOMBEGIN, POINTS, OTRARCS, otrlist_, VIREZS, ZONESLIST
   - Export contract (билдер): сохранение структуры, обновление модифицированных контуров
   - Validation rules (minimal — FR-002.1)

3. **quickstart.md** ✅ DONE
   - Инструкция по запуску и тестированию
   - Test cases (5 сценариев)
   - Troubleshooting guide

**Output**: [data-model.md](./data-model.md), [contracts/glc-format-contract.md](./contracts/glc-format-contract.md), [quickstart.md](./quickstart.md)

---

## Constitution Check (Post-Design Re-Verification)

*GATE: Must pass before Phase 2 tasks.*

| Принцип | Соответствие | Обоснование |
|---------|--------------|-------------|
| I. Клиентская сторона | ✅ PASS | Вся обработка геометрии в браузере, без серверных вызовов |
| II. Точность GLC | ✅ PASS | Контракт сохраняет windows-1251, CRLF, все геометрические данные |
| III. Дизайн-система | ✅ PASS | UI следует токенам из `.docs/design-system.json` (quickstart.md) |
| IV. Модульная архитектура | ✅ PASS | ES6-модули: components/, logic/, utils/ (data-model.md) |
| V. Лучшие практики WordPress | ✅ PASS | Шорткод, wp_enqueue_* (quickstart.md) |
| VI. Качество и производительность | ✅ PASS | SC-003 (5 сек для 50 контуров), логирование (FR-011) |

**GATE STATUS**: ✅ PASS — Все принципы соблюдены

---

## Phase 2: Task Breakdown

**Prerequisites**: Phase 1 design complete ✅

**Next Command**: `/speckit.tasks` — декомпозиция на задачи

### Task Categories

1. **GLC Parser/Builder** (utils/)
   - glcParser.js — импорт GLC
   - glcBuilder.js — экспорт GLC
   - geometryUtils.js — вычисление углов, пересечение окружностей

2. **Processing Logic** (logic/)
   - SpecialCutProcessor.js — оркестрация обработки
   - AngleFinder.js — поиск внутренних углов
   - ContourTransformer.js — применение трансформаций

3. **UI Components** (components/)
   - FileUpload.js — загрузка файлов
   - ContourPreview.js — SVG превью с пан/зум
   - ProcessingControls.js — кнопка "Обробити", чекбоксы
   - ResultDisplay.js — отображение результатов

4. **Logging** (utils/)
   - processingLogger.js — консоль + JSON экспорт

5. **Integration**
   - app.js — точка входа, оркестрация

---

## Phase 3: Validation

**Prerequisites**: Implementation complete

### Validation Checklist

- [ ] Constitution Check re-verified post-implementation
- [ ] All acceptance scenarios from spec.md pass
- [ ] SC-001: 100% тестовых GLC проходят обработку
- [ ] SC-002: 95% внутренних углов корректно модифицированы
- [ ] SC-003: Время обработки ≤5 сек для 50 контуров
- [ ] SC-004: Экспорт с суффиксом `_special_cut` работает
- [ ] SC-005: Нет ограничений на количество вершин
- [ ] Логирование (FR-011) выводится в консоль
- [ ] JSON-экспорт логов опционально доступен
