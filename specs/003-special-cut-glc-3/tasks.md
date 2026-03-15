# Tasks: Спецраскрой внутренних углов (.glc)

**Input**: Design documents from `/specs/003-special-cut-glc-3/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/glc-format-contract.md ✅, quickstart.md ✅

**Tests**: Tests are OPTIONAL for this feature - manual integration testing via quickstart.md is the primary validation approach.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

WordPress плагин с модульной организацией JS-кода:
- `assets/js/components/` — UI компоненты
- `assets/js/logic/` — Бизнес-логика обработки
- `assets/js/utils/` — Утилиты (парсеры, геометрия)
- `assets/css/` — Стили

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 [P] Create project structure per plan.md: assets/js/components/, assets/js/logic/, assets/js/utils/, assets/css/
- [ ] T002 [P] Create configuration module assets/js/utils/config.js with constants from spec.md (COLUMN_DISTANCE_THRESHOLD, MIN_SKIP_LENGTH, etc.)
- [ ] T003 [P] Create JSDoc type definitions file assets/js/logic/types.js with type annotations из data-model.md (Contour, Vertex, Segment, ProcessingResult, Transformation, ProcessingLog)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create GLC parser utility assets/js/utils/glcParser.js — импорт GLC с windows-1251 декодированием, парсинг блоков ROOMBEGIN, POINTS, OTRARCS, otrlist_, VIREZS, ZONESLIST, PARAMS2_BEGIN, GValsBegin
- [ ] T005 [P] Create GLC builder utility assets/js/utils/glcBuilder.js — экспорт GLC с windows-1251 кодированием (CRLF), сохранение структуры, обновление модифицированных контуров
- [ ] T006 [P] Create geometry utilities assets/js/utils/geometryUtils.js — функции computeAngle(), findCircleIntersection() с fallback-стратегией (research.md), distance()
- [ ] T007 [P] Create processing logger assets/js/utils/processingLogger.js — console.log вывод + опциональный JSON экспорт (FR-011)
- [ ] T008 [P] Create base CSS styles assets/css/style.css с токенами из .docs/design-system.json (CSS переменные: --bg, --panel, --text, --accent, etc.)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Загрузка и обработка контура (Priority: P1) 🎯 MVP

**Goal**: Пользователь загружает .glc файл, нажимает "Обробити" и получает обработанные контуры с применённым спецраскроем внутренних углов.

**Independent Test**: Загрузить тестовый .glc (033273.glc), проверить что внутренние углы внешнего контура найдены и модифицированы согласно правилам (FR-005, FR-006), внутренний вырез (VIREZS) не обработан.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create angle finder module assets/js/logic/AngleFinder.js — поиск внутренних углов (>180°) только в контурах типа 'outer', вычисление угла между предыдущим и следующим сегментом при обходе по часовой стрелке
- [ ] T010 [P] [US1] Create contour transformer module assets/js/logic/ContourTransformer.js — применение трансформаций согласно правилам FR-005 (пропуск колон/простенков, коротких сегментов, разделение сегментов, пересечение окружностей)
- [ ] T011 [US1] Create special cut processor module assets/js/logic/SpecialCutProcessor.js — оркестрация обработки: вызов AngleFinder → ContourTransformer → обновление контура, логирование результатов
- [ ] T012 [US1] Implement vertex renaming in assets/js/logic/ContourTransformer.js — переименование вершин по часовой стрелке начиная с 'A' (FR-007)
- [ ] T013 [US1] Implement stretch parameters update in assets/js/logic/SpecialCutProcessor.js — установка StretchParamPer и StretchParamPer_2 в 10% для модифицированных контуров (FR-008)
- [ ] T014 [US1] Add validation for contour type in assets/js/logic/AngleFinder.js — проверка что обработка применяется только к контурам типа 'outer', пропуск cutout/zone (FR-002.2)
- [ ] T015 [US1] Add error handling in assets/js/logic/SpecialCutProcessor.js — обработка ошибок парсинга, геометрии, пересечения окружностей с fallback (FR-006.1)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — загрузка файла, обработка, логирование в консоль

---

## Phase 4: User Story 2 - Просмотр и управляемый предпросмотр (Priority: P2)

**Goal**: Пользователь видит контуры в SVG-превью с панорамированием и зумированием, превью обновляется после обработки.

**Independent Test**: Загрузить файл с несколькими контурами, проверить визуализацию в SVG, работу пан (перетаскивание) и зум (колесо мыши), обновление превью после обработки.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create file upload component assets/js/components/FileUpload.js — кнопка загрузки .glc + drag-and-drop зона (FR-001), обработка File API
- [ ] T017 [P] [US2] Create SVG preview component assets/js/components/ContourPreview.js — отрисовка контуров в SVG, viewBox трансформация для пан/зум (research.md), зум 0.1x–10x
- [ ] T018 [US2] Implement pan/zoom controls in assets/js/components/ContourPreview.js — обработка wheel event для зума, mousedown/mousemove/mouseup для пана, сброс по двойному клику
- [ ] T019 [US2] Create processing controls component assets/js/components/ProcessingControls.js — кнопка "Обробити", чекбокс "Не обробляти колони і простінки" (по умолчанию установлен)
- [ ] T020 [US2] Create result display component assets/js/components/ResultDisplay.js — отображение результатов обработки (количество найденных/обработанных углов), кнопка "Завантажити"
- [ ] T021 [US2] Integrate preview update in assets/js/components/ContourPreview.js — перерисовка SVG после обработки с новыми координатами вершин

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently — загрузка, просмотр, обработка, обновление превью

---

## Phase 5: User Story 3 - Экспорт обработанного файла (Priority: P2)

**Goal**: Пользователь может скачать новый .glc файл с суффиксом `_special_cut`, содержащий обработанные и необработанные контуры.

**Independent Test**: После обработки нажать "Завантажити", проверить что скачанный файл имеет имя с суффиксом `_special_cut`, кодировку windows-1251, CRLF, обновлённые координаты и параметры растяжения.

### Implementation for User Story 3

- [ ] T022 [P] [US3] Implement file download in assets/js/components/ResultDisplay.js — генерация Blob с windows-1251 содержимым, скачивание файла с именем `<original>_special_cut.glc` (FR-009)
- [ ] T023 [US3] Integrate GLC builder in assets/js/components/ResultDisplay.js — вызов glcBuilder.js для генерации выходного файла с обновлёнными контурами и метриками
- [ ] T024 [US3] Implement metrics recalculation in assets/js/utils/glcBuilder.js — пересчёт GVals (площадь A, периметр D, углы E/F, дуги I/J) для модифицированных контуров

**Checkpoint**: All user stories should now be independently functional — полный цикл: загрузка → просмотр → обработка → экспорт

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T025 [P] Create main entry point assets/js/app.js — инициализация компонентов, оркестрация взаимодействия между FileUpload, ContourPreview, ProcessingControls, ResultDisplay
- [ ] T026 [P] Create WordPress plugin entry point vertexflow-calculator.php с шорткодом [vertexflow_calculator] и wp_enqueue_* для подключения JS/CSS
- [ ] T027 [P] Create activator/deactivator hooks includes/class-activator.php, includes/class-deactivator.php (WordPress best practices)
- [ ] T028 [P] Add Ukrainian localization for UI text в assets/js/components/ (кнопки, сообщения, чекбоксы)
- [ ] T029 [P] Add JSON log export button in assets/js/components/ResultDisplay.js — опциональный экспорт лога обработки (FR-011)
- [ ] T030 [P] Update README.md с инструкцией по установке плагина и использованию шорткода
- [ ] T031 Run quickstart.md validation — пройти все тестовые кейсы из quickstart.md (Test Case 1–5), проверить SC-001–SC-005

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 for processing pipeline
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 processing, US2 UI components

### Within Each User Story

- Models/utilities before services
- Services before components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
- T001, T002, T003 can all run in parallel (different files)

**Phase 2 (Foundational)**:
- T004, T005, T006, T007, T008 can all run in parallel (different files)

**Phase 3 (US1)**:
- T009, T010 can run in parallel (AngleFinder, ContourTransformer — разные файлы)
- T011 depends on T009, T010
- T012, T013, T014, T015 depend on T011

**Phase 4 (US2)**:
- T016, T017 can run in parallel (FileUpload, ContourPreview — разные файлы)
- T018 depends on T017
- T019, T020 can run in parallel (ProcessingControls, ResultDisplay — разные файлы)
- T021 depends on T017, T020

**Phase 5 (US3)**:
- T022 depends on T020 (ResultDisplay)
- T023, T024 depend on T005 (glcBuilder)

**Phase 6 (Polish)**:
- T025, T026, T027, T028, T029, T030 can all run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch AngleFinder and ContourTransformer together:
Task: "T009 [P] [US1] Create angle finder module assets/js/logic/AngleFinder.js"
Task: "T010 [P] [US1] Create contour transformer module assets/js/logic/ContourTransformer.js"

# After both complete, implement SpecialCutProcessor:
Task: "T011 [US1] Create special cut processor module assets/js/logic/SpecialCutProcessor.js"
```

