import { DEFAULT_ZOOM_MIN, DEFAULT_ZOOM_MAX } from '../utils/config.js';

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

function computeBounds(contours) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  contours.forEach((contour) => {
    contour.vertices.forEach((vertex) => {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    });
  });

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return { minX, minY, maxX, maxY };
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

    const bounds = computeBounds(contours);
    const padding = 40;
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);

    state.baseViewBox = {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      w: width + padding * 2,
      h: height + padding * 2
    };
    state.viewBox = { ...state.baseViewBox };
    applyViewBox();

    const viewport = createSvgElement('g');
    svg.appendChild(viewport);

    contours.forEach((contour) => {
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
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
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
