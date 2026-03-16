import {
  DEFAULT_STRETCH_PERCENT
} from './config.js';
import { distance, computeAngle } from './geometryUtils.js';
import { decodeWindows1251 } from './glcParser.js';

const CP1251_TABLE = [
  "\u0402", "\u0403", "\u201A", "\u0453", "\u201E", "\u2026", "\u2020", "\u2021",
  "\u20AC", "\u2030", "\u0409", "\u2039", "\u040A", "\u040C", "\u040B", "\u040F",
  "\u0452", "\u2018", "\u2019", "\u201C", "\u201D", "\u2022", "\u2013", "\u2014",
  "\uFFFD", "\u2122", "\u0459", "\u203A", "\u045A", "\u045C", "\u045B", "\u045F",
  "\u00A0", "\u040E", "\u045E", "\u0408", "\u00A4", "\u0490", "\u00A6", "\u00A7",
  "\u0401", "\u00A9", "\u0404", "\u00AB", "\u00AC", "\u00AD", "\u00AE", "\u0407",
  "\u00B0", "\u00B1", "\u0406", "\u0456", "\u0491", "\u00B5", "\u00B6", "\u00B7",
  "\u0451", "\u2116", "\u0454", "\u00BB", "\u0458", "\u0405", "\u0455", "\u0457",
  "\u0410", "\u0411", "\u0412", "\u0413", "\u0414", "\u0415", "\u0416", "\u0417",
  "\u0418", "\u0419", "\u041A", "\u041B", "\u041C", "\u041D", "\u041E", "\u041F",
  "\u0420", "\u0421", "\u0422", "\u0423", "\u0424", "\u0425", "\u0426", "\u0427",
  "\u0428", "\u0429", "\u042A", "\u042B", "\u042C", "\u042D", "\u042E", "\u042F",
  "\u0430", "\u0431", "\u0432", "\u0433", "\u0434", "\u0435", "\u0436", "\u0437",
  "\u0438", "\u0439", "\u043A", "\u043B", "\u043C", "\u043D", "\u043E", "\u043F",
  "\u0440", "\u0441", "\u0442", "\u0443", "\u0444", "\u0445", "\u0446", "\u0447",
  "\u0448", "\u0449", "\u044A", "\u044B", "\u044C", "\u044D", "\u044E", "\u044F"
];

const CP1251_ENCODE_MAP = new Map();
CP1251_TABLE.forEach((char, index) => {
  if (char !== '\uFFFD') {
    CP1251_ENCODE_MAP.set(char, 0x80 + index);
  }
});

export function encodeWindows1251(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (CP1251_ENCODE_MAP.has(char)) {
      bytes.push(CP1251_ENCODE_MAP.get(char));
    } else {
      bytes.push(0x3F); // '?'
    }
  }
  return new Uint8Array(bytes);
}

function formatNumber(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '0';
  }
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, '') || '0';
}

function computeArea(vertices) {
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const p = vertices[i];
    const q = vertices[(i + 1) % vertices.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum / 2);
}

function computeMetrics(contour) {
  const vertices = contour.vertices;
  const areaMm2 = vertices.length >= 3 ? computeArea(vertices) : 0;
  let perimeterMm = 0;
  let arcCount = 0;
  let arcLengthMm = 0;

  contour.segments.forEach((segment) => {
    if (segment.hasArc && segment.arcInfo && Number.isFinite(segment.arcInfo.arcLength)) {
      perimeterMm += segment.arcInfo.arcLength;
      arcCount += 1;
      arcLengthMm += segment.arcInfo.arcLength;
    } else {
      const start = vertices[segment.startIndex];
      const end = vertices[segment.endIndex];
      perimeterMm += distance(start, end);
    }
  });

  let internalAngles = 0;
  vertices.forEach((vertex, index) => {
    const prev = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const { angle } = computeAngle(prev, vertex, next, true);
    if (angle > 180) {
      internalAngles += 1;
    }
  });
  const totalAngles = vertices.length;
  const externalAngles = Math.max(0, totalAngles - internalAngles);

  return {
    areaMm2,
    perimeterMm,
    internalAngles,
    externalAngles,
    arcCount,
    arcLengthMm
  };
}

function updateKeyValueLines(lines, updates) {
  const newLines = [];
  const used = new Set();

  lines.forEach((line) => {
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && updates[parts[0]] !== undefined) {
      newLines.push(`${parts[0]} ${updates[parts[0]]}`);
      used.add(parts[0]);
    } else {
      newLines.push(line);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (!used.has(key)) {
      newLines.push(`${key} ${value}`);
    }
  });

  return newLines;
}

function buildPointsBlock(vertices) {
  return vertices.map((v) => `AnglePoint ${formatNumber(v.x)} ${formatNumber(v.y)}`);
}