---

## Parallel Example: User Story 2

```bash
# Launch FileUpload and ContourPreview together:
Task: "T016 [P] [US2] Create file upload component assets/js/components/FileUpload.js"
Task: "T017 [P] [US2] Create SVG preview component assets/js/components/ContourPreview.js"

# After ContourPreview complete, implement pan/zoom:
Task: "T018 [US2] Implement pan/zoom controls in assets/js/components/ContourPreview.js"

# Launch ProcessingControls and ResultDisplay together:
Task: "T019 [US2] Create processing controls component assets/js/components/ProcessingControls.js"
Task: "T020 [US2] Create result display component assets/js/components/ResultDisplay.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T009–T015)
4. **STOP and VALIDATE**: Test User Story 1 independently via quickstart.md Test Case 2
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently (загрузка → обработка → логи) → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently (превью с пан/зум) → Deploy/Demo
4. Add User Story 3 → Test independently (экспорт с суффиксом) → Deploy/Demo
5. Complete Polish → Full feature ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T009–T015)
   - Developer B: User Story 2 (T016–T021)
   - Developer C: User Story 3 (T022–T024) + Polish (T025–T030)
3. Stories complete and integrate independently

---

## Task Summary

| Phase | Description | Task Count |
|-------|-------------|------------|
| Phase 1 | Setup | 3 |
| Phase 2 | Foundational | 5 |
| Phase 3 | User Story 1 (P1) | 7 |
| Phase 4 | User Story 2 (P2) | 6 |
| Phase 5 | User Story 3 (P2) | 3 |
| Phase 6 | Polish | 7 |
| **Total** | | **31** |

---

## Notes

- [P] tasks = different files, no dependencies — can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at checkpoints to validate story independently
- All UI text must be in Ukrainian (spec.md)
- GLC encoding: windows-1251, CRLF — critical for compatibility
- Processing applies ONLY to outer contours (type: 'outer'), NOT to cutouts (VIREZS) or zones (ZONESLIST)
