import { DEFAULT_ZOOM_MIN, DEFAULT_ZOOM_MAX } from '../utils/config.js';

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

export function createContourPreview() {
  const wrapper = document.createElement('section');
  wrapper.className = 'panel preview';

  const title = document.createElement('h2');
  title.textContent = 'Попередній перегляд';

  const svgWrap = document.createElement('div');
  svgWrap.className = 'svg-wrap';

  const svg = createSvgElement('svg', { id: 'previewSvg' });
  svgWrap.appendChild(svg);

  wrapper.appendChild(title);
  wrapper.appendChild(svgWrap);

  const state = {
    baseViewBox: null,
    viewBox: null,
    isDragging: false,
    dragStart: null
  };

  const applyViewBox = () => {
    if (!state.viewBox) {
      return;
    }
    const { x, y, w, h } = state.viewBox;
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  };

  const resetView = () => {
    if (!state.baseViewBox) {
      return;
    }
    state.viewBox = { ...state.baseViewBox };
    applyViewBox();
  };

  const renderContours = (contours) => {
    svg.innerHTML = '';
    if (!contours || contours.length === 0) {
      const text = createSvgElement('text', { x: 12, y: 20, fill: '#5e6c63' });
      text.textContent = 'Немає даних для перегляду.';
      svg.appendChild(text);
      state.baseViewBox = null;
      state.viewBox = null;
      return;
    }

    // Calculate bounds for each contour separately and add offsets
    const CONTOUR_OFFSET_X = 2000; // mm between contours horizontally
    const CONTOUR_OFFSET_Y = 2000; // mm between contours vertically

    let globalMinX = Infinity;
    let globalMinY = Infinity;
    let globalMaxX = -Infinity;
    let globalMaxY = -Infinity;

    // First pass: calculate bounds for each contour
    const contourBounds = contours.map((contour) => {
      const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };

      contour.vertices.forEach((vertex) => {
        bounds.minX = Math.min(bounds.minX, vertex.x);
        bounds.minY = Math.min(bounds.minY, vertex.y);
        bounds.maxX = Math.max(bounds.maxX, vertex.x);
        bounds.maxY = Math.max(bounds.maxY, vertex.y);
      });

      if (!Number.isFinite(bounds.minX)) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
      }

      return {
        ...bounds,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY
      };
    });

    // Second pass: calculate offsets for each contour
    const CONTOURS_PER_ROW = 3;
    const rowHeights = [];
    const rowYPositions = [];

    // Calculate row heights first
    for (let row = 0; row < Math.ceil(contours.length / CONTOURS_PER_ROW); row++) {
      const startIndex = row * CONTOURS_PER_ROW;
      const endIndex = Math.min(startIndex + CONTOURS_PER_ROW, contours.length);
      let maxRowHeight = 0;
      for (let i = startIndex; i < endIndex; i++) {
        maxRowHeight = Math.max(maxRowHeight, contourBounds[i].height);
      }
      rowHeights[row] = maxRowHeight;
    }

    // Calculate Y position for each row
    let currentY = 0;
    for (let row = 0; row < rowHeights.length; row++) {
      rowYPositions[row] = currentY;
      currentY += rowHeights[row] + CONTOUR_OFFSET_Y;
    }

    // Calculate offsets for each contour
    const contourOffsets = contours.map((contour, contourIndex) => {
      const bounds = contourBounds[contourIndex];
      const row = Math.floor(contourIndex / CONTOURS_PER_ROW);
      const col = contourIndex % CONTOURS_PER_ROW;

      // Calculate X position for this column in this row
      let currentX = 0;
      for (let c = 0; c < col; c++) {
        const colIndex = row * CONTOURS_PER_ROW + c;
        if (colIndex < contours.length) {
          currentX += contourBounds[colIndex].width + CONTOUR_OFFSET_X;
        }
      }

      const offsetX = currentX;
      const offsetY = rowYPositions[row];

      // Update global bounds
      const offsetMinX = bounds.minX + offsetX;
      const offsetMinY = bounds.minY + offsetY;
      const offsetMaxX = bounds.maxX + offsetX;
      const offsetMaxY = bounds.maxY + offsetY;

      globalMinX = Math.min(globalMinX, offsetMinX);
      globalMinY = Math.min(globalMinY, offsetMinY);
      globalMaxX = Math.max(globalMaxX, offsetMaxX);
      globalMaxY = Math.max(globalMaxY, offsetMaxY);

      return { offsetX, offsetY, bounds };
    });

    // Handle empty contours
    if (!Number.isFinite(globalMinX)) {
      globalMinX = 0;
      globalMinY = 0;
      globalMaxX = 100;
      globalMaxY = 100;
    }

    const padding = 40;
    const width = Math.max(1, globalMaxX - globalMinX);
    const height = Math.max(1, globalMaxY - globalMinY);

    state.baseViewBox = {
      x: globalMinX - padding,
      y: globalMinY - padding,
      w: width + padding * 2,
      h: height + padding * 2
    };
    state.viewBox = { ...state.baseViewBox };
    applyViewBox();

    const viewport = createSvgElement('g');
    svg.appendChild(viewport);

    // Third pass: render contours with offsets
    contours.forEach((contour, contourIndex) => {
      const offset = contourOffsets[contourIndex];
      const path = createSvgElement('path', {
        fill: 'none',
        stroke: '#1f2a24',
        'stroke-width': 1.4,
        'vector-effect': 'non-scaling-stroke'
      });
      const points = contour.vertices;
      if (!points.length) {
        return;
      }
      const d = points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x + offset.offsetX} ${p.y + offset.offsetY}`)
        .join(' ');
      path.setAttribute('d', `${d} Z`);
      viewport.appendChild(path);
    });
  };

  const toSvgCoords = (event) => {
    const rect = svg.getBoundingClientRect();
    if (!state.viewBox) {
      return null;
    }
    const x = state.viewBox.x + ((event.clientX - rect.left) / rect.width) * state.viewBox.w;
    const y = state.viewBox.y + ((event.clientY - rect.top) / rect.height) * state.viewBox.h;
    return { x, y };
  };

  svg.addEventListener('wheel', (event) => {
    if (!state.viewBox || !state.baseViewBox) {
      return;
    }
    event.preventDefault();
    const cursor = toSvgCoords(event);
    if (!cursor) {
      return;
    }
    const currentZoom = state.baseViewBox.w / state.viewBox.w;
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(DEFAULT_ZOOM_MAX, Math.max(DEFAULT_ZOOM_MIN, currentZoom * zoomFactor));
    const nextW = state.baseViewBox.w / nextZoom;
    const nextH = state.baseViewBox.h / nextZoom;

    state.viewBox.x = cursor.x - ((cursor.x - state.viewBox.x) / state.viewBox.w) * nextW;
    state.viewBox.y = cursor.y - ((cursor.y - state.viewBox.y) / state.viewBox.h) * nextH;
    state.viewBox.w = nextW;
    state.viewBox.h = nextH;
    applyViewBox();
  }, { passive: false });

  svg.addEventListener('mousedown', (event) => {
    if (!state.viewBox) {
      return;
    }
    state.isDragging = true;
    state.dragStart = {
      x: event.clientX,
      y: event.clientY,
      viewBox: { ...state.viewBox }
    };
  });

  window.addEventListener('mousemove', (event) => {
    if (!state.isDragging || !state.dragStart || !state.viewBox) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - state.dragStart.x) / rect.width) * state.dragStart.viewBox.w;
    const dy = ((event.clientY - state.dragStart.y) / rect.height) * state.dragStart.viewBox.h;
    state.viewBox.x = state.dragStart.viewBox.x - dx;
    state.viewBox.y = state.dragStart.viewBox.y - dy;
    applyViewBox();
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
    state.dragStart = null;
  });

  svg.addEventListener('dblclick', (event) => {
    event.preventDefault();
    resetView();
  });

  return {
    element: wrapper,
    setContours: renderContours
  };
}
