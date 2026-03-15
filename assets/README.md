# Assets Directory Documentation

## Overview

This directory contains reusable modules and styles imported from the completed **DXF to GLC Converter** project (`@D:\repos\arkulatoro_crack\dxf-glc-converter`).

**For VertexFlow-Calculator, only these modules are used:**
- `svgRenderer.js` — SVG preview with pan/zoom
- `glcBuilder.js` — GLC file builder
- `unitConverter.js` — utility functions
- `style.css` — UI styles

---

## Directory Structure

```
assets/
├── style.css              # UI styling (design system tokens)
└── js/
    ├── svgRenderer.js     # SVG preview with pan/zoom
    ├── glcBuilder.js      # GLC file format builder
    └── unitConverter.js   # Utility functions (formatting)
```

---

## Module Descriptions

### 1. svgRenderer.js

**Purpose:** Renders geometry preview as SVG with interactive navigation.

**Key Features:**
- Pan (drag with mouse)
- Zoom (mouse wheel)
- Reset view (double-click)
- Automatic bounds detection
- Y-axis inversion for DXF coordinate system

**Exported Functions:**
```javascript
renderRawEntities(svgEl, rawEntities)
```

**Parameters:**
- `svgEl` - SVG DOM element for rendering
- `rawEntities` - Array of segment objects (line, arc, text)

**Usage Example:**
```javascript
import { renderRawEntities } from './assets/js/svgRenderer.js';

const svgElement = document.getElementById('previewSvg');
renderRawEntities(svgElement, entities);
```

---

### 2. glcBuilder.js

**Purpose:** Builds GLC format files for Arkulator application.

**Key Features:**
- Room definition with UID generation
- Point and arc data export
- Zone definitions
- Area and perimeter calculations
- Y-axis mirroring for Arkulator coordinate system

**Exported Functions:**
```javascript
buildGlc(contours)
```

**Parameters:**
- `contours` - Array of contour objects with segments

**Returns:**
- GLC format string (ready for download)

**Usage Example:**
```javascript
import { buildGlc } from './assets/js/glcBuilder.js';

const glcContent = buildGlc(contours);
const blob = new Blob([glcContent], { type: 'text/plain' });
```

---

### 3. unitConverter.js

**Purpose:** Utility functions for number formatting.

**Exported Functions:**
```javascript
formatNumber(value, digits = 4)
```

**Usage Example:**
```javascript
import { formatNumber } from './assets/js/unitConverter.js';

const formatted = formatNumber(123.456, 2); // "123.46"
```

---

## CSS Styles (style.css)

**Purpose:** UI styling based on design system tokens.

**Key Components:**
- `.app` - Main grid layout
- `.panel` - Card containers
- `.drop-zone` - File drag-and-drop zone
- `.field` - Form fields
- `.actions` - Button groups
- `.preview` - Preview panel
- `.status` - Status messages
- `.error-panel` - Error/warning display

**CSS Variables:**
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

---

## Integration Notes

### ES6 Module Loading

All JavaScript modules use ES6 import/export syntax. Load with:

```html
<script type="module" src="assets/js/your-module.js"></script>
```

### Coordinate Systems

| System | Y-Axis | Notes |
|--------|--------|-------|
| GLC | Down | Screen coordinates |
| SVG | Down | Screen coordinates |

**Transformations:**
- GLC → SVG: Coordinates used as-is (both Y-down)

### Dependencies

```
glcBuilder.js
  └── unitConverter.js (for formatNumber)

svgRenderer.js
  └── (no dependencies)
```

---

## Source Project

**Repository:** `D:\repos\arkulatoro_crack\dxf-glc-converter`

**Status:** Completed and tested in production

**Modules Used:**
- ✅ SVG preview with pan/zoom
- ✅ GLC export builder
- ✅ CSS styles

**Modules Removed (not needed):**
- ❌ dxfParser.js — проект работает с GLC, а не DXF
- ❌ contourBuilder.js — контуры уже есть в GLC файле
- ❌ splineProcessor.js — только для DXF сплайнов

---

## Date Imported

March 15, 2026
