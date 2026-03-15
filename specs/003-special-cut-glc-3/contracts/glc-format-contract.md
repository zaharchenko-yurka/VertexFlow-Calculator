# GLC Format Contract

**Date**: 2026-03-15 | **Branch**: `003-special-cut-glc-3` | **Spec**: [spec.md](../spec.md)

---

## Overview

Этот документ описывает контракт формата GLC для операций импорта и экспорта в функции спецраскроя внутренних углов. Контракт основан на спецификации из `.docs/GLC_FORMAL_SPECIFICATION/`.

---

## Import Contract (GLC Parser)

### Input

**Source**: Файл `.glc`, загруженный пользователем через File Upload или drag-and-drop (FR-001).

**Encoding**: windows-1251 (Cyrillic) без BOM
**Line Endings**: CRLF (`\r\n`)

### Parsing Requirements

Парсер ДОЛЖЕН извлечь следующие блоки из GLC-файла:

#### 1. ROOMBEGIN / ROOMEND (Room Object)

```
ROOMBEGIN
RoomName: <string>
UID1: <guid>
...
ROOMEND
```

**Fields**:
- `RoomName`: Имя помещения (отображается в UI)
- `UID1`: Уникальный идентификатор помещения (GUID)
- `Doc1CID`: ID помещения/заказа
- `WITHOUT_POLOTNO`: Флаг отсутствия полотна (bool)
- `WITHOUT_HARPOON`: Флаг отсутствия гарпуна (bool)

#### 2. POINTS / POINTSEND (Angle Points)

```
POINTS
AnglePoint <x> <y>
AnglePoint <x> <y>
...
POINTSEND
```

**Fields**:
- `AnglePoint`: Координаты угловой точки (мм, FLOAT)

#### 3. OTRARCS / OTRARCSEND (Arc Table)

```
OTRARCS
WallWid3 <index>, <width_flag>
OtrArcHei <index>, <height>
...
OTRARCSEND
```

**Fields**:
- `WallWid3`: Индекс сегмента + флаг ширины
- `OtrArcHei`: Высота дуги (мм) для указанного индекса сегмента

#### 4. otrlist_ / otrlist_end (Edge List)

```
otrlist_
NPLine
PoBeg <x> <y>
PoEnd <x> <y>
[ArcPoint <x> <y>]
[ArcHei <height>]
Wid1 <width>
[PoNumber1 <index>]
[PoNumber2 <index>]
[JValue <length>]
IdntBeg <label>
IdntEnd <label>
IdntBeg2 <label_or_empty>
IdntEnd2 <label_or_empty>
FixedBeg <bool>
END
...
otrlist_end
```

**Fields** (обязательные):
- `PoBeg`: Начальная точка сегмента (координаты)
- `PoEnd`: Конечная точка сегмента (координаты)
- `Wid1`: Флаг ширины/стиля (int)
- `IdntBeg`: Метка начальной вершины (A, B, C...)
- `IdntEnd`: Метка конечной вершины
- `FixedBeg`: Флаг фиксированного начала (bool)

**Fields** (опциональные):
- `ArcPoint`: Контрольная точка дуги (если есть дуга)
- `ArcHei`: Высота дуги (мм)
- `PoNumber1`, `PoNumber2`: Индексы точек
- `JValue`: Длина хорды (мм)

#### 5. VIREZS / VIREZSEND (Cutouts)

```
VIREZS
ONEVIREZ
VirezLine
...
ONEVIREZEND
VIREZSEND
```

**Fields**:
- `ONEVIREZ`: Один внутренний вырез
- `VirezLine`: Сегмент выреза (аналогично NPLine)

**Важно**: Внутренние вырезы **не обрабатываются** при спецраскрое. Углы вырезов сохраняются в исходном виде независимо от наличия внутренних углов.

#### 6. ZONESLIST / ZONESLISTEND (Zones)

```
ZONESLIST
OneZone
ZoneGUI1 <guid>
ZoneLine
...
OneZoneEND
ZONESLISTEND
```

**Fields**:
- `ZoneGUI1`: GUID зоны
- `ZoneLine`: Сегмент зоны с `TipeOtr` (тип края)

**Важно**: Зоны **не обрабатываются** при спецраскрое. Сохраняются в исходном виде.

#### 7. PARAMS2_BEGIN / PARAMS2_END (Material Parameters)

```
PARAMS2_BEGIN
StretchParamPer <percent>
StretchParamPer_2 <percent>
...
PARAMS2_END
```

**Fields**:
- `StretchParamPer`: Процент растяжения полотна (%)
- `StretchParamPer_2`: Второй процент растяжения (%)

#### 8. GValsBegin / GValsEnd (Derived Metrics)

```
GValsBegin
A <area_m2>
B <cloth_area_m2>
C <consumption_area_m2>
D <perimeter_m>
E <inner_corners>
F <outer_corners>
I <arc_count>
J <arc_length_m>
G <harpoon_length_m>
...
GValsEnd
```

### Output (Parsed Structure)

Парсер ВОЗВРАЩАЕТ:

```typescript
interface ParsedGLC {
  rooms: Room[];           // Массив помещений (обычно 1)
  metadata: GLCMetadata;   // Метаданные файла
}

interface Room {
  name: string;
  uid: string;
  contours: Contour[];     // Контур(ы) помещения
  cutouts: Contour[];      // Вырезы
  zones: Zone[];           // Зоны
  params: MaterialParams;  // Параметры материала
  metrics: DerivedMetrics; // Метрики (GVals)
}
```