function buildOtrArcsBlock(segments) {
  const lines = [];
  segments.forEach((segment, idx) => {
    lines.push(`WallWid3 ${idx}, 0`);
    if (segment.hasArc && segment.arcInfo && Number.isFinite(segment.arcInfo.arcHei)) {
      lines.push(`OtrArcHei ${idx}, ${formatNumber(segment.arcInfo.arcHei)}`);
    }
  });
  return lines;
}

function buildOtrListBlock(contour) {
  const { vertices, segments } = contour;
  const lines = [];

  segments.forEach((segment, idx) => {
    const start = vertices[segment.startIndex];
    const end = vertices[segment.endIndex];
    const po1 = idx + 1;
    const po2 = idx === segments.length - 1 ? 1 : idx + 2;
    const metadata = segment.metadata || {};

    lines.push('NPLine');
    lines.push(`PoBeg ${formatNumber(start.x)} ${formatNumber(start.y)}`);
    lines.push(`PoEnd ${formatNumber(end.x)} ${formatNumber(end.y)}`);

    if (segment.hasArc && segment.arcInfo && segment.arcInfo.arcPoint) {
      lines.push(`ArcPoint ${formatNumber(segment.arcInfo.arcPoint.x)} ${formatNumber(segment.arcInfo.arcPoint.y)}`);
      lines.push(`ArcHei ${formatNumber(segment.arcInfo.arcHei)}`);
    }

    lines.push(`Wid1 ${metadata.wid1 ?? 100}`);
    lines.push(`PoNumber1 ${po1}`);
    lines.push(`PoNumber2 ${po2}`);
    lines.push(`JValue ${formatNumber(distance(start, end))}`);
    lines.push(`IdntBeg ${start.name}`);
    lines.push(`IdntEnd ${end.name}`);
    lines.push(`IdntBeg2 ${metadata.idntBeg2 ?? ''}`);
    lines.push(`IdntEnd2 ${metadata.idntEnd2 ?? ''}`);
    lines.push(`FixedBeg ${metadata.fixedBeg ?? 'False'}`);
    lines.push('END');
  });

  return lines;
}

function replaceBlocks(roomLines, blocks, replacements) {
  const output = [];
  for (let i = 0; i < roomLines.length; i += 1) {
    const line = roomLines[i];
    if (line === 'POINTS' && replacements.points) {
      output.push('POINTS');
      output.push(...replacements.points);
      output.push('POINTSEND');
      i = blocks.points.endIndex;
      continue;
    }
    if (line === 'OTRARCS' && replacements.otrarcs) {
      output.push('OTRARCS');
      output.push(...replacements.otrarcs);
      output.push('OTRARCSEND');
      i = blocks.otrarcs.endIndex;
      continue;
    }
    if (line === 'otrlist_' && replacements.otrlist) {
      output.push('otrlist_');
      output.push(...replacements.otrlist);
      output.push('otrlist_end');
      i = blocks.otrlist.endIndex;
      continue;
    }
    if (line === 'PARAMS2_BEGIN' && replacements.params) {
      output.push('PARAMS2_BEGIN');
      output.push(...replacements.params);
      output.push('PARAMS2_END');
      i = blocks.params.endIndex;
      continue;
    }
    if (line === 'GValsBegin' && replacements.gvals) {
      output.push('GValsBegin');
      output.push(...replacements.gvals);
      output.push('GValsEnd');
      i = blocks.gvals.endIndex;
      continue;
    }
    output.push(line);
  }
  return output;
}

export function buildGlc(parsed) {
  const roomOutputs = parsed.rooms.map((room) => {
    const contour = room.contour;
    const metrics = computeMetrics(contour);
    const points = buildPointsBlock(contour.vertices);
    const otrArcs = buildOtrArcsBlock(contour.segments);
    const otrList = buildOtrListBlock(contour);

    const gvalsUpdates = {
      A: formatNumber(metrics.areaMm2 / 1000000, 6),
      D: formatNumber(metrics.perimeterMm / 1000, 6),
      E: metrics.internalAngles,
      F: metrics.externalAngles,
      I: metrics.arcCount,
      J: formatNumber(metrics.arcLengthMm / 1000, 6)
    };

    const gvals = updateKeyValueLines(room.gvalsLines || [], gvalsUpdates);

    let params = room.paramsLines || [];
    if (contour.isProcessed) {
      params = updateKeyValueLines(params, {
        StretchParamPer: DEFAULT_STRETCH_PERCENT,
        StretchParamPer_2: DEFAULT_STRETCH_PERCENT
      });
    }

    return replaceBlocks(room.lines, room.blocks, {
      points,
      otrarcs: otrArcs,
      otrlist: otrList,
      params,
      gvals
    });
  });

  const lines = roomOutputs.flat();
  return lines.join('\r\n') + '\r\n';
}

export function buildGlcBytes(parsed) {
  const text = buildGlc(parsed);
  return encodeWindows1251(text);
}

export function parseGlcTextToBytes(text) {
  return encodeWindows1251(text);
}

export function parseGlcTextToLines(text) {
  return decodeWindows1251(parseGlcTextToBytes(text)).split(/\r\n|\n/);
}
