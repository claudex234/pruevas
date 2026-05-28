<?php
/**
 * Visor de museos de Lima (Perú → provincias → distritos → museos).
 *
 * Esta página solo entrega la interfaz. Los DATOS (límites GeoJSON y la
 * lista de museos) se piden a api.php, que los lee desde /data (carpeta
 * bloqueada al acceso directo). Así el contenido no queda incrustado en
 * el código fuente que ve el navegador.
 */
header('Content-Type: text/html; charset=utf-8');
// Sin caché durante el testeo, para ver siempre la última versión.
header('Cache-Control: no-store, no-cache, must-revalidate');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#0f1722" />
  <title>Visor de Museos · Perú → Provincias → Distritos</title>
  <style>
    :root {
      --bg: #0f1722;
      --panel: #16212e;
      --panel-2: #1d2c3d;
      --accent: #e23b3b;
      --accent-2: #f2a900;
      --text: #e8eef5;
      --muted: #93a4b6;
      --border: #26384c;
      --safe-b: env(safe-area-inset-bottom, 0px);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }

    #sidebar {
      width: 340px;
      min-width: 340px;
      background: var(--panel);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .sheet-handle { display: none; }
    #sidebar header { padding: 18px 18px 14px; border-bottom: 1px solid var(--border); }
    #sidebar header h1 { margin: 0; font-size: 18px; letter-spacing: 0.3px; }
    #sidebar header p { margin: 6px 0 0; font-size: 12.5px; color: var(--muted); }

    .backbtn {
      margin: 12px 18px 0;
      padding: 9px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      display: none;
      touch-action: manipulation;
    }
    .backbtn:hover { border-color: var(--accent-2); }

    .hint {
      margin: 14px 18px;
      padding: 14px;
      border-radius: 10px;
      background: var(--panel-2);
      border: 1px dashed var(--border);
      font-size: 13px;
      color: var(--muted);
      line-height: 1.5;
    }
    .hint b { color: var(--text); }

    .controls {
      padding: 12px 18px;
      border-bottom: 1px solid var(--border);
      display: none;
      flex-direction: column;
      gap: 10px;
    }
    .controls input[type="search"] {
      width: 100%;
      padding: 9px 11px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
    .controls input[type="search"]:focus { border-color: var(--accent-2); }
    .filters { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      font-size: 12px;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.15s;
      touch-action: manipulation;
    }
    .chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    .count { font-size: 12px; color: var(--muted); padding: 8px 18px 0; display: none; }
    #list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 8px 10px 18px; }
    .card {
      padding: 11px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s;
    }
    .card:hover { background: var(--panel-2); }
    .card.selected { background: var(--panel-2); border-color: var(--accent-2); }
    .card h3 { margin: 0 0 3px; font-size: 14.5px; display: flex; align-items: center; gap: 7px; }
    .card .tag {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 7px;
      border-radius: 5px;
      color: #1a1200;
      font-weight: 600;
    }
    .card p { margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.4; }

    /* Panel de detalle del museo */
    #detail { display: none; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px 18px 24px; }
    #detail .back2 { background: none; border: none; color: var(--accent-2); font-size: 13px; cursor: pointer; padding: 0 0 12px; }
    #detail .d-tag {
      display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
      padding: 3px 9px; border-radius: 6px; color: #1a1200; font-weight: 700;
    }
    #detail h2 { margin: 10px 0 6px; font-size: 19px; line-height: 1.3; }
    #detail .d-dist { margin: 0 0 16px; font-size: 13px; color: var(--accent-2); }
    #detail .d-gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    #detail .d-gallery .d-photo, #detail .d-gallery .d-ph { width: 100%; height: 120px; border-radius: 10px; }
    #detail .d-photo { object-fit: cover; border: 1px solid var(--border); }
    #detail .d-ph {
      display: flex; align-items: center; justify-content: center; text-align: center;
      color: rgba(255,255,255,.92); font-size: 12.5px; font-weight: 600; border: 1px solid var(--border);
    }
    #detail .d-section { margin-bottom: 16px; }
    #detail .d-section h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); }
    #detail .d-desc { margin: 0; font-size: 14px; line-height: 1.6; color: var(--text); }
    #detail .d-meta { font-size: 12.5px; color: var(--muted); }
    #detail .d-meta div { margin-bottom: 6px; }
    #detail .d-meta b { color: var(--text); }
    #detail .d-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    #detail .d-go {
      display: inline-block; padding: 10px 14px; border-radius: 8px; background: var(--accent);
      color: #fff; text-decoration: none; font-size: 13.5px; font-weight: 600;
    }
    #detail .d-go:hover { background: #c8302f; }
    #detail .d-web { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); }
    #detail .d-web:hover { background: #243648; }

    footer { padding: 10px 18px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); }
    footer a { color: var(--accent-2); text-decoration: none; }

    /* ---------- Mapa SVG ---------- */
    #map { flex: 1; height: 100%; position: relative; background:
        radial-gradient(1200px 800px at 60% 30%, #11202e 0%, #0b1118 70%); }
    #pmap { width: 100%; height: 100%; display: block; touch-action: manipulation; }
    #pmap path { vector-effect: non-scaling-stroke; cursor: pointer; outline: none; }

    .dep { fill: #2a3a49; stroke: #56708a; stroke-width: 1; transition: fill .15s; }
    .dep:hover { fill: #38506a; }
    .dep.lima { fill: var(--accent-2); stroke: #ffd56b; stroke-width: 1.4; }
    .dep.lima:hover { fill: #ffbe1f; }

    .prov { fill: #2f4256; stroke: #f2a900; stroke-width: 1; transition: fill .15s; }
    .prov:hover { fill: #3e5872; }
    .prov.has { fill: #3a4b3f; stroke: #5fb27a; }       /* provincia con museos */
    .prov.has:hover { fill: #4a6150; }
    .prov.sel { fill: #6b5410; stroke: #ffd56b; stroke-width: 1.6; }

    .dist { fill: #2c3e50; stroke: #e23b3b; stroke-width: 1; transition: fill .15s; }
    .dist:hover { fill: #3c5468; }
    .dist.has { fill: #3a4b3f; stroke: #5fb27a; }      /* distrito con museos */
    .dist.has:hover { fill: #4a6150; }
    .dist.sel { fill: #7a2422; stroke: #ff6b5e; stroke-width: 1.6; }

    .pin { cursor: pointer; }
    .pin circle { stroke: #fff; stroke-width: 1.5; transition: r .12s; }
    .pin:hover circle { stroke: #ffd56b; }

    .maplabel {
      position: absolute; left: 14px; top: 14px; pointer-events: none;
      background: rgba(15,23,34,.9); border: 1px solid var(--border);
      color: #fff; font-size: 13px; font-weight: 600; padding: 6px 12px;
      border-radius: 8px; opacity: 0; transition: opacity .15s; max-width: 60%;
    }
    .maplabel.show { opacity: 1; }
    .legend {
      position: absolute; right: 14px; bottom: 14px; pointer-events: none;
      background: rgba(15,23,34,.82); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 12px; font-size: 11.5px; color: var(--muted);
    }
    .legend .row { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
    .legend .row:last-child { margin-bottom: 0; }
    .legend .sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,.35); }

    .toast {
      position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
      background: rgba(15,23,34,.94); color: #fff; padding: 9px 16px; border-radius: 999px;
      font-size: 13px; border: 1px solid var(--border); z-index: 1000; opacity: 0;
      transition: opacity .25s; pointer-events: none; max-width: 80%; text-align: center;
    }
    .toast.show { opacity: 1; }

    /* Cartel de estado / errores sobre el mapa */
    .status {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      background: rgba(15,23,34,.95); border: 1px solid var(--border);
      color: var(--text); padding: 16px 20px; border-radius: 12px;
      font-size: 14px; line-height: 1.5; max-width: 80%; text-align: center; z-index: 900;
    }
    .status.err { border-color: var(--accent); }
    .status code { color: var(--accent-2); font-size: 12.5px; word-break: break-all; }
    .status.hide { display: none; }

    /* ---------- Celular: mapa a pantalla completa + hoja inferior ---------- */
    @media (max-width: 760px) {
      body { flex-direction: column; }
      #map { position: fixed; inset: 0; height: 100%; width: 100%; }
      .legend { display: none; }
      .maplabel { font-size: 12px; max-width: 72%; }

      #sidebar {
        position: fixed; left: 0; right: 0; bottom: 0; top: auto;
        width: 100%; min-width: 0; height: 82vh; height: 82dvh;
        border-right: none; border-top: 1px solid var(--border);
        border-radius: 18px 18px 0 0;
        box-shadow: 0 -10px 30px rgba(0,0,0,.5);
        transform: translateY(calc(100% - 152px - var(--safe-b)));  /* colapsada: asoma el encabezado */
        transition: transform .32s cubic-bezier(.4,0,.2,1);
        z-index: 600;
        padding-bottom: var(--safe-b);
      }
      body.sheet-open #sidebar { transform: translateY(0); }

      .sheet-handle {
        display: flex; align-items: center; justify-content: center;
        height: 24px; flex: 0 0 auto; cursor: pointer; touch-action: none;
      }
      .sheet-handle::before {
        content: ""; width: 46px; height: 5px; border-radius: 999px; background: var(--border);
      }
      #sidebar header { padding: 4px 18px 12px; }
      #sidebar header h1 { font-size: 17px; }

      .backbtn { padding: 12px 14px; font-size: 14px; }
      .controls input[type="search"] { font-size: 16px; }  /* evita el zoom de iOS al enfocar */
      .chip { font-size: 13px; padding: 8px 13px; }
      .card { padding: 14px 12px; }
      .card h3 { font-size: 15.5px; }
      .hint { font-size: 13.5px; }
      footer { display: none; }
    }
  </style>
</head>
<body>
  <aside id="sidebar">
    <div class="sheet-handle" id="sheet" title="Deslizar / tocar para abrir o cerrar"></div>
    <header>
      <h1 id="title">🇵🇪 Perú</h1>
      <p id="subtitle">Toca la figura de Lima en el mapa</p>
    </header>
    <button class="backbtn" id="back">← Volver</button>
    <div class="hint" id="hint">
      Visor del Perú por niveles con <b>zoom</b>.<br><br>
      👉 Toca la <b>figura de Lima</b> (resaltada) para ver sus <b>provincias</b>, luego un <b>distrito</b> y sus <b>museos</b>.
    </div>
    <div class="controls" id="controls">
      <input id="search" type="search" placeholder="Buscar museo..." autocomplete="off" />
      <div class="filters" id="filters"></div>
    </div>
    <div class="count" id="count"></div>
    <div id="list"></div>
    <div id="detail"></div>
    <footer>
      Datos servidos desde el servidor (<code>api.php</code>) · render SVG propio
    </footer>
  </aside>

  <div id="map">
    <svg id="pmap" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>
    <div class="maplabel" id="maplabel"></div>
    <div class="legend" id="legend"></div>
    <div class="status" id="status">Cargando mapa…</div>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    /* ---------- Origen de datos (servidos por el backend) ---------- */
    const API = "api.php";

    /* ---------- Museos (se cargan desde el servidor) ---------- */
    let MUSEOS = [];

    const CAT_COLORS = {
      "Arte": "#e23b3b", "Arqueología": "#f2a900", "Historia": "#3b82e2",
      "Ciencia": "#2ecc71", "Comunitario": "#9b59b6"
    };

    /* ---------- Utilidades de propiedades GeoJSON ---------- */
    function prop(p, keys) { for (const k of keys) if (p && p[k] != null && p[k] !== "") return p[k]; return ""; }
    const DEP_KEYS  = ["NOMBDEP", "FIRST_NOMB", "departamento", "NAME_1", "name"];
    const DIST_KEYS = ["NOMBDIST", "distrito", "NAME_3", "name"];
    const PROV_KEYS = ["NOMBPROV", "provincia", "NAME_2"];
    const norm = s => String(s).trim().toUpperCase();

    /* ---------- Render SVG ---------- */
    const NS = "http://www.w3.org/2000/svg";
    const VBW = 1000, VBH = 1200, PAD = 40, PIN_BASE = 9;
    const svg = document.getElementById("pmap");
    const labelEl = document.getElementById("maplabel");

    /* ---------- Referencias del sidebar ---------- */
    const titleEl = document.getElementById("title");
    const subtitleEl = document.getElementById("subtitle");
    const hintEl = document.getElementById("hint");
    const controlsEl = document.getElementById("controls");
    const countEl = document.getElementById("count");
    const backEl = document.getElementById("back");
    const listEl = document.getElementById("list");
    const detailEl = document.getElementById("detail");

    function svgEl(tag, attrs) {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }
    function titleNode(text) { const t = svgEl("title", {}); t.textContent = text; return t; }

    function eachCoord(features, fn) {
      features.forEach(f => {
        const g = f.geometry; if (!g) return;
        const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        polys.forEach(poly => poly.forEach(ring => ring.forEach(c => fn(c[0], c[1]))));
      });
    }

    // Proyector equirectangular con corrección por latitud, ajustado para llenar el viewBox.
    function makeProjector(features) {
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      eachCoord(features, (lon, lat) => {
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      });
      const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
      const rx = lon => lon * k, ry = lat => -lat;
      const rminx = rx(minLon), rmaxx = rx(maxLon), rminy = ry(maxLat), rmaxy = ry(minLat);
      const rw = rmaxx - rminx, rh = rmaxy - rminy;
      const s = Math.min((VBW - 2 * PAD) / rw, (VBH - 2 * PAD) / rh);
      const ox = (VBW - s * rw) / 2 - s * rminx;
      const oy = (VBH - s * rh) / 2 - s * rminy;
      return c => [s * rx(c[0]) + ox, s * ry(c[1]) + oy];
    }

    function featurePath(f, proj) {
      const g = f.geometry; if (!g) return "";
      const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      let d = "";
      polys.forEach(poly => poly.forEach(ring => {
        ring.forEach((c, i) => { const p = proj(c); d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "; });
        d += "Z ";
      }));
      return d;
    }

    /* ---------- Animación de viewBox (zoom) ---------- */
    let curVB = { x: 0, y: 0, w: VBW, h: VBH };
    function setVB(v) { svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`); updatePinSize(v.w); }
    function animateVB(target, dur = 650) {
      const start = { ...curVB }, t0 = performance.now();
      const ease = x => 1 - Math.pow(1 - x, 3);
      function step(now) {
        const p = Math.min(1, (now - t0) / dur), e = ease(p);
        const v = {
          x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e,
          w: start.w + (target.w - start.w) * e, h: start.h + (target.h - start.h) * e
        };
        setVB(v);
        if (p < 1) requestAnimationFrame(step); else curVB = target;
      }
      curVB = start; requestAnimationFrame(step);
    }
    // Ajusta una caja al aspect ratio del viewBox, con margen.
    function fitBox(bb, frac) {
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      let w = bb.width * (1 + frac * 2), h = bb.height * (1 + frac * 2);
      const ar = VBW / VBH;
      if (w / h > ar) h = w / ar; else w = h * ar;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }
    function updatePinSize(vbW) {
      const r = (PIN_BASE * vbW / VBW).toFixed(2);
      svg.querySelectorAll(".pin circle").forEach(c => c.setAttribute("r", r));
    }

    /* ---------- Estado y datos ---------- */
    let depFeatures = [], provFeatures = [], distFeatures = [];
    let proj = null;                 // proyector compartido (basado en Perú)
    let depG, provG, distG, pinG;    // capas SVG
    let provEls = {};                // key -> { el, bbox, key, name, n }
    let distEls = {};                // key -> { el, bbox, key, name, n, provKey }
    let pins = [];                   // { data, index, g }
    let limaBox = null;              // bbox proyectada del departamento de Lima
    let view = "peru";               // peru | depto | prov | distrito
    let selectedProv = "";
    let selectedDistrict = "";       // clave compuesta provincia|distrito
    let selectedDistName = "";       // nombre del distrito (para emparejar museos)
    const FULL_VB = { x: 0, y: 0, w: VBW, h: VBH };

    /* ---------- Hoja inferior (solo celular) ---------- */
    const mqMobile = window.matchMedia("(max-width: 760px)");
    function setSheet(open) { document.body.classList.toggle("sheet-open", open); }
    document.getElementById("sheet").addEventListener("click", () =>
      setSheet(!document.body.classList.contains("sheet-open")));

    /* ---------- Etiqueta flotante del mapa ---------- */
    function setLabel(txt) { labelEl.textContent = txt; labelEl.classList.add("show"); }
    function clearLabel() { labelEl.classList.remove("show"); }

    /* ---------- BBox proyectada (no depende de getBBox / layout) ---------- */
    function projectedBBox(features) {
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      eachCoord(features, (lon, lat) => {
        const p = proj([lon, lat]);
        if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
        if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
      });
      return { x: minx, y: miny, width: maxx - minx, height: maxy - miny };
    }

    /* ---------- Construcción del mapa (una sola vez) ----------
       Todo comparte el MISMO sistema de coordenadas (proyector de Perú),
       de modo que Perú→Lima→provincia→distrito son animaciones de viewBox. */
    function buildMap() {
      svg.innerHTML = "";
      proj = makeProjector(depFeatures);

      // Departamentos
      depG = svgEl("g", { id: "deplayer" });
      depFeatures.forEach(f => {
        const name = prop(f.properties, DEP_KEYS), isLima = norm(name) === "LIMA";
        const p = svgEl("path", { d: featurePath(f, proj), class: "dep" + (isLima ? " lima" : ""), tabindex: "-1" });
        p.appendChild(titleNode(name + (isLima ? " (toca para ver provincias)" : "")));
        p.addEventListener("click", e => { e.stopPropagation(); isLima ? enterLima() : showToast(`${name}: aún sin museos cargados.`); });
        p.addEventListener("mouseenter", () => setLabel(name));
        p.addEventListener("mouseleave", clearLabel);
        depG.appendChild(p);
      });
      svg.appendChild(depG);

      // Provincias del departamento de Lima (mismo proyector), ocultas al inicio
      provG = svgEl("g", { id: "provlayer" });
      provG.style.display = "none";
      provEls = {};
      provFeatures.forEach(f => {
        const name = prop(f.properties, PROV_KEYS), key = norm(name);
        const n = MUSEOS.filter(m => norm(m.provincia) === key).length;
        const p = svgEl("path", { d: featurePath(f, proj), class: "prov" + (n ? " has" : ""), tabindex: "-1" });
        const tip = `${name}${n ? ` · ${n} museo${n > 1 ? "s" : ""}` : ""}`;
        p.appendChild(titleNode(tip));
        p.addEventListener("click", e => { e.stopPropagation(); selectProvincia(key, name); });
        p.addEventListener("mouseenter", () => setLabel(tip));
        p.addEventListener("mouseleave", clearLabel);
        provG.appendChild(p);
        provEls[key] = { el: p, bbox: projectedBBox([f]), key, name, n };
      });
      svg.appendChild(provG);

      // Distritos del departamento de Lima (mismo proyector), ocultos al inicio
      distG = svgEl("g", { id: "distlayer" });
      distG.style.display = "none";
      distEls = {};
      distFeatures.forEach(f => {
        const name = prop(f.properties, DIST_KEYS), distKey = norm(name);
        const provKey = norm(prop(f.properties, PROV_KEYS));
        const key = provKey + "|" + distKey;   // único aunque haya distritos homónimos
        const n = MUSEOS.filter(m => norm(m.nombdist) === distKey && norm(m.provincia) === provKey).length;
        const p = svgEl("path", { d: featurePath(f, proj), class: "dist" + (n ? " has" : ""), tabindex: "-1" });
        const tip = `${name}${n ? ` · ${n} museo${n > 1 ? "s" : ""}` : ""}`;
        p.appendChild(titleNode(tip));
        p.style.display = "none";
        p.addEventListener("click", e => { e.stopPropagation(); selectDistrict(key, name); });
        p.addEventListener("mouseenter", () => setLabel(tip));
        p.addEventListener("mouseleave", clearLabel);
        distG.appendChild(p);
        distEls[key] = { el: p, bbox: projectedBBox([f]), key, distKey, name, n, provKey };
      });
      svg.appendChild(distG);

      // Pines de museos (mismo proyector), ocultos al inicio
      pinG = svgEl("g", { id: "pinlayer" });
      pins = [];
      MUSEOS.forEach((m, i) => {
        const [x, y] = proj(m.coords);
        const g = svgEl("g", { class: "pin", transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
        g.style.display = "none";
        g.appendChild(svgEl("circle", { r: PIN_BASE, fill: CAT_COLORS[m.cat] || "#e23b3b" }));
        g.appendChild(titleNode(m.nombre));
        g.addEventListener("click", e => { e.stopPropagation(); showDetail(i); });
        g.addEventListener("mouseenter", () => setLabel(m.nombre));
        g.addEventListener("mouseleave", clearLabel);
        pinG.appendChild(g);
        pins.push({ data: m, index: i, g });
      });
      svg.appendChild(pinG);

      limaBox = provFeatures.length ? projectedBBox(provFeatures) : null;
      curVB = { ...FULL_VB };
      setVB(FULL_VB);
      enterPeru();   // estado inicial
    }

    /* ---------- Niveles (siempre con animación de viewBox) ----------
       Jerarquía: Perú (departamentos) → Lima (provincias) → provincia
       (distritos) → distrito (museos). Cada salto es un zoom de viewBox. */
    function enterPeru() {
      view = "peru"; selectedProv = ""; selectedDistrict = ""; selectedDistName = "";
      hideDetail();
      if (provG) provG.style.display = "none";
      if (distG) distG.style.display = "none";
      pins.forEach(p => p.g.style.display = "none");
      Object.values(provEls).forEach(d => d.el.classList.remove("sel"));
      Object.values(distEls).forEach(d => d.el.classList.remove("sel"));
      if (depG) depG.style.display = "";
      animateVB(FULL_VB);
      setSidebar("peru");
    }

    // Perú → departamento de Lima: muestra sus provincias.
    function enterLima() {
      if (!provFeatures.length || !limaBox) { showToast("Aún cargando las provincias de Lima…"); return; }
      view = "depto"; selectedProv = ""; selectedDistrict = ""; selectedDistName = "";
      hideDetail();
      depG.style.display = "none";
      provG.style.display = "";
      distG.style.display = "none";
      pins.forEach(p => p.g.style.display = "none");
      Object.values(provEls).forEach(d => d.el.classList.remove("sel"));
      Object.values(distEls).forEach(d => { d.el.classList.remove("sel"); d.el.style.display = "none"; });
      animateVB(fitBox(limaBox, 0.06));     // ZOOM Perú → Lima (provincias)
      setSidebar("depto");
    }

    // Departamento → provincia: muestra los distritos de esa provincia.
    function selectProvincia(key, label) {
      hideDetail();
      selectedProv = (selectedProv === key) ? "" : key;
      selectedDistrict = ""; selectedDistName = "";
      Object.values(provEls).forEach(d => d.el.classList.toggle("sel", d.key === selectedProv));
      Object.values(distEls).forEach(d => d.el.classList.remove("sel"));
      pins.forEach(p => p.g.style.display = "none");
      listEl.innerHTML = "";
      if (selectedProv) {
        view = "prov";
        distG.style.display = "";
        Object.values(distEls).forEach(d => { d.el.style.display = (d.provKey === selectedProv) ? "" : "none"; });
        animateVB(fitBox(provEls[key].bbox, 0.10));   // ZOOM Lima → provincia
        setSidebar("prov", label);
      } else {
        enterLima();   // deseleccionar → regresa a las provincias
      }
    }

    // Provincia → distrito: muestra los museos del distrito.
    function selectDistrict(key, label) {
      hideDetail();
      selectedDistrict = (selectedDistrict === key) ? "" : key;
      selectedDistName = selectedDistrict ? distEls[key].distKey : "";
      Object.values(distEls).forEach(d => d.el.classList.toggle("sel", d.key === selectedDistrict));
      if (selectedDistrict) {
        view = "distrito";
        animateVB(fitBox(distEls[key].bbox, 0.35));   // ZOOM provincia → distrito
        setSidebar("distrito", label);
        render();
      } else {
        view = "prov";
        animateVB(fitBox(provEls[selectedProv].bbox, 0.10));   // regresa a la provincia
        setSidebar("prov", provEls[selectedProv].name);
        pins.forEach(p => p.g.style.display = "none");
        listEl.innerHTML = "";
      }
    }

    /* ---------- Sidebar por estado ---------- */
    function setSidebar(state, label) {
      if (state === "peru") {
        titleEl.textContent = "🇵🇪 Perú";
        subtitleEl.textContent = "Toca la figura de Lima en el mapa";
        hintEl.innerHTML = "Visor del Perú por niveles con <b>zoom</b>.<br><br>👉 Toca la <b>figura de Lima</b> (resaltada) para ver sus <b>provincias</b>.";
        hintEl.style.display = "block";
        controlsEl.style.display = "none"; countEl.style.display = "none";
        backEl.style.display = "none"; listEl.innerHTML = "";
      } else if (state === "depto") {
        titleEl.textContent = "🗺️ Lima · provincias";
        subtitleEl.textContent = "Toca una provincia (p. ej. Lima)";
        hintEl.innerHTML = "Estás en el <b>departamento de Lima</b>. Toca la <b>figura de una provincia</b> (las verdes tienen museos) para ver sus <b>distritos</b>.";
        hintEl.style.display = "block";
        controlsEl.style.display = "none"; countEl.style.display = "none";
        backEl.style.display = "block"; listEl.innerHTML = "";
      } else if (state === "prov") {
        titleEl.textContent = "🏙️ " + label + " · distritos";
        subtitleEl.textContent = "Toca la figura de un distrito";
        hintEl.innerHTML = "Provincia de <b>" + label + "</b>. Toca un <b>distrito</b> (los verdes tienen museos) para ver sus museos.";
        hintEl.style.display = "block";
        controlsEl.style.display = "none"; countEl.style.display = "none";
        backEl.style.display = "block"; listEl.innerHTML = "";
      } else { // distrito
        titleEl.textContent = "🏛️ " + label;
        subtitleEl.textContent = "Museos del distrito";
        hintEl.style.display = "none";
        controlsEl.style.display = "flex"; countEl.style.display = "block";
        backEl.style.display = "block";
      }
      // En celular: abre la hoja al ver museos; la colapsa al navegar el mapa.
      if (mqMobile.matches) setSheet(state === "distrito");
    }

    backEl.addEventListener("click", () => {
      if (selectedDistrict) selectDistrict(selectedDistrict, "");
      else if (selectedProv) selectProvincia(selectedProv, "");
      else enterPeru();
    });

    /* ---------- Lista + filtros ---------- */
    let activeCat = "Todos";
    const filtersEl = document.getElementById("filters");
    function buildFilters() {
      const cats = [...new Set(MUSEOS.map(m => m.cat))];
      filtersEl.innerHTML = "";
      ["Todos", ...cats].forEach(c => {
        const b = document.createElement("button");
        b.className = "chip" + (c === "Todos" ? " active" : "");
        b.textContent = c;
        b.onclick = () => {
          activeCat = c;
          document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
          b.classList.add("active");
          render();
        };
        filtersEl.appendChild(b);
      });
    }

    const searchEl = document.getElementById("search");
    let selectedIndex = null;

    function visible(m) {
      const q = searchEl.value.trim().toLowerCase();
      const matchCat = activeCat === "Todos" || m.cat === activeCat;
      const matchDist = !selectedDistrict || (norm(m.nombdist) === selectedDistName && norm(m.provincia) === selectedProv);
      const matchQ = !q || m.nombre.toLowerCase().includes(q) || m.distrito.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
      return matchCat && matchDist && matchQ;
    }

    function render() {
      if (view !== "distrito" || !selectedDistrict) { pins.forEach(p => p.g.style.display = "none"); listEl.innerHTML = ""; return; }
      listEl.innerHTML = "";
      let shown = 0;
      pins.forEach(({ data, index, g }) => {
        if (visible(data)) {
          g.style.display = "";
          shown++;
          const card = document.createElement("div");
          card.className = "card" + (selectedIndex === index ? " selected" : "");
          card.innerHTML = `
            <h3><span class="tag" style="background:${CAT_COLORS[data.cat]}">${data.cat}</span>${data.nombre}</h3>
            <p>${data.distrito} — ${data.desc}</p>`;
          card.onclick = () => showDetail(index);
          listEl.appendChild(card);
        } else {
          g.style.display = "none";
        }
      });
      countEl.textContent = `${shown} museo${shown === 1 ? "" : "s"} en este distrito`;
    }
    searchEl.addEventListener("input", render);

    /* ---------- Detalle del museo ---------- */
    function showDetail(index) {
      const m = MUSEOS[index];
      selectedIndex = index;
      const color = CAT_COLORS[m.cat] || "#e23b3b";
      const maps = `https://www.google.com/maps/search/?api=1&query=${m.coords[0]},${m.coords[1]}`;

      const fotos = (m.fotos && m.fotos.length) ? m.fotos.slice(0, 3) : [];
      const tiles = [];
      for (let k = 0; k < Math.max(fotos.length, 2); k++) {
        if (fotos[k]) tiles.push(`<img class="d-photo" src="${fotos[k]}" alt="${m.nombre}" loading="lazy">`);
        else tiles.push(`<div class="d-ph" style="background:linear-gradient(135deg, ${color}, #1d2c3d)"><span>📷<br>Foto referencial</span></div>`);
      }
      const webBtn = m.web ? `<a class="d-go d-web" href="${m.web}" target="_blank" rel="noopener">Sitio web ↗</a>` : "";

      detailEl.innerHTML = `
        <button class="back2" id="toList">← Volver a la lista</button>
        <span class="d-tag" style="background:${color}">${m.cat}</span>
        <h2>${m.nombre}</h2>
        <p class="d-dist">📍 ${m.distrito}</p>
        <div class="d-section"><h4>Historia</h4><p class="d-desc">${m.historia || m.desc}</p></div>
        <div class="d-section"><h4>Datos</h4>
          <div class="d-meta">
            <div><b>Categoría:</b> ${m.cat}</div>
            <div><b>Fundación / época:</b> ${m.anio || "—"}</div>
            <div><b>Horario:</b> ${m.horario || "Consultar"}</div>
            <div><b>Dirección:</b> ${m.direccion || m.distrito}</div>
            <div><b>Coordenadas:</b> ${m.coords[0].toFixed(4)}, ${m.coords[1].toFixed(4)}</div>
          </div>
        </div>
        <div class="d-actions">
          <a class="d-go" href="${maps}" target="_blank" rel="noopener">Cómo llegar →</a>
          ${webBtn}
        </div>
        <div class="d-section"><h4>Fotos</h4><div class="d-gallery">${tiles.join("")}</div></div>
      `;
      detailEl.querySelectorAll("img.d-photo").forEach(img => {
        img.onerror = () => {
          const ph = document.createElement("div");
          ph.className = "d-ph";
          ph.style.background = `linear-gradient(135deg, ${color}, #1d2c3d)`;
          ph.innerHTML = "<span>📷<br>Foto no disponible</span>";
          img.replaceWith(ph);
        };
      });
      document.getElementById("toList").onclick = backToList;
      listEl.style.display = "none";
      controlsEl.style.display = "none";
      countEl.style.display = "none";
      detailEl.style.display = "block";
      if (mqMobile.matches) setSheet(true);   // en celular, abre la hoja para leer el detalle
    }

    function backToList() {
      detailEl.style.display = "none";
      listEl.style.display = "block";
      if (view === "distrito" && selectedDistrict) { controlsEl.style.display = "flex"; countEl.style.display = "block"; }
      render();
    }
    function hideDetail() { detailEl.style.display = "none"; listEl.style.display = "block"; }

    /* ---------- Toast ---------- */
    let toastTimer;
    const toastEl = document.getElementById("toast");
    function showToast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
    }

    /* ---------- Leyenda ---------- */
    document.getElementById("legend").innerHTML =
      Object.entries(CAT_COLORS).map(([k, v]) =>
        `<div class="row"><span class="sw" style="background:${v}"></span>${k}</div>`).join("");

    /* ---------- Carga (desde el servidor, sin dependencias externas) ---------- */
    const statusEl = document.getElementById("status");
    function setStatus(html, isErr) {
      statusEl.innerHTML = html;
      statusEl.classList.toggle("err", !!isErr);
      statusEl.classList.remove("hide");
    }
    function hideStatus() { statusEl.classList.add("hide"); }

    // Versión anti-caché: cada carga pide datos frescos (evita copias viejas).
    const V = Date.now();
    const getJSON = r => fetch(`${API}?r=${r}&v=${V}`, { cache: "no-store" }).then(res => {
      if (!res.ok) throw new Error(`${r}: HTTP ${res.status}`);
      return res.json();
    });

    Promise.allSettled([getJSON("dep"), getJSON("prov"), getJSON("dist"), getJSON("museos")])
      .then(([dep, prov, dist, museos]) => {
        if (dep.status !== "fulfilled") {
          setStatus(`No se pudo cargar el mapa.<br><code>${dep.reason}</code><br><br>` +
            `Prueba abrir <code>${API}?r=dep</code> directamente.`, true);
          return;
        }
        MUSEOS = (museos.status === "fulfilled" && Array.isArray(museos.value)) ? museos.value : [];
        MUSEOS.forEach(m => { if (!m.provincia) m.provincia = "LIMA"; });

        try {
          depFeatures = dep.value.features;
          provFeatures = (prov.status === "fulfilled")
            ? prov.value.features.filter(f => norm(prop(f.properties, DEP_KEYS)) === "LIMA")
            : [];
          distFeatures = (dist.status === "fulfilled")
            ? dist.value.features.filter(f => norm(prop(f.properties, DEP_KEYS)) === "LIMA")
            : [];
          buildFilters();
          buildMap();
          hideStatus();
          if (!provFeatures.length) showToast("No se cargaron las provincias de Lima; el zoom por niveles no estará disponible.");
        } catch (e) {
          setStatus(`Error al construir el mapa.<br><code>${e.message}</code>`, true);
        }
      })
      .catch(e => setStatus(`Error inesperado.<br><code>${e.message}</code>`, true));
  </script>
</body>
</html>
