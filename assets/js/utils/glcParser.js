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

export function decodeWindows1251(buffer) {
  if (typeof TextDecoder !== 'undefined') {
    try {
      const decoder = new TextDecoder('windows-1251');
      return decoder.decode(buffer);
    } catch (error) {
      // Fallback to manual decoding
    }
  }
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b < 0x80) {
      result += String.fromCharCode(b);
    } else {
      result += CP1251_TABLE[b - 0x80] || '\uFFFD';
    }
  }
  return result;
}

function parseNumberPair(line) {
  const numbers = line
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(1)
    .map((val) => Number(val));
  return numbers.length >= 2 ? { x: numbers[0], y: numbers[1] } : null;
}

function parseSingleNumber(line) {
  const parts = line.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const value = Number(parts[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function parseKeyValue(line, key) {
  if (!line.startsWith(key)) {
    return null;
  }
  return line.slice(key.length).trim();
}

function parseOtrArcs(lines) {
  const arcHeights = new Map();
  lines.forEach((line) => {
    if (line.startsWith('OtrArcHei')) {
      const parts = line.replace(',', ' ').split(/\s+/).filter(Boolean);
      const idx = Number(parts[1]);
      const value = Number(parts[2]);
      if (Number.isFinite(idx)) {
        arcHeights.set(idx, value);
      }
    }
  });
  return arcHeights;
}

function parseOtrList(lines) {
  const segments = [];
  let current = null;
  lines.forEach((line) => {
    if (line === 'NPLine') {
      current = {
        start: null,
        end: null,
        arcPoint: null,
        arcHei: null,
        wid1: null,
        poNumber1: null,
        poNumber2: null,
        jValue: null,
        idntBeg: null,
        idntEnd: null,
        idntBeg2: null,
        idntEnd2: null,
        fixedBeg: null
      };
      return;
    }
    if (!current) {
      return;
    }
    if (line.startsWith('PoBeg')) {
      current.start = parseNumberPair(line);
    } else if (line.startsWith('PoEnd')) {
      current.end = parseNumberPair(line);
    } else if (line.startsWith('ArcPoint')) {
      current.arcPoint = parseNumberPair(line);
    } else if (line.startsWith('ArcHei')) {
      current.arcHei = parseSingleNumber(line);
    } else if (line.startsWith('Wid1')) {
      current.wid1 = parseSingleNumber(line);
    } else if (line.startsWith('PoNumber1')) {
      current.poNumber1 = parseSingleNumber(line);
    } else if (line.startsWith('PoNumber2')) {
      current.poNumber2 = parseSingleNumber(line);
    } else if (line.startsWith('JValue')) {
      current.jValue = parseSingleNumber(line);
    } else if (line.startsWith('IdntBeg2')) {
      current.idntBeg2 = parseKeyValue(line, 'IdntBeg2');
    } else if (line.startsWith('IdntEnd2')) {
      current.idntEnd2 = parseKeyValue(line, 'IdntEnd2');
    } else if (line.startsWith('IdntBeg')) {
      current.idntBeg = parseKeyValue(line, 'IdntBeg');
    } else if (line.startsWith('IdntEnd')) {
      current.idntEnd = parseKeyValue(line, 'IdntEnd');
    } else if (line.startsWith('FixedBeg')) {
      current.fixedBeg = parseKeyValue(line, 'FixedBeg');
    } else if (line === 'END') {
      if (current.start && current.end) {
        segments.push(current);
      }
      current = null;
    }
  });
  return segments;
}

function buildContour(pointsBlock, otrListSegments, arcHeights, metadata = {}) {
  const vertices = [];
  const segments = [];
  const arcs = [];

  otrListSegments.forEach((seg, idx) => {
    const startIndex = idx;
    const endIndex = idx === otrListSegments.length - 1 ? 0 : idx + 1;
    const start = seg.start;
    const end = seg.end;

    if (start) {
      vertices.push({
        id: `v-${idx}`,
        name: (seg.idntBeg || '').trim() || '',
        x: start.x,
        y: start.y,
        isAnglePoint: false,
        originalIndex: idx
      });
    }

    const arcHei = seg.arcHei ?? arcHeights.get(idx);
    const hasArc = Number.isFinite(arcHei) && arcHei !== 0;
    let arcInfo = null;
    let length = 0;

    if (start && end) {
      const chord = Math.hypot(end.x - start.x, end.y - start.y);
      if (hasArc) {
        const sagitta = Math.abs(arcHei);
        const radius = sagitta === 0 ? Infinity : (chord * chord) / (8 * sagitta) + sagitta / 2;
        const angle = radius === Infinity ? 0 : 2 * Math.asin(Math.min(1, chord / (2 * radius)));
        length = radius === Infinity ? chord : radius * angle;
        arcInfo = {
          arcPoint: seg.arcPoint || { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
          arcHei: arcHei,
          arcLength: length,
          radius
        };
        arcs.push(arcInfo);
      } else {
        length = chord;
      }
    }

    segments.push({
      id: `s-${idx}`,
      startIndex,
      endIndex,
      length,
      hasArc,
      arcInfo,
      jValue: seg.jValue,
      metadata: seg
    });
  });

  // mark angle points
  pointsBlock.forEach((point) => {
    const match = vertices.find((v) => Math.abs(v.x - point.x) < 1e-6 && Math.abs(v.y - point.y) < 1e-6);
    if (match) {
      match.isAnglePoint = true;
    }
  });

  return {
    id: metadata.id || 'outer-0',
    name: metadata.name || 'Contour',
    type: metadata.type || 'outer',
    vertices,
    segments,
    arcs,
    metadata,
    isProcessed: false,
    isProcessedEligible: metadata.type === 'outer'
  };
}

function extractBlock(lines, startToken, endToken) {
  const startIndex = lines.indexOf(startToken);
  if (startIndex === -1) {
    return { lines: [], startIndex: -1, endIndex: -1 };
  }
  const endIndex = lines.indexOf(endToken, startIndex + 1);
  if (endIndex === -1) {
    return { lines: [], startIndex, endIndex: -1 };
  }
  return {
    lines: lines.slice(startIndex + 1, endIndex),
    startIndex,
    endIndex
  };
}

function parsePoints(lines) {
  return lines
    .filter((line) => line.startsWith('AnglePoint'))
    .map((line) => parseNumberPair(line))
    .filter(Boolean);
}

function parseRoom(roomLines, index) {
  const nameLine = roomLines.find((line) => line.startsWith('RoomName')) || '';
  const name = nameLine.replace('RoomName', '').replace(':', '').trim() || `Room ${index + 1}`;
  const uidLine = roomLines.find((line) => line.startsWith('UID1')) || '';
  const uid = uidLine.replace('UID1', '').replace(':', '').trim();

  const pointsBlock = extractBlock(roomLines, 'POINTS', 'POINTSEND');
  const points = parsePoints(pointsBlock.lines);
  const otrArcsBlock = extractBlock(roomLines, 'OTRARCS', 'OTRARCSEND');
  const otrListBlock = extractBlock(roomLines, 'otrlist_', 'otrlist_end');
  const paramsBlock = extractBlock(roomLines, 'PARAMS2_BEGIN', 'PARAMS2_END');
  const gvalsBlock = extractBlock(roomLines, 'GValsBegin', 'GValsEnd');

  const arcHeights = parseOtrArcs(otrArcsBlock.lines);
  const otrSegments = parseOtrList(otrListBlock.lines);

  const contour = buildContour(points, otrSegments, arcHeights, {
    id: `room-${index + 1}`,
    name,
    type: 'outer'
  });

  return {
    name,
    uid,
    lines: roomLines,
    blocks: {
      points: pointsBlock,
      otrarcs: otrArcsBlock,
      otrlist: otrListBlock,
      params: paramsBlock,
      gvals: gvalsBlock
    },
    contour,
    paramsLines: paramsBlock.lines,
    gvalsLines: gvalsBlock.lines
  };
}

export function parseGlc(arrayBuffer) {
  const text = decodeWindows1251(arrayBuffer);
  const lines = text.split(/\r\n|\n/);
  const errors = [];

  if (!lines.includes('ROOMBEGIN')) {
    errors.push({ code: 'INVALID_GLC_STRUCTURE', message: 'Missing ROOMBEGIN block', severity: 'error' });
  }
  if (!lines.includes('otrlist_')) {
    errors.push({ code: 'INVALID_GLC_STRUCTURE', message: 'Missing otrlist_ block', severity: 'error' });
  }
  if (!lines.includes('POINTS')) {
    errors.push({ code: 'INVALID_GLC_STRUCTURE', message: 'Missing POINTS block', severity: 'warning' });
  }

  const rooms = [];
  let currentRoom = null;

  lines.forEach((line) => {
    if (line === 'ROOMBEGIN') {
      currentRoom = [];
      currentRoom.push(line);
      return;
    }
    if (currentRoom) {
      currentRoom.push(line);
      if (line === 'ROOMEND') {
        rooms.push(currentRoom);
        currentRoom = null;
      }
    }
  });

  const parsedRooms = rooms.map((roomLines, index) => parseRoom(roomLines, index));

  return {
    rawText: text,
    lines,
    rooms: parsedRooms,
    errors
  };
}
