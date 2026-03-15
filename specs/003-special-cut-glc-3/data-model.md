# Data Model: Спецраскрой внутренних углов (.glc)

**Date**: 2026-03-15 | **Branch**: `003-special-cut-glc-3` | **Spec**: [spec.md](./spec.md)

---

## Core Entities

### Contour

Последовательность вершин и сегментов, образующая замкнутый контур помещения или выреза.

```typescript
interface Contour {
  id: string;                    // Уникальный идентификатор (GUID или индекс)
  name: string;                  // Имя контура (из RoomName или сгенерированное)
  type: 'outer' | 'cutout' | 'zone';  // Тип контура
  vertices: Vertex[];            // Массив вершин в порядке обхода (по часовой стрелке)
  segments: Segment[];           // Массив сегментов (производное от vertices)
  arcs: ArcInfo[];               // Информация о дугах (если есть)
  metadata: ContourMetadata;     // Метаданные (TipeOtr, ZoneGUI1, и т.д.)
  isProcessed: boolean;          // Флаг применения спецраскроя
  isProcessedEligible: boolean;  // Флаг: применима ли обработка (true только для 'outer')
}
```

**Invariants**:
- Минимум 3 вершины (замкнутый контур)
- Вершины упорядочены по часовой стрелке
- Сегменты выводятся из вершин (не хранятся независимо)
- **Обработка применяется только к контурам типа `outer` (внешние контуры помещений)**

---

### Vertex

Точка контура с координатами и именем.

```typescript
interface Vertex {
  id: string;                    // Уникальный идентификатор (PoNumber или сгенерированный)
  name: string;                  // Буквенное имя (A, B, C, ...)
  x: number;                     // X-координата (мм)
  y: number;                     // Y-координата (мм)
  isAnglePoint: boolean;         // Флаг: является ли угловой точкой (из POINTS блока)
  originalIndex?: number;        // Оригинальный индекс в файле (для отладки)
}
```

**Invariants**:
- Имена уникальны в пределах контура
- Имена присваиваются по часовой стрелке начиная с `A` (FR-007)

---

### Segment

Отрезок между двумя вершинами с длиной и направлением.

```typescript
interface Segment {
  id: string;                    // Уникальный идентификатор
  startIndex: number;            // Индекс начальной вершины в массиве vertices
  endIndex: number;              // Индекс конечной вершины в массиве vertices
  length: number;                // Длина сегмента (мм), вычисляется
  hasArc: boolean;               // Флаг: есть ли дуга на сегменте
  arcInfo?: ArcInfo;             // Информация о дуге (если есть)
  jValue?: number;               // Хорда дуги (мм), из JValue в NPLine
}
```

**Invariants**:
- Длина вычисляется как расстояние между вершинами
- Индексы валидны (0 <= index < vertices.length)

---

### ArcInfo

Информация о дуге на сегменте.

```typescript
interface ArcInfo {
  arcPoint: { x: number; y: number };  // Контрольная точка дуги (ArcPoint)
  arcHei: number;                       // Высота дуги (мм), ArcHei
  arcLength?: number;                   // Длина дуги (мм), вычисляется
  radius?: number;                      // Радиус дуги (мм), вычисляется
}
```

---

### ProcessingResult

Результат обработки контура: какие вершины изменены, какие сегменты разделены.

```typescript
interface ProcessingResult {
  contourId: string;             // ID обработанного контура
  wasModified: boolean;          // Флаг: были ли изменения
  internalAnglesFound: number;   // Количество найденных внутренних углов
  internalAnglesProcessed: number; // Количество обработанных внутренних углов
  internalAnglesSkipped: number; // Количество пропущенных углов
  transformations: Transformation[]; // Детали трансформаций
  stretchParamPer: number;       // Значение StretchParamPer (10% по умолчанию)
  stretchParamPer2: number;      // Значение StretchParamPer_2 (10% по умолчанию)
}
```

---

### Transformation

Описание одной трансформации внутреннего угла.

```typescript
type TransformationType = 
  | 'SKIPPED_COLUMN'           // Пропущен из-за колонны/простенка
  | 'SKIPPED_SHORT_SEGMENT'    // Пропущен из-за короткого сегмента
  | 'SPLIT_SHORT_SEGMENT'      // Разделён короткий сегмент
  | 'SPLIT_BOTH_SEGMENTS';     // Разделены оба сегмента

interface Transformation {
  id: string;                  // Уникальный идентификатор
  type: TransformationType;    // Тип трансформации
  vertexIndex: number;         // Индекс вершины внутреннего угла
  vertexName: string;          // Имя вершины (A, B, C...)
  angleDegrees: number;        // Величина угла (градусы)
  prevSegmentIndex: number;    // Индекс предыдущего сегмента
  nextSegmentIndex: number;    // Индекс следующего сегмента
  prevSegmentLength: number;   // Длина предыдущего сегмента (до)
  nextSegmentLength: number;   // Длина следующего сегмента (до)
  incrementMm?: number;        // Приращение (мм), если применимо
  incrementPercent?: number;   // Приращение (%), если применимо
  newVertex?: Vertex;          // Новая вершина (если создана)
  fallbackUsed: boolean;       // Флаг: использован ли fallback для пересечения окружностей
  reason?: string;             // Причина пропуска (если применимо)
}
```

