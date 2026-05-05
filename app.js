// Visualizador paso a paso del proceso de codificación de un QR.
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const stepsRoot = $('#steps');
  const tpl = $('#step-template');

  const BYTE_COLORS = [
    '#ff7b72','#ffa657','#ffd166','#a5d6ff',
    '#b392f0','#f778ba','#79c0ff','#7ee787',
    '#ffab70','#d2a8ff','#ff9ec0','#56d4dd',
    '#ffd75f','#c5d1eb','#95e1d3','#f5b7b1',
    '#ff6b6b','#feca57','#48dbfb','#1dd1a1',
    '#5f27cd','#ee5253','#10ac84','#341f97',
    '#ff9ff3','#54a0ff','#5f6caf','#ffb142',
    '#ff5252','#00d2d3','#576574','#222f3e',
  ];

  function colorFor(i) { return BYTE_COLORS[i % BYTE_COLORS.length]; }

  function makeStep(num, title, explain) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.step-number').textContent = num;
    node.querySelector('.step-title').textContent = title;
    if (explain) node.querySelector('.step-explain').innerHTML = explain;
    stepsRoot.appendChild(node);
    return node.querySelector('.step-body');
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children) for (const c of children) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  // ---- Render: bytes con bits ----
  function renderByteRow(items) {
    // items: [{label, bits, color, top?, sub?, bitColors?}]
    // bitColors: array de 8 colores para teñir cada bit individualmente
    const row = el('div', { class: 'bits-row' });
    items.forEach((it) => {
      const byte = el('div', { class: 'bits-byte' });
      byte.style.borderColor = it.color;
      if (it.top) {
        const top = el('div', { class: 'byte-top', html: it.top });
        byte.appendChild(top);
      }
      const bits = el('div', { class: 'bits' });
      for (let i = 0; i < it.bits.length; i++) {
        const ch = it.bits[i];
        const span = el('span', { class: 'bit ' + (ch === '1' ? 'b1' : 'b0') }, [ch]);
        if (it.bitColors && it.bitColors[i]) {
          span.style.boxShadow = 'inset 0 -3px 0 ' + it.bitColors[i];
        }
        bits.appendChild(span);
      }
      byte.appendChild(bits);
      const label = el('div', { class: 'label', html: it.label });
      byte.appendChild(label);
      if (it.sub) {
        byte.appendChild(el('div', { class: 'byte-sub', html: it.sub }));
      }
      row.appendChild(byte);
    });
    return row;
  }

  const KIND_COLOR = {
    mode: '#62d0ff',
    len: '#ffd166',
    data: '#7ee787',
    term: '#a5a5a5',
    pad: '#777',
    padbyte: '#cf83ff',
  };
  const KIND_NAME = {
    mode: 'modo',
    len: 'len',
    data: 'dato',
    term: 'term',
    pad: 'pad',
    padbyte: 'padB',
  };

  // Etiqueta corta para un segmento dentro de un codeword.
  // Si el segmento es de datos, indica qué porción del byte origen ocupa
  // (los bits de un byte dato se numeran 7..0 — alto a bajo).
  function segmentLabel(seg) {
    const p = seg.part;
    if (p.kind === 'data') {
      const startInByte = 7 - seg.firstBitInPart;
      const endInByte = startInByte - (seg.count - 1);
      const range = (seg.count === 8)
        ? '[7..0]'
        : (seg.count === 1 ? `[${startInByte}]` : `[${startInByte}..${endInByte}]`);
      const ch = (p.char === '·') ? `0x${p.byteVal.toString(16).toUpperCase().padStart(2,'0')}` : `'${p.char}'`;
      return `${ch}${range}`;
    }
    if (p.kind === 'mode') return 'modo(0100)';
    if (p.kind === 'len') {
      const startInLen = 7 - seg.firstBitInPart;
      const endInLen = startInLen - (seg.count - 1);
      return seg.count === 8 ? 'len[7..0]' : `len[${startInLen}..${endInLen}]`;
    }
    if (p.kind === 'term') return 'term';
    if (p.kind === 'pad') return 'pad';
    if (p.kind === 'padbyte') return `pad ${p.label.replace('Pad ', '')}`;
    return p.kind;
  }

  function segmentBitColors(segments) {
    const out = new Array(8).fill(null);
    for (const seg of segments) {
      for (let k = 0; k < seg.count; k++) {
        out[seg.startBit + k] = KIND_COLOR[seg.part.kind] || '#888';
      }
    }
    return out;
  }

  // ---- Render: matriz QR como SVG ----
  function renderMatrix(grid, N, opts) {
    opts = opts || {};
    const cell = opts.cell || 14;
    const margin = opts.margin || 2;
    const total = (N + 2 * margin) * cell;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
    svg.setAttribute('xmlns', ns);
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', total);
    bg.setAttribute('height', total);
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = grid[i][j];
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', (j + margin) * cell);
        r.setAttribute('y', (i + margin) * cell);
        r.setAttribute('width', cell);
        r.setAttribute('height', cell);
        let fill = '#ffffff';
        if (v === true) fill = '#0a0c10';
        else if (v === null) fill = '#e8ecf3';
        r.setAttribute('fill', fill);
        svg.appendChild(r);
      }
    }

    // overlay: tinte por celda (color, opacity)
    if (opts.cellOverlay) {
      for (const ov of opts.cellOverlay) {
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', (ov.c + margin) * cell);
        r.setAttribute('y', (ov.r + margin) * cell);
        r.setAttribute('width', cell);
        r.setAttribute('height', cell);
        r.setAttribute('fill', ov.color);
        r.setAttribute('opacity', ov.opacity != null ? ov.opacity : 0.45);
        svg.appendChild(r);
      }
    }

    // overlay: contorno por grupo (admite varias capas vía opts.groupOutlines y opts.groupOutlines2)
    function drawOutlines(layer, style) {
      if (!layer) return;
      const inset = style.inset != null ? style.inset : 1;
      const width = style.width != null ? style.width : Math.max(1.5, cell * 0.16);
      for (const g of layer) {
        for (const [r0, c0] of g.cells) {
          const r = document.createElementNS(ns, 'rect');
          r.setAttribute('x', (c0 + margin) * cell + inset);
          r.setAttribute('y', (r0 + margin) * cell + inset);
          r.setAttribute('width', cell - 2 * inset);
          r.setAttribute('height', cell - 2 * inset);
          r.setAttribute('fill', 'none');
          r.setAttribute('stroke', g.color);
          r.setAttribute('stroke-width', width);
          r.setAttribute('opacity', style.opacity != null ? style.opacity : 0.95);
          if (style.dash) r.setAttribute('stroke-dasharray', style.dash);
          svg.appendChild(r);
        }
      }
    }
    drawOutlines(opts.groupOutlines, opts.groupOutlinesStyle || {});
    drawOutlines(opts.groupOutlines2, opts.groupOutlines2Style || { inset: 3, dash: '3,2', width: Math.max(1.2, cell * 0.10) });

    // numeración opcional sobre cada grupo (centro)
    if (opts.groupLabels) {
      for (const g of opts.groupLabels) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', (g.c + margin) * cell + cell / 2);
        t.setAttribute('y', (g.r + margin) * cell + cell / 2 + cell * 0.1);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-size', cell * 0.7);
        t.setAttribute('font-family', 'ui-monospace, monospace');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', g.color || '#04212d');
        t.textContent = g.text;
        svg.appendChild(t);
      }
    }

    return svg;
  }

  function qrCard(svg, caption, selected) {
    const c = el('div', { class: 'qr-card' + (selected ? ' selected' : '') });
    c.appendChild(svg);
    c.appendChild(el('div', { class: 'caption' }, [caption]));
    return c;
  }

  // -------------- main render --------------
  function clear() { stepsRoot.innerHTML = ''; }

  function showError(msg) {
    clear();
    const body = makeStep('!', 'Error', '');
    body.appendChild(el('div', { class: 'error' }, [msg]));
  }

  function fmtBin(n, w) { return n.toString(2).padStart(w, '0'); }
  function fmtHex(n) { return '0x' + n.toString(16).padStart(2, '0').toUpperCase(); }

  function generate() {
    clear();
    const text = $('#input-text').value || '';
    const ecc = $('#input-ecc').value;
    const maskSel = $('#input-mask').value;
    let result;
    try {
      result = QR.encode(text, { ecc, mask: maskSel });
    } catch (e) {
      showError(e.message);
      return;
    }
    const showOverlay = $('#input-overlay').checked;
    const viewMode = $('#input-view') ? $('#input-view').value : 'cw'; // 'cw' | 'char' | 'both'

    // ---------- PASO 1: texto -> bytes ----------
    {
      const body = makeStep(
        1,
        'Texto → bytes (UTF-8)',
        'Cada carácter se convierte a uno o más bytes (8 bits). Cada byte recibe un color para identificarlo en pasos posteriores.'
      );
      const items = result.bytes.map((b, i) => ({
        bits: fmtBin(b, 8),
        color: colorFor(i),
        top: `<span class="big-char">${escapeHtml(printable(b))}</span><span class="byte-idx">byte ${i}</span>`,
        label: `<b>${fmtHex(b)}</b>`,
      }));
      body.appendChild(renderByteRow(items));
      const kv = el('div', { class: 'kv' });
      kv.appendChild(el('div', { class: 'k' }, ['Texto']));
      kv.appendChild(el('div', { class: 'v' }, [JSON.stringify(text)]));
      kv.appendChild(el('div', { class: 'k' }, ['Longitud']));
      kv.appendChild(el('div', { class: 'v' }, [`${result.bytes.length} bytes`]));
      kv.appendChild(el('div', { class: 'k' }, ['Versión elegida']));
      kv.appendChild(el('div', { class: 'v' }, [`v${result.version} (${QR.size(result.version)}×${QR.size(result.version)} módulos), ECC ${result.ecc}`]));
      body.appendChild(kv);
    }

    // ---------- PASO 2: estructura del bitstream ----------
    {
      const body = makeStep(
        2,
        'Construcción del flujo de bits',
        'Se concatena: <b>modo (4 bits)</b> + <b>longitud (8 bits)</b> + <b>datos (8 bits/byte)</b> + terminador + padding hasta llenar la capacidad de la versión.'
      );
      const legend = el('div', { class: 'legend' });
      const kinds = [
        ['mode', '#62d0ff', 'modo'],
        ['len', '#ffd166', 'longitud'],
        ['data', '#7ee787', 'datos'],
        ['term', '#a5a5a5', 'terminador'],
        ['pad', '#777', 'pad bit'],
        ['padbyte', '#cf83ff', 'pad byte (EC/11)'],
      ];
      for (const [, c, name] of kinds) {
        legend.appendChild(el('span', { class: 'chip' }, [
          el('span', { class: 'swatch', style: 'background:' + c }), name,
        ]));
      }
      body.appendChild(legend);

      const stream = el('div', { class: 'bitstream' });
      result.bsParts.forEach((p) => {
        const c = kinds.find((k) => k[0] === p.kind)[1];
        const span = el('span', { class: 'group', title: p.label });
        span.style.background = c + '33';
        span.style.borderBottom = '2px solid ' + c;
        span.textContent = p.bits;
        stream.appendChild(span);
        stream.appendChild(document.createTextNode(' '));
      });
      body.appendChild(stream);

      const note = el('div', { class: 'note', html:
        `Total de bits: <b>${result.bsParts.reduce((s,p)=>s+p.bits.length,0)}</b>. Capacidad de datos para v${result.version}-${result.ecc}: <b>${result.dataBytes.length}</b> bytes.` });
      body.appendChild(note);
    }

    // ---------- PASO 3: agrupación en codewords (interactivo) ----------
    renderInteractiveStep3(result);

    // ---------- PASO 4: ECC Reed-Solomon ----------
    {
      const body = makeStep(
        4,
        'Corrección de errores Reed-Solomon',
        `Se calculan <b>${result.cfg.ec}</b> codewords de ECC por bloque (en GF(256)). Esto permite recuperar datos si parte del QR está dañado.`
      );
      result.blocks.forEach((blk, bi) => {
        const wrap = el('div', { style: 'margin-bottom:14px;' });
        wrap.appendChild(el('div', { class: 'k', style:'color:var(--muted);font-size:12px;margin-bottom:4px;' }, [`Bloque ${bi + 1} — ${blk.data.length} datos + ${blk.ec.length} ECC`]));
        const dataItems = blk.data.map((b, i) => ({
          bits: fmtBin(b, 8), color: colorFor(i),
          label: `d${i} <b>${fmtHex(b)}</b>`,
        }));
        const ecItems = blk.ec.map((b, i) => ({
          bits: fmtBin(b, 8), color: '#ff7ab6',
          label: `ec${i} <b>${fmtHex(b)}</b>`,
        }));
        wrap.appendChild(renderByteRow(dataItems.concat(ecItems)));
        body.appendChild(wrap);
      });
    }

    // ---------- PASO 5: interleaving ----------
    {
      const body = makeStep(
        5,
        'Intercalado de codewords',
        'Si hay varios bloques, los codewords se intercalan: primero se toma el byte 0 de cada bloque, luego el byte 1, etc. Después se intercalan los ECC. Así un daño localizado afecta a varios bloques sin romper ninguno.'
      );
      const totalDataBytes = result.dataBytes.length;
      const items = result.finalCw.map((b, i) => ({
        bits: fmtBin(b, 8),
        color: i < totalDataBytes ? colorFor(i) : '#ff7ab6',
        label: `cw#${i} ${i < totalDataBytes ? 'D' : 'E'} <b>${fmtHex(b)}</b>`,
      }));
      body.appendChild(renderByteRow(items));
      body.appendChild(el('div', { class: 'note', html:
        `Total: <b>${result.finalCw.length}</b> codewords (${totalDataBytes} datos + ${result.finalCw.length - totalDataBytes} ECC). El QR llevará <b>${result.finalCw.length * 8} bits útiles</b> + bits de relleno.` }));
    }

    // ---------- PASO 6: matriz base ----------
    {
      const body = makeStep(
        6,
        'Construcción de la matriz: patrones funcionales',
        'Se colocan los <b>buscadores</b> (3 esquinas), los <b>separadores</b>, los <b>patrones de alineación</b> (v≥2), las <b>filas/columnas de tiempo</b> y el <b>módulo oscuro</b>. Los huecos grises se rellenarán con datos.'
      );
      const grid = result.baseMatrix.m;
      const N = result.baseMatrix.N;
      const svg = renderMatrix(grid, N, { cell: 14 });
      const card = el('div', { class: 'qr-card', style: 'max-width:480px;margin:0 auto;' });
      card.appendChild(svg);
      card.appendChild(el('div', { class: 'caption' }, [`Matriz ${N}×${N} con módulos funcionales`]));
      body.appendChild(card);
    }

    // ---------- PASO 7: colocación de datos por zigzag ----------
    {
      const body = makeStep(
        7,
        'Colocación de datos en zigzag (cada 8 módulos = 1 byte)',
        'Los bits se escriben recorriendo la matriz por columnas de 2, en zigzag de abajo a arriba y de arriba a abajo, saltando la columna de tiempo. ' +
        '<b>Cada 8 módulos consecutivos = 1 codeword</b>. Pero <b>los caracteres también ocupan 8 bits</b> y <i>no se alinean con los codewords</i> (van desplazados 4 bits por el prefijo modo+longitud). ' +
        'Usa el selector <i>Vista</i> de arriba para ver los grupos por <b>codewords</b> (los que define la espec) o por <b>caracteres</b> (los 8 bits propios de cada letra), o ambos a la vez.'
      );

      const path = result.dataPath;
      const grid = result.placedMatrix.m;
      const N = result.placedMatrix.N;
      const totalDataBytes = result.dataBytes.length;
      const cwSegs = QR.annotateCodewords(result.bsParts);

      const showCw = viewMode === 'cw' || viewMode === 'both';
      const showChar = viewMode === 'char' || viewMode === 'both';

      const overlays = [];
      const cwOutlines = [];
      const charOutlines = [];
      const labels = [];

      if (showCw) {
        for (let g = 0; g < Math.ceil(path.length / 8); g++) {
          const cells = path.slice(g * 8, g * 8 + 8);
          const isData = g < totalDataBytes;
          const color = isData ? colorFor(g) : '#ff7ab6';
          for (const [r, c] of cells) {
            overlays.push({ r, c, color, opacity: 0.35 });
          }
          cwOutlines.push({ cells, color });
          if (cells.length > 0) {
            const [r0, c0] = cells[0];
            labels.push({ r: r0, c: c0, text: String(g), color: '#04212d' });
            // (en vista por codewords pura no etiquetamos ya el carácter,
            // porque era engañoso: una letra cae siempre entre dos codewords.)
          }
        }
      }

      const charGroups = QR.characterGroups(result);
      if (showChar) {
        charGroups.forEach((cg) => {
          const color = colorFor(cg.byteIdx);
          charOutlines.push({ cells: cg.cells, color });
          if (!showCw) {
            for (const [r, c] of cg.cells) overlays.push({ r, c, color, opacity: 0.35 });
          }
          // etiqueta del carácter en la 1.ª celda del grupo
          if (cg.cells.length > 0) {
            const [r0, c0] = cg.cells[0];
            const display = cg.char === '·' ? `0x${cg.byteVal.toString(16).toUpperCase().padStart(2,'0')}` : cg.char;
            labels.push({ r: r0, c: c0, text: display, color: '#04212d' });
          }
        });
      }

      const svgOpts = {
        cell: 22,
        cellOverlay: overlays,
        groupLabels: labels,
      };
      if (showCw) {
        svgOpts.groupOutlines = cwOutlines;
        svgOpts.groupOutlinesStyle = { inset: 1 };
      }
      if (showChar) {
        if (showCw) {
          svgOpts.groupOutlines2 = charOutlines;
          svgOpts.groupOutlines2Style = { inset: 4, dash: '3,2', width: Math.max(1.2, 22 * 0.10) };
        } else {
          svgOpts.groupOutlines = charOutlines;
          svgOpts.groupOutlinesStyle = { inset: 1 };
        }
      }
      const svg = renderMatrix(grid, N, svgOpts);
      const card = el('div', { class: 'qr-card', style: 'max-width:760px;margin:0 auto;' });
      card.appendChild(svg);
      const caption =
        viewMode === 'char'
          ? `${charGroups.length} caracteres · 8 bits cada uno. El recuadro envuelve los <b>8 módulos de la letra</b>; ya no coincide con los codewords (están desplazados 4 bits).`
          : viewMode === 'both'
          ? `${Math.ceil(path.length / 8)} codewords (sólido) + ${charGroups.length} caracteres (línea discontinua). Verás cómo cada carácter cruza la frontera de dos codewords.`
          : `${path.length} módulos de datos · ${Math.ceil(path.length / 8)} grupos. El número del grupo está en la 1.ª celda.`;
      const cap = el('div', { class: 'caption' });
      cap.innerHTML = caption;
      card.appendChild(cap);
      body.appendChild(card);

      // tabla con cada grupo y su contenido
      const tab = el('table', { class: 'cw-table' });
      const head = el('tr');
      ['Grupo','Tipo','Hex','Contenido'].forEach((h) => head.appendChild(el('th', null, [h])));
      tab.appendChild(head);
      for (let g = 0; g < Math.ceil(path.length / 8); g++) {
        const isData = g < totalDataBytes;
        const isEcc = g >= totalDataBytes;
        const tr = el('tr');
        const tdN = el('td');
        const swatch = el('span', { class: 'cw-swatch' });
        swatch.style.background = isData ? colorFor(g) : '#ff7ab6';
        tdN.appendChild(swatch);
        tdN.appendChild(document.createTextNode(`#${g}`));
        tr.appendChild(tdN);
        tr.appendChild(el('td', null, [isEcc ? 'ECC' : 'datos']));
        tr.appendChild(el('td', { class: 'mono' }, [
          g < result.finalCw.length ? fmtHex(result.finalCw[g]) : '—',
        ]));
        const contentTd = el('td', { class: 'mono' });
        if (isData) {
          const segs = cwSegs[g] || [];
          segs.forEach((s, idx) => {
            if (idx > 0) contentTd.appendChild(document.createTextNode(' | '));
            const span = el('span');
            span.style.color = KIND_COLOR[s.part.kind];
            span.textContent = segmentLabel(s);
            contentTd.appendChild(span);
          });
        } else {
          contentTd.appendChild(document.createTextNode('Reed-Solomon ECC'));
        }
        tr.appendChild(contentTd);
        tab.appendChild(tr);
      }
      body.appendChild(tab);

      // tabla por carácter: cada letra como sus 8 bits propios y los codewords que cruza
      if (showChar) {
        const ctitle = el('div', {
          class: 'k',
          style: 'color:var(--muted);font-size:12px;margin:14px 0 4px;',
        }, ['Vista por carácter — cada letra son 8 bits propios (cruzan codewords):']);
        body.appendChild(ctitle);
        const ctab = el('table', { class: 'cw-table' });
        const chead = el('tr');
        ['Carácter','Hex','Bin (8 bits)','Codewords que cruza'].forEach((h) => chead.appendChild(el('th', null, [h])));
        ctab.appendChild(chead);
        charGroups.forEach((cg) => {
          const tr = el('tr');
          const tdC = el('td');
          const sw = el('span', { class: 'cw-swatch' });
          sw.style.background = colorFor(cg.byteIdx);
          tdC.appendChild(sw);
          const display = cg.char === '·' ? `0x${cg.byteVal.toString(16).toUpperCase().padStart(2,'0')}` : `'${cg.char}'`;
          tdC.appendChild(document.createTextNode(`#${cg.byteIdx} ${display}`));
          tr.appendChild(tdC);
          tr.appendChild(el('td', { class: 'mono' }, [fmtHex(cg.byteVal)]));
          tr.appendChild(el('td', { class: 'mono' }, [fmtBin(cg.byteVal, 8)]));
          // qué codewords (índices en finalCw) y qué bits dentro de ellos cruza
          const cwSpan = new Map(); // cwIdx -> count
          cg.bitPositions.forEach((bp) => {
            const ci = Math.floor(bp / 8);
            cwSpan.set(ci, (cwSpan.get(ci) || 0) + 1);
          });
          const parts = [];
          for (const [ci, cnt] of cwSpan) parts.push(`cw${ci} (${cnt} bit${cnt === 1 ? '' : 's'})`);
          tr.appendChild(el('td', { class: 'mono' }, [parts.join(' + ')]));
          ctab.appendChild(tr);
        });
        body.appendChild(ctab);
      }

      body.appendChild(el('div', { class: 'note', html:
        'Truco para leer a simple vista: localiza los buscadores (esquinas), ignora la columna y fila de tiempo, y ve siguiendo el zigzag desde la esquina inferior-derecha. Cada 8 módulos consecutivos en ese recorrido es un byte. <b>Recuerda:</b> los caracteres están desplazados 12 bits (4 modo + 8 longitud), por eso un carácter ocupa la mitad baja de un codeword y la mitad alta del siguiente.' }));
    }

    // ---------- PASO 7B: ENCUENTRA LA LETRA (interactivo, sin máscara) ----------
    renderFinderStep(result);

    // ---------- PASO 8: las 8 máscaras ----------
    {
      const body = makeStep(
        8,
        'Aplicación de máscara — comparación de las 8 opciones',
        'Para que el patrón no engañe al lector (zonas demasiado uniformes, falsos buscadores, etc.) se aplica una de 8 máscaras XOR. Se elige la de menor penalización. Aquí ves todas, con su puntuación.'
      );
      const grid = el('div', { class: 'qr-grid' });
      result.masks.forEach((m) => {
        const svg = renderMatrix(m.grid, result.placedMatrix.N, { cell: 8 });
        grid.appendChild(qrCard(svg, `Máscara ${m.index} · pen ${m.score}`, m.index === result.chosen.index));
      });
      body.appendChild(grid);
      body.appendChild(el('div', { class: 'note', html:
        `Máscara seleccionada: <b>${result.chosen.index}</b> (penalización ${result.chosen.score}).` }));
    }

    // ---------- PASO 9: Información de formato ----------
    {
      const body = makeStep(
        9,
        'Información de formato (15 bits BCH)',
        'Junto con la máscara, se codifica el nivel ECC y la máscara elegida en una palabra de 15 bits con BCH (5 datos + 10 paridad), <b>XOR 0x5412</b>. Se inscribe alrededor del buscador superior-izquierdo y replicada en los otros dos.'
      );
      const items = result.chosen.formatBits.map((b, i) => ({
        bits: String(b),
        color: i < 5 ? '#62d0ff' : '#ff7ab6',
        label: `bit ${i}`,
      }));
      // empaquetar como bytes visuales (5+10) — mostrar como una sola fila
      const row = el('div', { class: 'bits-row' });
      const grp1 = el('div', { class: 'bits-byte' });
      grp1.style.borderColor = '#62d0ff';
      const b1 = el('div', { class: 'bits' });
      for (let i = 0; i < 5; i++) {
        const v = result.chosen.formatBits[i];
        b1.appendChild(el('span', { class: 'bit ' + (v ? 'b1' : 'b0') }, [String(v)]));
      }
      grp1.appendChild(b1);
      grp1.appendChild(el('div', { class: 'label', html: '<b>5 bits</b> ECC+máscara' }));
      row.appendChild(grp1);

      const grp2 = el('div', { class: 'bits-byte' });
      grp2.style.borderColor = '#ff7ab6';
      const b2 = el('div', { class: 'bits' });
      for (let i = 5; i < 15; i++) {
        const v = result.chosen.formatBits[i];
        b2.appendChild(el('span', { class: 'bit ' + (v ? 'b1' : 'b0') }, [String(v)]));
      }
      grp2.appendChild(b2);
      grp2.appendChild(el('div', { class: 'label', html: '<b>10 bits</b> BCH' }));
      row.appendChild(grp2);
      body.appendChild(row);
    }

    // ---------- PASO 10: QR final con grupos de 8 ----------
    {
      const body = makeStep(
        10,
        'QR final',
        'El resultado, con la máscara aplicada y la información de formato escrita. Si activas la opción, se superponen los <b>grupos de 8 bits</b> (codewords) numerados sobre el QR para que aprendas a identificarlos a simple vista.'
      );
      const grid = result.chosen.grid;
      const N = result.placedMatrix.N;

      const cards = el('div', { class: 'qr-grid' });
      // QR limpio
      const clean = renderMatrix(grid, N, { cell: 16 });
      cards.appendChild(qrCard(clean, 'QR limpio (escaneable)', false));

      // QR con overlays de grupos
      if (showOverlay) {
        const path = result.dataPath;
        const totalDataBytes = result.dataBytes.length;

        const showCw10 = viewMode === 'cw' || viewMode === 'both';
        const showChar10 = viewMode === 'char' || viewMode === 'both';

        const overlays = [];
        const cwOutlines = [];
        const charOutlines = [];
        const labels = [];

        if (showCw10) {
          for (let g = 0; g < Math.ceil(path.length / 8); g++) {
            const cells = path.slice(g * 8, g * 8 + 8);
            const isData = g < totalDataBytes;
            const color = isData ? colorFor(g) : '#ff7ab6';
            for (const [r, c] of cells) overlays.push({ r, c, color, opacity: 0.45 });
            cwOutlines.push({ cells, color });
            if (cells.length) {
              labels.push({ r: cells[0][0], c: cells[0][1], text: String(g), color: '#000' });
            }
          }
        }

        const charGroups10 = QR.characterGroups(result);
        if (showChar10) {
          charGroups10.forEach((cg) => {
            const color = colorFor(cg.byteIdx);
            charOutlines.push({ cells: cg.cells, color });
            if (!showCw10) {
              for (const [r, c] of cg.cells) overlays.push({ r, c, color, opacity: 0.45 });
            }
            if (cg.cells.length) {
              const display = cg.char === '·' ? `0x${cg.byteVal.toString(16).toUpperCase().padStart(2,'0')}` : cg.char;
              labels.push({ r: cg.cells[0][0], c: cg.cells[0][1], text: display, color: '#000' });
            }
          });
        }

        const svgOpts = { cell: 22, cellOverlay: overlays, groupLabels: labels };
        if (showCw10) {
          svgOpts.groupOutlines = cwOutlines;
        }
        if (showChar10) {
          if (showCw10) {
            svgOpts.groupOutlines2 = charOutlines;
            svgOpts.groupOutlines2Style = { inset: 4, dash: '3,2', width: Math.max(1.2, 22 * 0.10) };
          } else {
            svgOpts.groupOutlines = charOutlines;
          }
        }
        const svg2 = renderMatrix(grid, N, svgOpts);
        const caption =
          viewMode === 'char'
            ? 'QR con grupos por carácter (8 bits cada uno)'
            : viewMode === 'both'
            ? 'QR con codewords (sólido) + caracteres (línea discontinua)'
            : 'QR con grupos de 8 bits (codewords) numerados';
        cards.appendChild(qrCard(svg2, caption, true));
      }

      body.appendChild(cards);

      // tabla resumen
      const sum = el('div', { class: 'kv', style: 'margin-top:14px;' });
      const rows = [
        ['Texto codificado', JSON.stringify(text)],
        ['Versión', `${result.version} (${N}×${N})`],
        ['Nivel ECC', result.ecc],
        ['Máscara elegida', String(result.chosen.index)],
        ['Codewords totales', String(result.finalCw.length)],
        ['  · de datos', String(result.dataBytes.length)],
        ['  · de ECC', String(result.finalCw.length - result.dataBytes.length)],
      ];
      for (const [k, v] of rows) {
        sum.appendChild(el('div', { class: 'k' }, [k]));
        sum.appendChild(el('div', { class: 'v' }, [v]));
      }
      body.appendChild(sum);

      body.appendChild(el('div', { class: 'note', html:
        'Cuando hayas memorizado los buscadores y la máscara, mira el primer grupo (color rojo): los 8 módulos en zigzag desde la esquina inferior-derecha forman el primer byte. En modo byte ese primer byte combina el indicador de modo (0100) con los 4 bits altos de la longitud. Después vienen 4 bits bajos de longitud + 4 bits altos del primer carácter, etc.' }));
    }
  }

  // -------------- PASO 3 interactivo: bitstream + codewords --------------
  // Renderiza el bitstream completo (cada bit en su propia caja) y debajo
  // los codewords (chunks de 8). Encima, chips para cada parte (H, O, L, A,
  // modo, longitud…). Al pulsar un chip, los bits correspondientes se
  // resaltan SIMULTÁNEAMENTE en ambas filas: así se ve que la H son 8 bits
  // contiguos en el bitstream que caen partidos entre dos codewords.
  function renderInteractiveStep3(result) {
    const body = makeStep(
      3,
      'Agrupación en bytes (codewords) — vista interactiva',
      'Abajo tienes el <b>flujo de bits completo</b> en una sola fila, y debajo el mismo flujo cortado en <b>codewords de 8 bits</b>. ' +
      '<b>Pulsa un carácter</b> arriba (H, O, L, A…) y verás <i>los mismos 8 bits</i> resaltados en las dos filas. ' +
      'Así comprueba: la H <b>es 8 bits</b> en el flujo, pero al cortar cada 8 bits desde el inicio, esos 8 bits caen partidos entre dos codewords (porque antes hay un prefijo de 12 bits).'
    );

    // Calcular, para cada parte del bitstream, su rango global [start, end)
    const parts = result.bsParts;
    const partRanges = [];
    let off = 0;
    for (const p of parts) {
      partRanges.push({ part: p, start: off, end: off + p.bits.length });
      off += p.bits.length;
    }
    const totalBits = off;
    const allBits = parts.map((p) => p.bits).join('');

    // ---- chips ----
    const controls = el('div', { class: 'finder-controls' });
    body.appendChild(controls);

    // ---- fila 1: bitstream completo, bit a bit ----
    const bsTitle = el('div', { class: 'k', style: 'color:var(--muted);font-size:12px;margin:8px 0 4px;' }, [
      'Bitstream completo (cada bit es uno):',
    ]);
    body.appendChild(bsTitle);
    const bsRow = el('div', { class: 'bitstream-interactive' });
    body.appendChild(bsRow);
    for (let i = 0; i < totalBits; i++) {
      const bit = allBits[i];
      const span = el('span', { class: 'bs-bit ' + (bit === '1' ? 'b1' : 'b0'), 'data-bit-idx': String(i) });
      span.textContent = bit;
      // color según origen (subrayado)
      const range = partRanges.find((pr) => i >= pr.start && i < pr.end);
      if (range) {
        const c = KIND_COLOR[range.part.kind] || '#888';
        span.style.borderBottomColor = c;
      }
      bsRow.appendChild(span);
    }

    // ---- fila 2: codewords (chunks de 8), también con data-bit-idx ----
    const cwTitle = el('div', { class: 'k', style: 'color:var(--muted);font-size:12px;margin:14px 0 4px;' }, [
      'Codewords (mismos bits, cortados cada 8):',
    ]);
    body.appendChild(cwTitle);
    const cwRow = el('div', { class: 'bs-cw-row' });
    body.appendChild(cwRow);
    const numCw = Math.ceil(totalBits / 8);
    for (let cw = 0; cw < numCw; cw++) {
      const chunk = el('div', { class: 'bs-cw-chunk' });
      chunk.style.borderColor = colorFor(cw);
      const lbl = el('div', { class: 'chunk-label' }, [`cw#${cw}`]);
      chunk.appendChild(lbl);
      const chunkBits = el('div', { class: 'chunk-bits' });
      for (let j = 0; j < 8; j++) {
        const globalBit = cw * 8 + j;
        if (globalBit >= totalBits) break;
        const bit = allBits[globalBit];
        const span = el('span', { class: 'bs-bit ' + (bit === '1' ? 'b1' : 'b0'), 'data-bit-idx': String(globalBit) });
        span.textContent = bit;
        const range = partRanges.find((pr) => globalBit >= pr.start && globalBit < pr.end);
        if (range) {
          const c = KIND_COLOR[range.part.kind] || '#888';
          span.style.borderBottomColor = c;
        }
        chunkBits.appendChild(span);
      }
      // valor hex del codeword
      let val = 0;
      for (let j = 0; j < 8 && cw * 8 + j < totalBits; j++) {
        val = (val << 1) | (allBits[cw * 8 + j] === '1' ? 1 : 0);
      }
      const hex = el('div', { class: 'chunk-label' }, [fmtHex(val)]);
      chunk.appendChild(chunkBits);
      chunk.appendChild(hex);
      cwRow.appendChild(chunk);
    }

    // ---- info box ----
    const infoBox = el('div', { class: 'finder-info' });
    body.appendChild(infoBox);

    // ---- highlighting ----
    function clearHighlights() {
      body.querySelectorAll('.bs-bit.highlight').forEach((n) => n.classList.remove('highlight'));
    }
    function highlightRange(start, end) {
      clearHighlights();
      for (let i = start; i < end; i++) {
        body.querySelectorAll(`.bs-bit[data-bit-idx="${i}"]`).forEach((n) => n.classList.add('highlight'));
      }
    }
    function showInfo(part, start, end) {
      while (infoBox.firstChild) infoBox.removeChild(infoBox.firstChild);
      const p1 = el('div', { class: 'pill' });
      let label;
      if (part.kind === 'data') label = `Carácter <b>'${escapeHtml(part.char)}'</b> = <code>${part.bits}</code> = <b>${fmtHex(part.byteVal)}</b>`;
      else if (part.kind === 'mode') label = `<b>Modo byte</b> = <code>0100</code> (4 bits)`;
      else if (part.kind === 'len') label = `<b>Longitud</b> = ${result.bytes.length} (8 bits)`;
      else if (part.kind === 'term') label = `<b>Terminador</b> = <code>${part.bits}</code> (${part.bits.length} bits)`;
      else if (part.kind === 'pad') label = `<b>Pad bit</b> = <code>${part.bits}</code> (alinea a byte)`;
      else label = `<b>${escapeHtml(part.label)}</b>`;
      p1.innerHTML = label;
      infoBox.appendChild(p1);

      const p2 = el('div', { class: 'pill' });
      p2.innerHTML = `Bits del flujo: <b>${start}..${end - 1}</b> (${end - start} bits)`;
      infoBox.appendChild(p2);

      // Codewords que cruza
      const cwsCrossed = new Set();
      for (let i = start; i < end; i++) cwsCrossed.add(Math.floor(i / 8));
      const arr = [...cwsCrossed].sort((a, b) => a - b);
      const p3 = el('div', { class: 'pill' });
      if (arr.length === 1) {
        p3.innerHTML = `Está completo dentro de <b>cw${arr[0]}</b>`;
      } else {
        const counts = arr.map((c) => {
          let n = 0;
          for (let i = start; i < end; i++) if (Math.floor(i / 8) === c) n++;
          return `<b>cw${c}</b> (${n} bits)`;
        });
        p3.innerHTML = `Cruza: ${counts.join(' + ')}`;
      }
      infoBox.appendChild(p3);
    }

    // construir un chip por cada parte del bitstream
    parts.forEach((p, idx) => {
      const range = partRanges[idx];
      const chip = el('button', { class: 'finder-chip', type: 'button' });
      const sw = el('span', { class: 'chip-swatch' });
      sw.style.background = KIND_COLOR[p.kind] || '#888';
      chip.appendChild(sw);
      let text;
      if (p.kind === 'data') text = p.char;
      else if (p.kind === 'mode') text = 'modo';
      else if (p.kind === 'len') text = 'len';
      else if (p.kind === 'term') text = 'term';
      else if (p.kind === 'pad') text = 'pad';
      else text = (p.label || 'pad').replace('Pad ', '');
      chip.appendChild(el('span', { class: 'chip-char' }, [text]));
      chip.appendChild(el('span', { style: 'font-size:11px;color:var(--muted);' }, [`${p.bits.length}b`]));
      chip.addEventListener('click', () => {
        controls.querySelectorAll('.finder-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        highlightRange(range.start, range.end);
        showInfo(p, range.start, range.end);
      });
      controls.appendChild(chip);
    });

    // selección inicial: el primer carácter
    const firstDataIdx = parts.findIndex((p) => p.kind === 'data');
    if (firstDataIdx >= 0) {
      const chips = controls.querySelectorAll('.finder-chip');
      const targetChip = chips[firstDataIdx];
      if (targetChip) {
        targetChip.classList.add('active');
        const r = partRanges[firstDataIdx];
        highlightRange(r.start, r.end);
        showInfo(parts[firstDataIdx], r.start, r.end);
      }
    }
  }

  // -------------- PASO interactivo: ENCUENTRA LA LETRA --------------
  // Muestra el QR sin máscara y permite elegir un grupo (carácter, modo,
  // longitud, padding, ECC...) para verlo resaltado: 8 módulos exactos.
  function renderFinderStep(result) {
    const body = makeStep(
      '★',
      'Encuentra la letra (vista interactiva, sin máscara)',
      'Aquí ves el QR <b>antes de aplicar la máscara</b> (se ven los datos puros). Pulsa una letra (u otro grupo) y se resaltarán <b>exactamente sus 8 módulos físicos</b> en la matriz. Es la forma más clara de localizar dónde vive cada carácter.'
    );

    const grid = result.placedMatrix.m;
    const N = result.placedMatrix.N;
    const path = result.dataPath;
    const totalDataBytes = result.dataBytes.length;
    const charGroups = QR.characterGroups(result);
    const origins = QR.bitOrigins(result);

    // Construimos la lista de grupos seleccionables:
    //   - cada carácter (8 bits propios)
    //   - el modo (4 bits)
    //   - la longitud (8 bits)
    //   - terminador, padding (un grupo agregado por tipo)
    //   - cada bloque de ECC (un grupo por bloque)
    const selectable = [];
    // 1) caracteres
    charGroups.forEach((cg) => {
      const ch = cg.char === '·' ? `0x${cg.byteVal.toString(16).toUpperCase().padStart(2,'0')}` : cg.char;
      selectable.push({
        id: 'char-' + cg.byteIdx,
        label: ch,
        sub: `byte ${cg.byteIdx}`,
        kind: 'data',
        color: colorFor(cg.byteIdx),
        cells: cg.cells,
        bitPositions: cg.bitPositions,
        bitsBin: cg.byteVal.toString(2).padStart(8, '0'),
        hex: '0x' + cg.byteVal.toString(16).toUpperCase().padStart(2, '0'),
        size: 8,
        info: `Carácter <b>${escapeHtml(ch)}</b> · 8 bits propios (offset 12 + ${cg.byteIdx} × 8 desde el inicio del bitstream).`,
      });
    });
    // 2) agrupar por kind no-data
    const byKind = new Map();
    origins.forEach((o, i) => {
      if (o.kind === 'data') return;
      let key = o.kind;
      if (o.kind === 'ecc') key = 'ecc-block-' + (o.block != null ? o.block : 0);
      if (o.kind === 'padbyte') key = 'padbyte-' + (o.part ? o.part.label : '');
      let g = byKind.get(key);
      if (!g) {
        g = {
          id: 'meta-' + key,
          kind: o.kind,
          part: o.part,
          block: o.block,
          cells: [],
          bitPositions: [],
        };
        byKind.set(key, g);
      }
      g.cells.push(path[i]);
      g.bitPositions.push(i);
    });
    const KIND_LABEL = {
      mode: 'modo (4 bits)',
      len: 'longitud (8 bits)',
      term: 'terminador',
      pad: 'pad (rellenar a byte)',
      padbyte: 'pad byte',
      remainder: 'bits extra (remainder)',
    };
    const KIND_BG = {
      mode: '#62d0ff', len: '#ffd166', term: '#a5a5a5',
      pad: '#777', padbyte: '#cf83ff', ecc: '#ff7ab6', remainder: '#666',
    };
    byKind.forEach((g) => {
      let label = KIND_LABEL[g.kind] || g.kind;
      let info = '';
      if (g.kind === 'mode') info = '<b>Modo byte</b> = bits <code>0100</code>. Indica que vienen bytes de 8 bits.';
      else if (g.kind === 'len') info = `<b>Longitud</b> = ${result.bytes.length} bytes (8 bits).`;
      else if (g.kind === 'ecc') { label = `ECC bloque ${g.block + 1}`; info = `Codewords de Reed-Solomon del bloque ${g.block + 1}.`; }
      else if (g.kind === 'padbyte') { label = (g.part && g.part.label) || 'pad byte'; info = 'Bytes de relleno alternando 0xEC / 0x11.'; }
      else if (g.kind === 'pad') info = 'Ceros para alinear a byte tras el terminador.';
      else if (g.kind === 'term') info = 'Hasta 4 ceros que marcan el final de los datos útiles.';
      else if (g.kind === 'remainder') info = 'Bits extra que sobran tras escribir todos los codewords (ignorados al leer).';
      selectable.push({
        id: g.id,
        label,
        sub: `${g.cells.length} módulos`,
        kind: g.kind,
        color: KIND_BG[g.kind] || '#888',
        cells: g.cells,
        bitPositions: g.bitPositions,
        bitsBin: null,
        size: g.cells.length,
        info,
      });
    });

    // ---- UI ----
    const controls = el('div', { class: 'finder-controls' });
    body.appendChild(controls);

    const matrixCard = el('div', { class: 'qr-card', style: 'max-width:760px;margin:0 auto;' });
    body.appendChild(matrixCard);

    const infoBox = el('div', { class: 'finder-info' });
    body.appendChild(infoBox);

    let currentId = selectable.length > 0 ? selectable[0].id : null;

    function renderMatrixWith(selectedId) {
      const sel = selectable.find((s) => s.id === selectedId);
      const overlays = [];
      const outlines = [];
      const labels = [];

      // 1) atenuar TODOS los módulos de datos para que destaque el seleccionado
      for (const [r, c] of path) {
        overlays.push({ r, c, color: '#ffffff', opacity: 0.0 }); // no-op pero deja sitio si quisiéramos atenuar
      }

      if (sel) {
        // resaltar las celdas del grupo elegido en color fuerte
        for (let i = 0; i < sel.cells.length; i++) {
          const [r, c] = sel.cells[i];
          overlays.push({ r, c, color: sel.color, opacity: 0.85 });
        }
        outlines.push({ cells: sel.cells, color: sel.color });
        // etiqueta del grupo en su 1.ª celda
        if (sel.cells.length) {
          const [r0, c0] = sel.cells[0];
          labels.push({ r: r0, c: c0, text: sel.label.length <= 2 ? sel.label : '★', color: '#04212d' });
        }
        // numerar cada bit (0..n-1) sobre cada celda del grupo
        for (let i = 1; i < sel.cells.length; i++) {
          const [r, c] = sel.cells[i];
          labels.push({ r, c, text: String(i), color: '#04212d' });
        }
      }

      // re-render
      while (matrixCard.firstChild) matrixCard.removeChild(matrixCard.firstChild);
      const svg = renderMatrix(grid, N, {
        cell: 22,
        cellOverlay: overlays,
        groupOutlines: outlines,
        groupOutlinesStyle: { inset: 1, width: 3, opacity: 1 },
        groupLabels: labels,
      });
      matrixCard.appendChild(svg);
      const cap = el('div', { class: 'caption' });
      cap.innerHTML = sel
        ? `Resaltado: <b>${escapeHtml(sel.label)}</b> · ${sel.size} módulos · QR <i>sin máscara</i>`
        : 'Selecciona un grupo arriba';
      matrixCard.appendChild(cap);

      // panel inferior con bits + posición
      while (infoBox.firstChild) infoBox.removeChild(infoBox.firstChild);
      if (sel) {
        const pill1 = el('div', { class: 'pill' });
        pill1.innerHTML = sel.info || sel.label;
        infoBox.appendChild(pill1);
        if (sel.bitsBin) {
          const bits = el('div', { class: 'bitlist' });
          for (let i = 0; i < sel.bitsBin.length; i++) {
            const ch = sel.bitsBin[i];
            bits.appendChild(el('span', { class: 'b ' + (ch === '1' ? 'b1' : 'b0') }, [ch]));
          }
          const wrap = el('div');
          wrap.appendChild(document.createTextNode((sel.hex || '') + '  '));
          wrap.appendChild(bits);
          infoBox.appendChild(wrap);
        }
        const cellsTxt = sel.cells.map(([r, c]) => `(${r},${c})`).join(' · ');
        infoBox.appendChild(el('div', { class: 'pill', style: 'font-size:11px;' }, [`módulos: ${cellsTxt}`]));
      }
    }

    // construir chips
    selectable.forEach((s) => {
      const chip = el('button', { class: 'finder-chip', type: 'button' });
      const sw = el('span', { class: 'chip-swatch' });
      sw.style.background = s.color;
      chip.appendChild(sw);
      chip.appendChild(el('span', { class: 'chip-char' }, [s.label]));
      if (s.sub) chip.appendChild(el('span', { style: 'font-size:11px;color:var(--muted);' }, [s.sub]));
      chip.addEventListener('click', () => {
        currentId = s.id;
        // marca el activo
        controls.querySelectorAll('.finder-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        renderMatrixWith(currentId);
      });
      controls.appendChild(chip);
    });

    // selección inicial
    if (currentId) {
      const firstChip = controls.querySelector('.finder-chip');
      if (firstChip) firstChip.classList.add('active');
      renderMatrixWith(currentId);
    }
  }

  function printable(b) {
    if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b);
    return '·';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  $('#btn-generate').addEventListener('click', generate);
  $('#input-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') generate(); });
  ['#input-ecc', '#input-mask', '#input-overlay', '#input-view'].forEach((s) => {
    const node = $(s);
    if (node) node.addEventListener('change', generate);
  });

  // primera ejecución
  generate();
})();
