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
    // items: [{label, bits, color, sub?}]
    const row = el('div', { class: 'bits-row' });
    items.forEach((it) => {
      const byte = el('div', { class: 'bits-byte' });
      byte.style.borderColor = it.color;
      const bits = el('div', { class: 'bits' });
      for (const ch of it.bits) {
        bits.appendChild(el('span', { class: 'bit ' + (ch === '1' ? 'b1' : 'b0') }, [ch]));
      }
      byte.appendChild(bits);
      const label = el('div', { class: 'label', html: it.label });
      byte.appendChild(label);
      row.appendChild(byte);
    });
    return row;
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

    // overlay: contorno por grupo
    if (opts.groupOutlines) {
      for (const g of opts.groupOutlines) {
        for (const [r0, c0] of g.cells) {
          const r = document.createElementNS(ns, 'rect');
          r.setAttribute('x', (c0 + margin) * cell + 1);
          r.setAttribute('y', (r0 + margin) * cell + 1);
          r.setAttribute('width', cell - 2);
          r.setAttribute('height', cell - 2);
          r.setAttribute('fill', 'none');
          r.setAttribute('stroke', g.color);
          r.setAttribute('stroke-width', Math.max(1.5, cell * 0.16));
          r.setAttribute('opacity', '0.95');
          svg.appendChild(r);
        }
      }
    }

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
        label: `<b>${fmtHex(b)}</b> ${printable(b)}`,
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

    // ---------- PASO 3: agrupación en codewords (8 bits) ----------
    {
      const body = makeStep(
        3,
        'Agrupación en bytes (codewords) de 8 bits',
        'El flujo de bits se trocea en bloques de 8 bits. Estos son los <b>codewords de datos</b> que finalmente entran al QR.'
      );
      const items = result.dataBytes.map((b, i) => ({
        bits: fmtBin(b, 8),
        color: colorFor(i),
        label: `cw#${i} <b>${fmtHex(b)}</b>`,
      }));
      body.appendChild(renderByteRow(items));
    }

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
        'Los bits se escriben recorriendo la matriz por columnas de 2, en zigzag de abajo a arriba y de arriba a abajo, saltando la columna de tiempo. <b>Cada 8 módulos consecutivos en este recorrido = 1 codeword</b>. Cada grupo se colorea para que puedas <i>seguirlo con la vista</i>.'
      );

      const path = result.dataPath;
      const grid = result.placedMatrix.m;
      const N = result.placedMatrix.N;
      const totalDataBytes = result.dataBytes.length;
      const overlays = [];
      const outlines = [];
      const labels = [];
      for (let g = 0; g < Math.ceil(path.length / 8); g++) {
        const cells = path.slice(g * 8, g * 8 + 8);
        const isData = g < totalDataBytes;
        const color = isData ? colorFor(g) : '#ff7ab6';
        for (const [r, c] of cells) {
          overlays.push({ r, c, color, opacity: 0.35 });
        }
        outlines.push({ cells, color });
        if (cells.length > 0) {
          // etiqueta en la primera celda de cada grupo
          const [r0, c0] = cells[0];
          labels.push({ r: r0, c: c0, text: String(g), color: '#04212d' });
        }
      }
      const svg = renderMatrix(grid, N, {
        cell: 18,
        cellOverlay: overlays,
        groupOutlines: outlines,
        groupLabels: labels,
      });
      const card = el('div', { class: 'qr-card', style: 'max-width:640px;margin:0 auto;' });
      card.appendChild(svg);
      card.appendChild(el('div', { class: 'caption' }, [
        `${path.length} módulos de datos (${path.length / 8 | 0} grupos de 8 bits + ${path.length % 8} restantes)`,
      ]));
      body.appendChild(card);

      body.appendChild(el('div', { class: 'note', html:
        'Truco para leer a simple vista: localiza los buscadores (esquinas), ignora la columna y fila de tiempo, y ve siguiendo el zigzag desde la esquina inferior-derecha. Cada 8 módulos consecutivos en ese recorrido es un byte.' }));
    }

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
        const overlays = [];
        const outlines = [];
        const labels = [];
        for (let g = 0; g < Math.ceil(path.length / 8); g++) {
          const cells = path.slice(g * 8, g * 8 + 8);
          const isData = g < totalDataBytes;
          const color = isData ? colorFor(g) : '#ff7ab6';
          for (const [r, c] of cells) overlays.push({ r, c, color, opacity: 0.45 });
          outlines.push({ cells, color });
          if (cells.length) labels.push({ r: cells[0][0], c: cells[0][1], text: String(g), color: '#000' });
        }
        const svg2 = renderMatrix(grid, N, {
          cell: 18,
          cellOverlay: overlays,
          groupOutlines: outlines,
          groupLabels: labels,
        });
        cards.appendChild(qrCard(svg2, 'QR con grupos de 8 bits resaltados', true));
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

  function printable(b) {
    if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b);
    return '·';
  }

  $('#btn-generate').addEventListener('click', generate);
  $('#input-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') generate(); });
  ['#input-ecc', '#input-mask', '#input-overlay'].forEach((s) => {
    $(s).addEventListener('change', generate);
  });

  // primera ejecución
  generate();
})();