---

### ProcessingLog

Журнал обработки для отладки и экспорта (FR-011).

```typescript
interface ProcessingLog {
  timestamp: string;           // ISO-8601 timestamp
  fileName: string;            // Имя входного файла
  totalContours: number;       // Общее количество контуров
  totalVertices: number;       // Общее количество вершин
  results: ProcessingResult[]; // Результаты по каждому контуру
  errors: ProcessingError[];   // Ошибки (если есть)
  durationMs: number;          // Время обработки (мс)
}
```

---

### ProcessingError

Ошибка обработки.

```typescript
interface ProcessingError {
  code: string;                // Код ошибки (e.g., 'INVALID_GLC_STRUCTURE', 'CIRCLE_INTERSECTION_FAILED')
  message: string;             // Описание ошибки
  contourId?: string;          // ID контура (если применимо)
  vertexIndex?: number;        // Индекс вершины (если применимо)
  severity: 'warning' | 'error'; // Степень серьёзности
}
```

---

## Configuration Constants

Все константы вынесены в единый конфигурационный модуль (FR-010).

```typescript
interface SpecialCutConfig {
  // Пороговые значения (мм)
  COLUMN_DISTANCE_THRESHOLD: number;    // 250 мм
  MIN_SKIP_LENGTH: number;              // 45 мм
  SPLIT_THRESHOLD_SHORT: number;        // 110 мм
  NEAR_ANGLE_SEGMENT: number;           // 100 мм
  
  // Приращения
  SHORT_INCREMENT_PERCENT: number;      // 10 %
  NEAR_INCREMENT_MM: number;            // 20 мм
  
  // Растяжение полотна
  DEFAULT_STRETCH_PERCENT: number;      // 10 %
  
  // Fallback параметры
  CIRCLE_INTERSECTION_EPSILON: number;  // 0.1 мм (шаг увеличения радиуса)
  CIRCLE_INTERSECTION_MAX_ITERATIONS: number; // 1000
}
```

---

## State Transitions

### Contour Processing State Machine

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   LOADED    │────▶│  ANALYZING   │────▶│  TRANSFORMING│
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           │                    ▼
                           │            ┌─────────────┐
                           │            │  COMPLETED  │
                           │            └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐      ┌─────────────┐
                    │   SKIPPED   │      │   EXPORTED  │
                    └─────────────┘      └─────────────┘
```

**Transitions**:
- `LOADED → ANALYZING`: Начат поиск внутренних углов (только для `type: 'outer'`)
- `ANALYZING → TRANSFORMING`: Найдены внутренние углы, начата обработка
- `ANALYZING → SKIPPED`: Нет внутренних углов или все пропущены **или контур не является внешним (cutout/zone)**
- `TRANSFORMING → COMPLETED`: Все трансформации применены
- `COMPLETED → EXPORTED`: Контур экспортирован в GLC

**Важно**: Контуры типа `cutout` (VIREZS) и `zone` (ZONESLIST) **переходят сразу в состояние SKIPPED** без анализа углов.

---

## Validation Rules

### Contour Validation (Minimal — FR-002.1)

```typescript
function validateContour(contour: Contour): ValidationResult {
  // Только базовая структура
  if (!contour.vertices || contour.vertices.length < 3) {
    return { valid: false, error: 'Контур должен иметь минимум 3 вершины' };
  }
  
  // Проверка замкнутости (первая и последняя вершины совпадают или сегменты замыкаются)
  // Опционально: если не замкнут — предупредить, но обработать
  
  return { valid: true };
}
```

### Angle Detection (FR-004)

```typescript
function isInternalAngle(vertex: Vertex, prevSegment: Segment, nextSegment: Segment): boolean {
  // Угол > 180° при обходе по часовой стрелке
  // Вычисляется через векторное произведение или угол между сегментами
  const angle = computeAngle(prevSegment, nextSegment);
  return angle > 180;
}
```

---

## Relationships

```
Contour (1) ────── (*) Vertex
Contour (1) ────── (*) Segment
Contour (1) ────── (*) ArcInfo
Contour (1) ────── (0..1) ProcessingResult
ProcessingResult (1) ────── (*) Transformation
Transformation (0..1) ────── (1) Vertex (новая)
ProcessingLog (1) ────── (*) ProcessingResult
ProcessingLog (1) ────── (*) ProcessingError
```

---

## Indexes & Performance

**Оптимизации**:
- Индексация вершин по имени для быстрого поиска (A, B, C...)
- Кэширование длин сегментов (не вычислять повторно)
- Пре-вычисление углов при загрузке контура

---

## Next Steps

1. Реализовать TypeScript интерфейсы в `assets/js/logic/types.ts` (или JSDoc-аннотации)
2. Создать модуль `geometryUtils.js` с функциями:
   - `computeAngle(seg1, seg2)`
   - `findCircleIntersection(c1, r1, c2, r2)`
   - `findInternalAngles(contour)`
3. Создать модуль `processingLogger.js` для FR-011
