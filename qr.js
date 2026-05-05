// QR encoder paso a paso (modo byte). Soporta versiones 1-5 con ECC L y M.
// Hecho a propósito explícito y didáctico, no optimizado.
(function (global) {
  'use strict';

  // ---------- GF(256) ----------
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function genPoly(deg) {
    let p = [1];
    for (let i = 0; i < deg; i++) {
      const np = new Array(p.length + 1).fill(0);
      for (let j = 0; j < p.length; j++) {
        np[j] ^= p[j];
        np[j + 1] ^= gfMul(p[j], EXP[i]);
      }
      p = np;
    }
    return p;
  }

  function rsEncode(data, ecLen) {
    const gen = genPoly(ecLen);
    const buf = data.concat(new Array(ecLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = buf[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          buf[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return buf.slice(data.length);
  }

  // ---------- versiones (sólo modo byte, ECC L y M) ----------
  const VERSIONS = {
    '1-L': { total: 26,  ec: 7,  blocks: [[1, 19]] },
    '1-M': { total: 26,  ec: 10, blocks: [[1, 16]] },
    '2-L': { total: 44,  ec: 10, blocks: [[1, 34]] },
    '2-M': { total: 44,  ec: 16, blocks: [[1, 28]] },
    '3-L': { total: 70,  ec: 15, blocks: [[1, 55]] },
    '3-M': { total: 70,  ec: 26, blocks: [[1, 44]] },
    '4-L': { total: 100, ec: 20, blocks: [[1, 80]] },
    '4-M': { total: 100, ec: 18, blocks: [[2, 32]] },
    '5-L': { total: 134, ec: 26, blocks: [[1, 108]] },
    '5-M': { total: 134, ec: 24, blocks: [[2, 43]] },
  };

  // bits restantes después de los datos por versión
  const REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7 };

  // posiciones de los patrones de alineación
  const ALIGN_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
  };

  function pickVersion(byteLen, ecc) {
    for (let v = 1; v <= 5; v++) {
      const cfg = VERSIONS[v + '-' + ecc];
      if (!cfg) continue;
      let dataCw = 0;
      for (const [n, d] of cfg.blocks) dataCw += n * d;
      const reqBytes = Math.ceil((4 + 8 + 8 * byteLen) / 8);
      if (reqBytes <= dataCw) return v;
    }
    throw new Error('Texto demasiado largo para v1–5 con ECC ' + ecc);
  }

  // ---------- bytes ----------
  function textToBytes(s) {
    return Array.from(new TextEncoder().encode(s));
  }

  function printable(b) {
    if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b);
    return '·';
  }

  // ---------- bitstream ----------
  function buildBitstream(bytes, version, ecc) {
    const cfg = VERSIONS[version + '-' + ecc];
    let dataCw = 0;
    for (const [n, d] of cfg.blocks) dataCw += n * d;
    const totalBits = dataCw * 8;

    const parts = [];
    parts.push({ label: 'Modo (byte=0100)', bits: '0100', kind: 'mode' });
    const lenBits = bytes.length.toString(2).padStart(8, '0');
    parts.push({ label: `Longitud=${bytes.length}`, bits: lenBits, kind: 'len' });
    for (let i = 0; i < bytes.length; i++) {
      parts.push({
        label: `Dato[${i}]=0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()} '${printable(bytes[i])}'`,
        bits: bytes[i].toString(2).padStart(8, '0'),
        kind: 'data',
        byteIdx: i,
        char: printable(bytes[i]),
        byteVal: bytes[i],
      });
    }
    let used = parts.reduce((s, p) => s + p.bits.length, 0);
    const term = Math.min(4, totalBits - used);
    if (term > 0) {
      parts.push({ label: 'Terminador (hasta 4 ceros)', bits: '0'.repeat(term), kind: 'term' });
      used += term;
    }
    if (used % 8 !== 0) {
      const pad = 8 - (used % 8);
      parts.push({ label: 'Pad a byte', bits: '0'.repeat(pad), kind: 'pad' });
      used += pad;
    }
    const PAD_BYTES = [0xec, 0x11];
    let pi = 0;
    while (used < totalBits) {
      parts.push({
        label: `Pad 0x${PAD_BYTES[pi].toString(16).toUpperCase()}`,
        bits: PAD_BYTES[pi].toString(2).padStart(8, '0'),
        kind: 'padbyte',
      });
      used += 8;
      pi = 1 - pi;
    }
    return parts;
  }

  function bitsToBytes(parts) {
    const all = parts.map((p) => p.bits).join('');
    const out = [];
    for (let i = 0; i < all.length; i += 8) out.push(parseInt(all.slice(i, i + 8), 2));
    return out;
  }

  // ---------- bloques + ECC ----------
  function buildBlocks(dataBytes, version, ecc) {
    const cfg = VERSIONS[version + '-' + ecc];
    const blocks = [];
    let off = 0;
    for (const [n, d] of cfg.blocks) {
      for (let i = 0; i < n; i++) {
        const data = dataBytes.slice(off, off + d);
        const ecv = rsEncode(data, cfg.ec);
        blocks.push({ data, ec: ecv });
        off += d;
      }
    }
    return { blocks, ecPerBlock: cfg.ec };
  }

  function interleave(blocks) {
    const dataMax = Math.max(...blocks.map((b) => b.data.length));
    const ecMax = Math.max(...blocks.map((b) => b.ec.length));
    const out = [];
    for (let i = 0; i < dataMax; i++)
      for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
    for (let i = 0; i < ecMax; i++)
      for (const b of blocks) if (i < b.ec.length) out.push(b.ec[i]);
    return out;
  }

  // ---------- matriz ----------
  function size(v) { return 17 + 4 * v; }

  function buildMatrix(version) {
    const N = size(version);
    const m = Array.from({ length: N }, () => new Array(N).fill(null));
    const reserved = Array.from({ length: N }, () => new Array(N).fill(false));
    const fn = Array.from({ length: N }, () => new Array(N).fill(false));

    function setFinder(r, c) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
          const isFinder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          if (isFinder) {
            const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
            const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
            m[rr][cc] = inner || ring;
          } else {
            m[rr][cc] = false;
          }
          reserved[rr][cc] = true;
          fn[rr][cc] = true;
        }
      }
    }
    setFinder(0, 0);
    setFinder(0, N - 7);
    setFinder(N - 7, 0);

    // alignment
    const ap = ALIGN_POS[version];
    for (const r of ap) for (const c of ap) {
      if ((r < 8 && c < 8) || (r < 8 && c > N - 9) || (r > N - 9 && c < 8)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr, cc = c + dc;
        const ring = Math.abs(dr) === 2 || Math.abs(dc) === 2;
        const center = dr === 0 && dc === 0;
        m[rr][cc] = ring || center;
        reserved[rr][cc] = true;
        fn[rr][cc] = true;
      }
    }

    // timing
    for (let i = 8; i < N - 8; i++) {
      if (m[6][i] === null) { m[6][i] = i % 2 === 0; reserved[6][i] = true; fn[6][i] = true; }
      if (m[i][6] === null) { m[i][6] = i % 2 === 0; reserved[i][6] = true; fn[i][6] = true; }
    }

    // dark module
    m[4 * version + 9][8] = true;
    reserved[4 * version + 9][8] = true;
    fn[4 * version + 9][8] = true;

    // reserve format info
    for (let i = 0; i <= 8; i++) {
      if (!reserved[8][i]) { reserved[8][i] = true; m[8][i] = false; }
      if (!reserved[i][8]) { reserved[i][8] = true; m[i][8] = false; }
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][N - 1 - i]) { reserved[8][N - 1 - i] = true; m[8][N - 1 - i] = false; }
      if (!reserved[N - 1 - i][8]) { reserved[N - 1 - i][8] = true; m[N - 1 - i][8] = false; }
    }

    return { m, reserved, fn, N };
  }

  function dataPath(matrix) {
    const { reserved, N } = matrix;
    const path = [];
    let upward = true;
    let col = N - 1;
    while (col > 0) {
      if (col === 6) col--;
      for (let row = 0; row < N; row++) {
        const r = upward ? N - 1 - row : row;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (!reserved[r][c]) path.push([r, c]);
        }
      }
      col -= 2;
      upward = !upward;
    }
    return path;
  }

  function placeData(matrix, codewords, version) {
    const bits = [];
    for (const cw of codewords)
      for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
    const rem = REMAINDER[version] || 0;
    for (let i = 0; i < rem; i++) bits.push(0);
    const path = dataPath(matrix);
    for (let i = 0; i < path.length; i++) {
      const [r, c] = path[i];
      matrix.m[r][c] = i < bits.length ? !!bits[i] : false;
    }
    return { path, bits };
  }

  // ---------- máscaras ----------
  const MASKS = [
    (i, j) => (i + j) % 2 === 0,
    (i, j) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
  ];

  function applyMask(matrix, maskNum) {
    const { m, reserved, N } = matrix;
    const fn = MASKS[maskNum];
    const out = m.map((r) => r.slice());
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (!reserved[i][j] && fn(i, j)) out[i][j] = !out[i][j];
    return out;
  }

  // ---------- format info ----------
  function formatBits(ecc, mask) {
    const eccBits = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }[ecc];
    const data = (eccBits << 3) | mask;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) {
      if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
    }
    const code = ((data << 10) | rem) ^ 0x5412;
    const bits = [];
    for (let i = 0; i < 15; i++) bits.push((code >> i) & 1);
    return bits;
  }

  function placeFormat(grid, fbits, N) {
    // Convención ISO/IEC 18004 §8.9: bit 0 más cerca del patrón buscador,
    // bit 14 más alejado. Para la copia top-left: bit 0 en (0,8) bajando por
    // la columna 8, luego horizontal por la fila 8 hacia la izquierda hasta
    // bit 14 en (8,0).
    const tl = [
      [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
      [7, 8], [8, 8], [8, 7],
      [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    ];
    // Segunda copia: bit 0 en (8, N-1) en la fila 8 (horizontal derecha),
    // hasta bit 7 en (8, N-8); luego bit 8 en (N-7, 8) bajando por col 8
    // hasta bit 14 en (N-1, 8). Ambas copias contienen los mismos 15 bits.
    const br = [
      [8, N - 1], [8, N - 2], [8, N - 3], [8, N - 4], [8, N - 5], [8, N - 6], [8, N - 7], [8, N - 8],
      [N - 7, 8], [N - 6, 8], [N - 5, 8], [N - 4, 8], [N - 3, 8], [N - 2, 8], [N - 1, 8],
    ];
    for (let i = 0; i < 15; i++) {
      const [r1, c1] = tl[i]; grid[r1][c1] = !!fbits[i];
      const [r2, c2] = br[i]; grid[r2][c2] = !!fbits[i];
    }
  }

  // ---------- penalización ----------
  function penalty(grid, N) {
    let p = 0;
    for (let i = 0; i < N; i++) {
      let runR = 1, runC = 1;
      for (let j = 1; j < N; j++) {
        if (grid[i][j] === grid[i][j - 1]) {
          runR++;
          if (runR === 5) p += 3; else if (runR > 5) p += 1;
        } else runR = 1;
        if (grid[j][i] === grid[j - 1][i]) {
          runC++;
          if (runC === 5) p += 3; else if (runC > 5) p += 1;
        } else runC = 1;
      }
    }
    for (let i = 0; i < N - 1; i++)
      for (let j = 0; j < N - 1; j++) {
        const v = grid[i][j];
        if (v === grid[i][j + 1] && v === grid[i + 1][j] && v === grid[i + 1][j + 1]) p += 3;
      }
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function check(arr) {
      let c = 0;
      for (let i = 0; i <= arr.length - 11; i++) {
        let ok1 = true, ok2 = true;
        for (let k = 0; k < 11; k++) {
          if (arr[i + k] !== pat1[k]) ok1 = false;
          if (arr[i + k] !== pat2[k]) ok2 = false;
        }
        if (ok1 || ok2) c++;
      }
      return c;
    }
    for (let i = 0; i < N; i++) {
      const row = grid[i].map((v) => (v ? 1 : 0));
      const col = [];
      for (let j = 0; j < N; j++) col.push(grid[j][i] ? 1 : 0);
      p += 40 * (check(row) + check(col));
    }
    let dark = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (grid[i][j]) dark++;
    const ratio = dark / (N * N);
    const k = Math.floor(Math.abs(ratio * 100 - 50) / 5);
    p += k * 10;
    return p;
  }

  // ---------- API completa: produce todos los pasos ----------
  function encode(text, opts) {
    const ecc = (opts && opts.ecc) || 'L';
    const maskOpt = opts && opts.mask;

    const bytes = textToBytes(text);
    const version = pickVersion(bytes.length, ecc);
    const cfg = VERSIONS[version + '-' + ecc];

    const bsParts = buildBitstream(bytes, version, ecc);
    const dataBytes = bitsToBytes(bsParts);
    const { blocks } = buildBlocks(dataBytes, version, ecc);
    const finalCw = interleave(blocks);

    const baseMatrix = buildMatrix(version);
    // copia para ir colocando los datos
    const placed = {
      m: baseMatrix.m.map((r) => r.slice()),
      reserved: baseMatrix.reserved.map((r) => r.slice()),
      fn: baseMatrix.fn.map((r) => r.slice()),
      N: baseMatrix.N,
    };
    const { path, bits } = placeData(placed, finalCw, version);

    // probar las 8 máscaras
    const masks = [];
    for (let mi = 0; mi < 8; mi++) {
      const masked = applyMask(placed, mi);
      const fb = formatBits(ecc, mi);
      placeFormat(masked, fb, placed.N);
      const score = penalty(masked, placed.N);
      masks.push({ index: mi, grid: masked, score, formatBits: fb });
    }
    let chosen;
    if (maskOpt === 'auto' || maskOpt == null) {
      chosen = masks.reduce((a, b) => (a.score <= b.score ? a : b));
    } else {
      chosen = masks[parseInt(maskOpt, 10)];
    }

    return {
      input: text,
      bytes,
      ecc,
      version,
      cfg,
      bsParts,
      dataBytes,
      blocks,
      finalCw,
      baseMatrix,        // antes de colocar datos
      placedMatrix: placed,
      dataPath: path,
      placedBits: bits,
      masks,
      chosen,
    };
  }

  // Decompone los codewords (bytes) mostrando de qué parte lógica del
  // bitstream proviene cada bit. Devuelve, por cada codeword, una lista de
  // segmentos consecutivos {part, count, startBit} donde startBit es el
  // primer bit (0..7, MSB→LSB) que ocupa ese segmento dentro del codeword.
  function annotateCodewords(bsParts) {
    const sources = [];
    bsParts.forEach((p) => {
      for (let i = 0; i < p.bits.length; i++) {
        sources.push({ part: p, bitInPart: i });
      }
    });
    const cws = [];
    for (let cwIdx = 0; cwIdx < Math.ceil(sources.length / 8); cwIdx++) {
      const start = cwIdx * 8;
      const slice = sources.slice(start, start + 8);
      const segments = [];
      let cur = null;
      slice.forEach((src, idx) => {
        if (!cur || cur.part !== src.part) {
          cur = {
            part: src.part,
            count: 1,
            startBit: idx,
            firstBitInPart: src.bitInPart,
          };
          segments.push(cur);
        } else {
          cur.count++;
        }
      });
      cws.push(segments);
    }
    return cws;
  }

  // Para cada bit colocado en la path zigzag (en orden), determina su origen
  // *original* en el bitstream (antes del intercalado). Devuelve un array
  // paralelo a result.dataPath, con elementos del tipo:
  //   { kind: 'mode'|'len'|'data'|'term'|'pad'|'padbyte'|'ecc'|'remainder',
  //     part?: bsPart,             // si proviene del bitstream original
  //     bitInPart?: number,        // posición del bit dentro de la parte
  //     dataByteIdx?: number,      // índice del byte de datos en dataBytes
  //     cwIdx: number, bitInCw: number,   // posición en el flujo final (intercalado)
  //     block?: number, ecIdx?: number    // info para bits de ECC
  //   }
  function bitOrigins(result) {
    const { bsParts, blocks, dataPath } = result;

    const sources = [];
    bsParts.forEach((p) => {
      for (let i = 0; i < p.bits.length; i++) sources.push({ part: p, bitInPart: i });
    });

    // Mapa "forward" del intercalado: posición en finalCw -> {type, block, idx}
    const cwMeta = [];
    const dataMax = Math.max.apply(null, blocks.map((b) => b.data.length));
    const ecMax = Math.max.apply(null, blocks.map((b) => b.ec.length));
    for (let i = 0; i < dataMax; i++)
      for (let bi = 0; bi < blocks.length; bi++)
        if (i < blocks[bi].data.length) cwMeta.push({ type: 'data', block: bi, idx: i });
    for (let i = 0; i < ecMax; i++)
      for (let bi = 0; bi < blocks.length; bi++)
        if (i < blocks[bi].ec.length) cwMeta.push({ type: 'ec', block: bi, idx: i });

    // Offset de cada bloque dentro de dataBytes original
    const blockOffsets = [];
    let off = 0;
    for (const b of blocks) { blockOffsets.push(off); off += b.data.length; }

    const origins = [];
    for (let i = 0; i < dataPath.length; i++) {
      const cwIdx = Math.floor(i / 8);
      const bitInCw = i % 8;
      if (cwIdx >= cwMeta.length) {
        origins.push({ kind: 'remainder', cwIdx, bitInCw });
        continue;
      }
      const meta = cwMeta[cwIdx];
      if (meta.type === 'ec') {
        origins.push({ kind: 'ecc', block: meta.block, ecIdx: meta.idx, cwIdx, bitInCw });
        continue;
      }
      const dataBytesIdx = blockOffsets[meta.block] + meta.idx;
      const src = sources[dataBytesIdx * 8 + bitInCw];
      if (!src) {
        origins.push({ kind: 'unknown', cwIdx, bitInCw });
        continue;
      }
      origins.push({
        kind: src.part.kind,
        part: src.part,
        bitInPart: src.bitInPart,
        dataByteIdx: dataBytesIdx,
        cwIdx, bitInCw,
      });
    }
    return origins;
  }

  // Devuelve la lista de "grupos por carácter": 8 bits contiguos en la
  // bitstream que forman un byte de datos. Para v1 (1 bloque) las celdas
  // son contiguas en la path; con varios bloques pueden no serlo, pero
  // siempre se devuelven en orden.
  function characterGroups(result) {
    const origins = bitOrigins(result);
    const path = result.dataPath;
    const groups = [];
    const byIdx = new Map();
    origins.forEach((o, i) => {
      if (o.kind !== 'data') return;
      const key = o.part.byteIdx;
      let g = byIdx.get(key);
      if (!g) {
        g = {
          byteIdx: o.part.byteIdx,
          char: o.part.char,
          byteVal: o.part.byteVal,
          cells: [],
          bitPositions: [],
        };
        byIdx.set(key, g);
        groups.push(g);
      }
      g.cells.push(path[i]);
      g.bitPositions.push(i);
    });
    groups.sort((a, b) => a.byteIdx - b.byteIdx);
    return groups;
  }

  global.QR = {
    encode,
    MASKS,
    size,
    VERSIONS,
    formatBits,
    penalty,
    annotateCodewords,
    bitOrigins,
    characterGroups,
    rsEncode,
  };
})(window);