---

## Export Contract (GLC Builder)

### Input

**Source**: Модифицированные контуры после применения спецраскроя.

### Export Requirements

Билдер ДОЛЖЕН сгенерировать GLC-файл со следующей структурой:

#### 1. Сохранить все оригинальные блоки

Все блоки из импорта ДОЛЖНЫ быть сохранены в экспорте (кроме модифицированных контуров).

#### 2. Обновить модифицированные контуры

Для каждого **внешнего контура (type: 'outer')**:
- Обновить `POINTS` блок с новыми координатами вершин
- Обновить `otrlist_` блок с новыми сегментами
- Обновить `IdntBeg`/`IdntEnd` с новыми именами (A, B, C... по часовой стрелке)

**Внутренние вырезы (VIREZS) и зоны (ZONESLIST) не модифицируются** — сохраняются в исходном виде.

#### 3. Обновить параметры растяжения (FR-008)

```
StretchParamPer 10
StretchParamPer_2 10
```

#### 4. Обновить метрики (GVals)

Пересчитать:
- `A` (площадь помещения) — если изменилась геометрия
- `D` (периметр) — если изменилась длина сегментов
- `E`, `F` (углы) — если изменилось количество углов
- `I`, `J` (дуги) — если изменились дуги

#### 5. Имя файла (FR-009)

Добавить суффикс `_special_cut` к оригинальному имени:
- Было: `room.glc`
- Стало: `room_special_cut.glc`

### Output

**Encoding**: windows-1251 (Cyrillic) без BOM
**Line Endings**: CRLF (`\r\n`)
**Format**: Текст (не бинарный)

---

## Validation Rules (Minimal — FR-002.1)

### Structure Validation

Парсер ПРОВЕРЯЕТ:

1. **Наличие ROOMBEGIN/ROOMEND**:
   - Если отсутствует — ошибка: `INVALID_GLC_STRUCTURE: Missing ROOMBEGIN block`

2. **Наличие POINTS/POINTSEND**:
   - Если отсутствует — предупреждение, но продолжить

3. **Наличие otrlist_/otrlist_end**:
   - Если отсутствует — ошибка: `INVALID_GLC_STRUCTURE: Missing edge list`

4. **Минимум 3 вершины в контуре**:
   - Если меньше — предупреждение: `INVALID_CONTOUR: Less than 3 vertices`

### Geometry Validation (Optional)

**Не выполняется** согласно FR-002.1 (minimal validation).

---

## Error Handling

### Parser Errors

| Error Code | Severity | Message | Recovery |
|------------|----------|---------|----------|
| `INVALID_GLC_STRUCTURE` | Error | Файл не содержит обязательных блоков GLC | Прервать, показать пользователю |
| `ENCODING_ERROR` | Error | Не удалось декодировать файл из windows-1251 | Прервать, показать пользователю |
| `INVALID_CONTOUR` | Warning | Контур имеет некорректную геометрию | Продолжить с предупреждением |
| `MISSING_ARCS` | Warning | Дуги указаны в OTRARCS, но не в NPLine | Продолжить, игнорировать дуги |

### Builder Errors

| Error Code | Severity | Message | Recovery |
|------------|----------|---------|----------|
| `MISSING_VERTICES` | Error | Контур не имеет вершин для экспорта | Прервать, логировать |
| `ENCODING_FAILED` | Error | Не удалось закодировать в windows-1251 | Прервать, логировать |

---

## Example: Minimal Valid GLC

```
ROOMBEGIN
RoomName: Пример
UID1: {12345678-1234-1234-1234-123456789012}
WITHOUT_POLOTNO: False
WITHOUT_HARPOON: False
POINTS
AnglePoint 0.0 0.0
AnglePoint 1000.0 0.0
AnglePoint 1000.0 1000.0
AnglePoint 0.0 1000.0
POINTSEND
OTRARCS
OTRARCSEND
BLUEPOINTS
BLUEPOINTSEND
otrlist_
NPLine
PoBeg 0.0 0.0
PoEnd 1000.0 0.0
Wid1 100
PoNumber1 1
PoNumber2 2
JValue 1000.0
IdntBeg A
IdntEnd B
IdntBeg2
IdntEnd2
FixedBeg False
END
... (ещё 3 сегмента)
otrlist_end
dim_lines_
dim_lines_end
VIREZS
VIREZSEND
ZONESLIST
ZONESLISTEND
ALLDIMLINES
ALLDIMLINESEND
ESTIME_BEGIN
ESTIME_END
GValsBegin
A 1.0
D 4.0
GValsEnd
PARAMS2_BEGIN
StretchParamPer 10
StretchParamPer_2 10
PARAMS2_END
ROOMEND
```

---

## References

- `.docs/GLC_FORMAL_SPECIFICATION/GLC_FORMAL_SPECIFICATION.md`
- `.docs/GLC_FORMAL_SPECIFICATION/GLC_FIELD_MATRIX.md`
- `.docs/GLC_FORMAL_SPECIFICATION/GLC_GEOMETRY_SPEC.md`
- `.docs/GLC_FORMAL_SPECIFICATION/GLC_RAW_STRUCTURE.md`
