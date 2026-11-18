'use strict';
/* Habitat Observatory · atlas: the full-screen global map, the story chapters and the explore panel.
   The map is an equirectangular preview (180°W–180°E, 85°N–60°S, 1800 × 725 px, 0.2° cells). */
(() => {
const HO = window.HO;
const { byId, esc, f3, pct, formatNumber, LAYERS, layer } = HO;
const LAT_TOP = 85, LAT_SPAN = 145, IMG_W = 1800, IMG_H = 725;
const MIN_Z = 1, MAX_Z = 16;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const arrow = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h9M8 3.5 11.5 7 8 10.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const infoIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 7v4.2M8 4.6v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const EV = { done: '<span class="ev ev-done">Completed runs</span>', report: '<span class="ev ev-report">Report-derived</span>', plan: '<span class="ev ev-plan">Planned</span>' };

const vp = byId('map-viewport'), world = byId('map-world'), imgA = byId('map-a'), imgB = byId('map-b');
const rail = byId('rail'), labelsEl = byId('labels'), axisEl = byId('axis-labels'), probeEl = byId('probe'), legendEl = byId('legend'), swipeEl = byId('swipe');

const view = { lon: 0, lat: 12.5, z: 1 };
let area = { l: 0, t: 0, w: 1, h: 1, cx: 0, cy: 0 }, base = 1;
let mode = null, active = false;
let cur = 'albopictus', cmp = null, swipeFrac = 0.5;
let labels = [], probeAt = null, anim = null;

/* ------------------------------------------------------------------ geometry */
const isMobile = () => innerWidth <= 900;
function computeArea() {
  const mastH = document.querySelector('.masthead').getBoundingClientRect().bottom;
  let l, t, r, b;
  if (isMobile()) {
    const rr = rail.getBoundingClientRect();
    l = 8; r = innerWidth - 8; t = mastH + (legendEl.offsetHeight || 40) + 10; b = (rail.hidden ? innerHeight : rr.top) - 10;
    document.documentElement.style.setProperty('--rail-h', `${Math.round(innerHeight - rr.top)}px`);
  } else {
    const rr = rail.getBoundingClientRect();
    l = (rail.hidden ? 0 : rr.right) + 28; r = innerWidth - 28; t = mastH + 18; b = innerHeight - 28;
  }
  const w = Math.max(60, r - l), h = Math.max(60, b - t);
  area = { l, t, w, h, cx: l + w / 2, cy: t + h / 2 };
  base = Math.min(w / 360, h / LAT_SPAN);
}
const ppd = () => base * view.z;
function origin() { const p = ppd(); return [area.cx - (view.lon + 180) * p, area.cy - (LAT_TOP - view.lat) * p]; }
function project(lon, lat) { const [ox, oy] = origin(), p = ppd(); return [ox + (lon + 180) * p, oy + (LAT_TOP - lat) * p]; }
function unproject(x, y) { const [ox, oy] = origin(), p = ppd(); return [(x - ox) / p - 180, LAT_TOP - (y - oy) / p]; }
function clampView() {
  view.z = Math.min(MAX_Z, Math.max(MIN_Z, view.z));
  const p = ppd(), hw = area.w / 2 / p, hh = area.h / 2 / p;
  view.lon = hw >= 180 ? 0 : Math.min(180 - hw, Math.max(-180 + hw, view.lon));
  const mid = LAT_TOP - LAT_SPAN / 2;
  view.lat = hh >= LAT_SPAN / 2 ? mid : Math.min(LAT_TOP - hh, Math.max(LAT_TOP - LAT_SPAN + hh, view.lat));
}
function boundsView([w, s, e, n], fill = 0.82) {
  const z = Math.min(area.w / ((e - w) * base), area.h / ((n - s) * base)) * fill;
  return { lon: (w + e) / 2, lat: (s + n) / 2, z: Math.min(MAX_Z, Math.max(MIN_Z, z)) };
}
const WORLD = { lon: 0, lat: 12.5, z: 1 };

/* ------------------------------------------------------------------ render */
let raf = 0;
function render() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
function draw() {
  if (!active) return;
  clampView();
  const [ox, oy] = origin(), p = ppd();
  world.style.width = `${360 * p}px`; world.style.height = `${LAT_SPAN * p}px`;
  world.style.transform = `translate(${ox}px, ${oy}px)`;
  world.classList.toggle('px', p > IMG_W / 360 * 1.6);
  if (cmp) {
    const sx = area.l + swipeFrac * area.w, local = Math.max(0, sx - ox);
    imgB.style.clipPath = `inset(0 0 0 ${local}px)`;
    swipeEl.style.left = `${sx}px`; swipeEl.style.top = `${area.t}px`; swipeEl.style.height = `${area.h}px`;
    swipeEl.querySelector('i').setAttribute('aria-valuenow', String(Math.round(swipeFrac * 100)));
  }
  drawLabels(); drawAxes(); drawScale(); placeProbe();
}

function drawAxes() {
  const p = ppd(), step = p > 30 ? 5 : p > 12 ? 10 : 30;
  const [x0, y0] = project(-180, LAT_TOP), [x1, y1] = project(180, LAT_TOP - LAT_SPAN);
  const bottom = Math.min(area.t + area.h, y1) - 16, left = Math.max(area.l, x0) + 4;
  let html = '';
  for (let lon = -180 + step; lon < 180; lon += step) {
    const [x] = project(lon, 0);
    if (x < area.l + 18 || x > area.l + area.w - 18) continue;
    html += `<span style="left:${x}px;top:${bottom}px">${lon === 0 ? '0°' : `${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}`}</span>`;
  }
  for (let lat = -60 + (step === 30 ? 30 : step); lat < LAT_TOP; lat += step) {
    const [, y] = project(0, lat);
    if (y < area.t + 10 || y > area.t + area.h - 24) continue;
    html += `<span class="lat" style="left:${left}px;top:${y}px;transform:translate(0,-50%)">${lat === 0 ? 'Eq.' : `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`}</span>`;
  }
  axisEl.innerHTML = html;
}

function drawScale() {
  const lat = Math.max(-60, Math.min(70, view.lat)), kmPerPx = 111.32 * Math.cos(lat * Math.PI / 180) / ppd();
  const nice = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  const d = nice.find(v => v / kmPerPx >= 60) || 5000;
  byId('scale-bar').style.width = `${Math.round(d / kmPerPx)}px`;
  byId('scale-txt').textContent = `${formatNumber(d)} km at ${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`;
}

/* ------------------------------------------------------------------ labels */
function setLabels(list) {
  labels = list.map(l => {
    const el = document.createElement('div');
    el.className = `lab lab-${l.kind || 'place'}${l.below ? ' below' : ''}`;
    if (l.stem !== undefined) el.style.setProperty('--stem', `${l.stem}px`);
    const tag = l.onClick ? `<button type="button" class="tag">${l.html || esc(l.text)}</button>` : `<span class="tag">${l.html || esc(l.text)}</span>`;
    el.innerHTML = `${tag}<span class="stem"></span><span class="dot"></span>`;
    if (l.onClick) el.querySelector('button').addEventListener('click', e => { e.stopPropagation(); l.onClick(); });
    return { ...l, el };
  });
  labelsEl.replaceChildren(...labels.map(l => l.el));
  if (probeAt) addProbeLabel();
  render();
}
function drawLabels() {
  labels.forEach(l => {
    const [x, y] = project(l.lon, l.lat);
    const vis = x > area.l - 4 && x < area.l + area.w + 4 && y > area.t - 4 && y < area.t + area.h + 4 && (!l.minZ || view.z >= l.minZ) && (!l.maxZ || view.z <= l.maxZ) && !(isMobile() && (l.kind === 'place' || l.kind === 'site') && mode === 'explore' && view.z < 2.5);
    l.el.style.transform = `translate(${x}px, ${y}px)`;
    l.el.style.display = vis ? '' : 'none';
  });
}
function addProbeLabel() {
  const el = document.createElement('div');
  el.className = 'lab lab-probe'; el.dataset.probe = '1';
  el.innerHTML = '<span class="stem"></span><span class="dot"></span>';
  labelsEl.querySelectorAll('[data-probe]').forEach(n => n.remove());
  labelsEl.append(el);
  labels = labels.filter(l => !l.probe).concat([{ lon: probeAt[0], lat: probeAt[1], el, probe: true }]);
}

/* ------------------------------------------------------------------ camera */
function setView(v, ms = 1300) {
  cancelAnimationFrame(anim); anim = null;
  const target = { ...view, ...v };
  if (reduceMotion || ms === 0) { Object.assign(view, target); render(); return; }
  const from = { ...view }, t0 = performance.now();
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lz0 = Math.log(from.z), lz1 = Math.log(target.z);
  const step = now => {
    const t = Math.min(1, (now - t0) / ms), k = ease(t);
    view.lon = from.lon + (target.lon - from.lon) * k;
    view.lat = from.lat + (target.lat - from.lat) * k;
    view.z = Math.exp(lz0 + (lz1 - lz0) * k);
    draw();
    anim = t < 1 ? requestAnimationFrame(step) : null;
  };
  anim = requestAnimationFrame(step);
}
function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
function zoomAbout(x, y, f) {
  stopAnim();
  const [lon, lat] = unproject(x, y);
  view.z = Math.min(MAX_Z, Math.max(MIN_Z, view.z * f));
  const p = ppd();
  view.lon = lon - (x - area.cx) / p; view.lat = lat + (y - area.cy) / p;
  render();
}

/* ------------------------------------------------------------------ layers */
function swapImage(img, src) {
  if (img.getAttribute('src') === src) return;
  img.style.opacity = '0';
  const next = new Image();
  next.onload = () => { img.src = src; img.style.opacity = '1'; };
  next.src = src;
}
const src = id => `assets/hico/global_${id}.webp`;
function setLayer(id, { silent } = {}) {
  cur = id; swapImage(imgA, src(id));
  if (cmp === id) setCompare(null);
  updateLegend();
  if (probeAt) openProbe(...probeAt, true);
  if (mode === 'explore' && !silent) syncExplore();
}
function setCompare(id) {
  cmp = id;
  imgB.hidden = !id; swipeEl.hidden = !id;
  if (id) {
    swapImage(imgB, src(id));
    byId('swipe-l').textContent = layer(cur).short; byId('swipe-r').textContent = layer(id).short;
  }
  updateLegend(); render();
  if (probeAt) openProbe(...probeAt, true);
}
function updateLegend() {
  const a = layer(cur), b = cmp && layer(cmp);
  legendEl.innerHTML = b
    ? `<h4>Compare two layers<small>Drag the divider on the map</small></h4>
       <div class="pair"><span>Left</span><i style="background:${a.ramp}"></i><span>Right</span><i style="background:${b.ramp}"></i></div>
       <div class="ticks"><span>${a.name} · ${b.name}</span></div>
       <div class="src">Each layer uses its own scale. Relative ranking, not occurrence.</div>`
    : `<h4>${a.name}<small>${a.unit}</small></h4><div class="ramp" style="background:${a.ramp}"></div><div class="ticks"><span>Low</span><span>High</span></div>
       <div class="src">HiCo-Fuse 2 · 0.2° preview of 0.05° cells · a relative ranking, not validated occurrence.</div>`;
  requestAnimationFrame(() => document.documentElement.style.setProperty('--legend-h', `${legendEl.offsetHeight}px`));
}

/* ------------------------------------------------------------------ probe: read the preview colour */
const pixCache = new Map();
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rampTable(css) {
  const stops = css.match(/#[0-9a-f]{6}/gi).map(hexRgb), out = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
    out.push(stops[k].map((c, j) => c + (stops[k + 1][j] - c) * f));
  }
  return out;
}
function pixels(id) {
  if (!pixCache.has(id)) {
    pixCache.set(id, new Promise((resolve, reject) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = IMG_W; c.height = IMG_H;
          const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0);
          resolve(ctx.getImageData(0, 0, IMG_W, IMG_H).data);
        } catch (e) { reject(e); }
      };
      im.onerror = reject; im.src = src(id);
    }));
    if (pixCache.size > 4) pixCache.delete(pixCache.keys().next().value);
  }
  return pixCache.get(id);
}
async function readCell(id, lon, lat) {
  if (lat > LAT_TOP || lat < LAT_TOP - LAT_SPAN || lon < -180 || lon > 180) return { kind: 'out' };
  const data = await pixels(id), L = layer(id);
  const px = Math.min(IMG_W - 1, Math.floor((lon + 180) / 360 * IMG_W)), py = Math.min(IMG_H - 1, Math.floor((LAT_TOP - lat) / LAT_SPAN * IMG_H));
  const o = (py * IMG_W + px) * 4, rgb = [data[o], data[o + 1], data[o + 2]], a = data[o + 3];
  if (a < 110) return { kind: 'sea' };
  if (Math.hypot(rgb[0] - 37, rgb[1] - 48, rgb[2] - 65) < 12) return { kind: 'mask' };  // renderer's fixed colour for masked land (e.g. ice sheets)
  const tab = L._tab || (L._tab = rampTable(L.ramp));
  let best = 0, bd = Infinity;
  tab.forEach((c, i) => { const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2; if (d < bd) { bd = d; best = i; } });
  if (Math.sqrt(bd) > 48) return { kind: 'mask' };
  return { kind: 'value', t: best / 255 };
}
const band = t => t < .2 ? 'very low' : t < .4 ? 'low' : t < .6 ? 'moderate' : t < .8 ? 'high' : 'very high';
const fmtLL = (lon, lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
async function openProbe(lon, lat, refresh) {
  probeAt = [lon, lat];
  if (!refresh) { addProbeLabel(); }
  const ids = cmp ? [cur, cmp] : [cur];
  let out;
  try { out = await Promise.all(ids.map(id => readCell(id, lon, lat))); }
  catch { out = ids.map(() => ({ kind: 'err' })); }
  if (!probeAt || probeAt[0] !== lon || probeAt[1] !== lat) return;
  const block = (id, r) => {
    const L = layer(id);
    if (r.kind === 'value') return `<div class="big">${r.t.toFixed(2)}<small>${band(r.t)}</small></div><div class="pr-ramp" style="background:${L.ramp}"><b style="left:${(r.t * 100).toFixed(1)}%"></b></div>`;
    const msg = { sea: 'Ocean or no land cell here.', mask: 'Masked land cell: no model value.', out: 'Outside the mapped domain (85°N–60°S).', err: 'The preview could not be read in this browser.' }[r.kind];
    return `<p class="small" style="margin:2px 0 0">${msg}</p>`;
  };
  const cell = `${(Math.floor(lat / .2) * .2).toFixed(1)}°…${(Math.floor(lat / .2) * .2 + .2).toFixed(1)}°`;
  probeEl.innerHTML = `<h5><span>${cmp ? 'Two layers here' : layer(cur).name}</span><button type="button" aria-label="Close">×</button></h5>
    ${ids.map((id, k) => `${cmp ? `<div class="small" style="margin:${k ? 10 : 0}px 0 4px">${k ? 'Right' : 'Left'} · ${layer(id).name}</div>` : ''}${block(id, out[k])}`).join('')}
    <dl><dt>Location</dt><dd>${fmtLL(lon, lat)}</dd><dt>0.2° cell, latitude</dt><dd>${cell}</dd></dl>
    <p class="small">Position on the colour ramp, read from the rendered preview (0 = lowest, 1 = highest). A relative ranking, not a probability or a model output.</p>`;
  probeEl.querySelector('button').onclick = closeProbe;
  probeEl.hidden = false;
  placeProbe();
}
function closeProbe() {
  probeAt = null; probeEl.hidden = true;
  labelsEl.querySelectorAll('[data-probe]').forEach(n => n.remove());
  labels = labels.filter(l => !l.probe);
}
function placeProbe() {
  if (!probeAt || probeEl.hidden) return;
  const [x, y] = project(...probeAt), w = probeEl.offsetWidth, h = probeEl.offsetHeight;
  let px = x + 16, py = y - h / 2;
  if (px + w > innerWidth - 10) px = x - w - 16;
  py = Math.max(area.t, Math.min(py, area.t + area.h - h));
  px = Math.max(8, px);
  probeEl.style.left = `${px}px`; probeEl.style.top = `${py}px`;
}

/* ------------------------------------------------------------------ pointer and keyboard */
const pts = new Map();
let drag = null, pinch = null;
vp.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  vp.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  stopAnim();
  if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: false };
  if (pts.size === 2) {
    const [a, b] = [...pts.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: view.z }; drag = null;
  }
});
vp.addEventListener('pointermove', e => {
  const [lon, lat] = unproject(e.clientX, e.clientY);
  byId('coord').textContent = lat <= LAT_TOP && lat >= LAT_TOP - LAT_SPAN ? fmtLL(Math.max(-180, Math.min(180, lon)), lat) : '—';
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAbout((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (pinch.z * d / pinch.d) / view.z);
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true; vp.classList.add('dragging');
  view.lon = drag.lon - dx / ppd(); view.lat = drag.lat + dy / ppd();
  render();
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size < 2) pinch = null;
  if (drag && !drag.moved && e.type === 'pointerup') {
    const [lon, lat] = unproject(e.clientX, e.clientY);
    if (lat <= LAT_TOP && lat >= LAT_TOP - LAT_SPAN && lon >= -180 && lon <= 180) openProbe(lon, lat); else closeProbe();
  }
  if (pts.size === 0) { drag = null; vp.classList.remove('dragging'); }
}
vp.addEventListener('pointerup', endPointer);
vp.addEventListener('pointercancel', endPointer);
vp.addEventListener('pointerleave', () => { byId('coord').textContent = 'Move over the map'; });
vp.addEventListener('wheel', e => { e.preventDefault(); zoomAbout(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018))); }, { passive: false });
vp.addEventListener('dblclick', e => { e.preventDefault(); zoomAbout(e.clientX, e.clientY, 2); });
vp.addEventListener('keydown', e => {
  const k = e.key, p = 60 / ppd();
  const moves = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, p], ArrowDown: [0, -p] };
  if (moves[k]) { e.preventDefault(); e.stopPropagation(); stopAnim(); view.lon += moves[k][0]; view.lat += moves[k][1]; render(); }
  else if (k === '+' || k === '=') { e.preventDefault(); zoomAbout(area.cx, area.cy, 1.5); }
  else if (k === '-' || k === '_') { e.preventDefault(); zoomAbout(area.cx, area.cy, 1 / 1.5); }
  else if (k === '0') { e.preventDefault(); setView(WORLD, 700); }
});
document.querySelector('.map-tools').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.zoom === 'in') setView({ z: Math.min(MAX_Z, view.z * 1.8) }, 380);
  if (b.dataset.zoom === 'out') setView({ z: Math.max(MIN_Z, view.z / 1.8) }, 380);
  if (b.dataset.zoom === 'home') setView(WORLD, 800);
});

/* swipe divider */
(() => {
  const handle = swipeEl.querySelector('i');
  let on = false;
  const move = x => { swipeFrac = Math.min(.98, Math.max(.02, (x - area.l) / area.w)); render(); };
  handle.addEventListener('pointerdown', e => { on = true; handle.setPointerCapture(e.pointerId); e.stopPropagation(); });
  handle.addEventListener('pointermove', e => { if (on) move(e.clientX); });
  handle.addEventListener('pointerup', () => { on = false; });
  handle.addEventListener('keydown', e => {
    const d = { ArrowLeft: -.04, ArrowRight: .04 }[e.key]; if (!d) return;
    e.preventDefault(); e.stopPropagation(); swipeFrac = Math.min(.98, Math.max(.02, swipeFrac + d)); render();
  });
})();

/* ------------------------------------------------------------------ places */
const ZOOMS = {
  florida: { name: 'Florida', layer: 'albopictus', bounds: [-88, 24, -79.5, 31.2], city: 'Miami metro', pin: [-80.2, 25.8] },
  seasia: { name: 'Malay Peninsula', layer: 'aegypti', bounds: [99, -0.5, 105.5, 7.5], city: 'Singapore and Johor Bahru', pin: [103.8, 1.4] },
  italy: { name: 'Northern Italy', layer: 'albopictus', bounds: [6.5, 40.6, 15, 47.2], city: 'Rome', pin: [12.5, 41.9] },
};
const GOTO = [
  ['World', null], ['Americas', [-130, -56, -30, 62]], ['Europe & Africa', [-20, -36, 55, 64]], ['Asia–Pacific', [60, -46, 180, 55]],
  ['Florida', ZOOMS.florida.bounds], ['Malay Peninsula', ZOOMS.seasia.bounds], ['Northern Italy', ZOOMS.italy.bounds],
];
const REGIONS = [['Americas', -95, 40], ['South America', -60, -14], ['Europe', 15, 54], ['Africa', 20, 6], ['Asia', 92, 46], ['Oceania', 134, -25]];
const regionLabels = () => REGIONS.map(([t, lon, lat]) => ({ kind: 'region', text: t, lon, lat, maxZ: 2.2 }));
function placeLabels() {
  return Object.entries(ZOOMS).map(([k, z]) => ({ kind: 'place', lon: z.pin[0], lat: z.pin[1], below: k === 'italy', html: `${esc(z.city)}<small>zoom window</small>`, onClick: () => { setLayer(z.layer); setView(boundsView(z.bounds)); } }))
    .concat([
      { kind: 'site', lon: -98, lat: 39.5, html: 'NEON trap network<small>diagnostic</small>', stem: 48 },
      { kind: 'site', lon: 14.3, lat: 47.6, html: 'AGES ovitraps, Austria<small>survey</small>', stem: 30, minZ: 1.6 },
    ]);
}

/* ------------------------------------------------------------------ story */
let si = 0, zoomKey = 'florida';
function chapters() {
  const B = HO.B, H = B.hf2, m = B.hico.meta;
  const arm = id => H.arms.find(a => a.id === id);
  const bestId = arm('HF2-shrink2+pool4') ? 'HF2-shrink2+pool4' : 'HF2-shrink2', best = arm(bestId), rf = arm('RF');
  const sep = HO.cohRow('MLPEarly', 'Ae_albopictus');
  const ex = (ds, sub, model) => HO.ext(ds, sub, model);
  const neon = H.external['NEON 2026 Ae. albopictus · 373 sites'];
  return [
    { id: 'cover', cover: true, chap: 'A global atlas of vector habitat', title: 'Where could disease-carrying mosquitoes live?',
      body: 'Four groups of mosquitoes carry dengue, chikungunya, Zika, West Nile virus and malaria. This atlas maps where each could find suitable habitat, from satellite embeddings, climate, landscape and human footprint, with one model that stays consistent from the whole globe down to a city.',
      enter: () => { setLayer('albopictus'); setView(WORLD, 1500); setLabels(regionLabels()); } },
    { id: 'data', chap: 'The observations', ev: 'done', title: `${formatNumber(m.records_on_complete_cells)} mosquito reports, and the places they miss`,
      body: 'Research-grade iNaturalist reports of mosquitoes are pooled into 0.05° cells. The model learns which species make up the reports in each place, so observer effort, which inflates every species alike, cancels out. This layer shows where a mosquito community is observed at all; reports cluster in the Americas and Europe, and elsewhere the maps extrapolate.',
      figs: [[formatNumber(m.records_on_complete_cells), '', 'reports, 2022–2025'], [formatNumber(m.report_cells), '', 'report cells at 0.05°'], [formatNumber(m.parents_with_reports), '', '0.5° regions with reports']],
      enter: () => { setLayer('support'); setView(WORLD); setLabels([{ kind: 'note', lon: 20, lat: 2, html: '<b>75</b> report cells in all of Africa: maps there are extrapolations', stem: 40 }]); } },
    { id: 'niche', chap: 'The niche', ev: 'done', title: 'A random forest reads four kinds of evidence at once',
      body: 'Climate (26 features), landscape (11), human footprint (4) and the 64 dimensions of Google’s AlphaEarth satellite embedding enter one random forest. AlphaEarth carries most of the signal on its own. Neural encoders and learned gates that looked good in-sample lost when whole regions were held out, so the method does not use them.',
      figs: [['105', '', 'features in four modalities'], [f3(HO.cv('Single:AlphaEarth').AUC_mean), '', 'AUC, AlphaEarth alone'], [f3(rf.AUC_loro), '', 'forest AUC, region held out']],
      ctrl: () => `<div class="ctrl-label">Vector layer</div><div class="seg full" id="st-vec">${['albopictus', 'aegypti', 'culex', 'anopheles'].map(id => `<button type="button" data-l="${id}" aria-pressed="${id === (['albopictus', 'aegypti', 'culex', 'anopheles'].includes(cur) ? cur : 'albopictus')}"><i>${layer(id).short}</i></button>`).join('')}</div>`,
      wire: () => byId('st-vec').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; byId('st-vec').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); setLayer(b.dataset.l); }),
      enter: () => { if (!['albopictus', 'aegypti', 'culex', 'anopheles'].includes(cur)) setLayer('albopictus'); setView(WORLD); setLabels(regionLabels()); } },
    { id: 'coherence', chap: 'Coherence', ev: 'done', title: 'A city cannot exceed its region',
      body: 'Each 0.5° region is built from its 100 child cells of 0.05°, so the regional map is exactly the mean of the local one. When the coarse level was fitted separately, most regions disagreed with their own cells by more than a factor of two.',
      figs: [[f3(H.coherence_max_abs_log, 4), '', 'median cross-scale log-error'], [`${pct(sep.share_parents_off_by_more_than_2x)} → 0`, '', 'regions off by more than 2×']], figsTwo: true,
      ctrl: () => `<div class="seg full" id="st-zoom">${Object.entries(ZOOMS).map(([k, z]) => `<button type="button" data-z="${k}" aria-pressed="${k === zoomKey}">${z.name}</button>`).join('')}</div>
        <div class="zoom-mini" id="st-zoom-img"></div>
        <p class="small" style="margin:4px 0 0">Thumbnails share one colour scale per region; the map behind uses the global scale. <a href="#coherence">More on coherence →</a></p>`,
      wire: () => {
        const show = k => {
          zoomKey = k; const z = ZOOMS[k];
          byId('st-zoom').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.z === k)));
          byId('st-zoom-img').innerHTML = [['coarse', 'Region · 0.5°', 'mean of 100 cells'], ['fine', 'Local · 0.05°', 'redistributes the total'], ['city', esc(z.city), 'native cells']]
            .map(([s, t, d]) => `<figure><div class="zi"><img src="assets/hico/zoom_${k}_${s}.webp" alt="${t}"></div><figcaption><b>${t}</b>${d}</figcaption></figure>`).join('');
          setLayer(z.layer); setView(boundsView(z.bounds), 1600);
          setLabels([{ kind: 'place', lon: z.pin[0], lat: z.pin[1], text: z.city }]);
        };
        byId('st-zoom').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.z); });
        show(zoomKey);
      },
      enter: () => {} },
    { id: 'twopart', chap: 'Two-part maps', ev: 'done', title: 'No mosquito community, no habitat score',
      body: 'A composition model answers “if a mosquito is reported here, which species is it?”, and that question is undefined where no community is observed. The first maps put the top <i>Ae. aegypti</i> cells in the Sahara and Arabia. Multiplying by a community-support term removes them.',
      figs: [[f3(B.hico.support_cv[0]), '', 'support term, spatial-CV AUC'], [`${f3(ex('Kraemer Ae. aegypti', 'all', 'HiCo (composition only)'), 2)}→${f3(ex('Kraemer Ae. aegypti', 'all', 'HiCo x support (two-part)'), 2)}`, '', 'Kraemer <i>Ae. aegypti</i> AUC, composition → two-part']], figsTwo: true,
      enter: () => { setLayer('aegypti'); setView(boundsView([-25, -5, 70, 40])); setLabels([{ kind: 'note', lon: 12, lat: 23, html: 'Composition-only maps ranked the <b>Sahara and Arabia</b> highest for <i>Ae. aegypti</i>', stem: 36 }]); } },
    { id: 'transfer', chap: 'Transfer', ev: 'done', title: 'Tested where the model has never seen data',
      body: `Whole world regions, climate clusters and climate zones are held out in turn. HiCo-Fuse 2 ranks as well as or better than the random forest on ${best.auc_test.wins} of ${best.auc_test.n} splits. The gain is not yet significant, and with a whole region held out its probabilities are still less calibrated than the forest’s.`,
      figs: [[`${best.auc_test.wins}/${best.auc_test.n}`, '', 'splits won on AUC vs forest'], [f3(best.auc_test.p, 2), '', 'sign-test p (not significant)'], [f3(neon, 2), '', 'AUC on NEON 2026 traps']],
      ctrl: () => {
        const D = [['block10', '10° blocks'], ['env', 'Climate cluster out'], ['loro', 'World region out'], ['zone', 'Climate zone out']];
        return `<table class="metrics"><thead><tr><th>Held-out AUC</th><td>Forest</td><td>HiCo-Fuse 2</td></tr></thead><tbody>${D.map(([d, l]) => {
          const a = rf[`AUC_${d}`], b = best[`AUC_${d}`];
          return `<tr><th>${l}</th><td class="${a > b ? 'on' : ''}">${f3(a)}</td><td class="${b >= a ? 'on' : ''}">${f3(b)}</td></tr>`;
        }).join('')}</tbody></table><p class="small" style="margin:6px 0 0"><a href="#hf2">All arms and log-loss by region →</a></p>`;
      },
      enter: () => { setLayer('albopictus'); setView(WORLD); setLabels(regionLabels()); } },
    { id: 'disease', chap: 'Disease layers', ev: 'done', title: 'From vectors to transmission envelopes',
      body: 'Each vector map is multiplied by a thermal performance envelope for its pathogen and combined across vectors. These are suitability indices, not incidence or risk forecasts; the West Nile limits are approximate.',
      ctrl: () => `<div class="seg full" id="st-dis">${['dengue', 'wnv', 'malaria'].map(id => `<button type="button" data-l="${id}" aria-pressed="${id === (['dengue', 'wnv', 'malaria'].includes(cur) ? cur : 'dengue')}">${layer(id).short}</button>`).join('')}</div><p class="small" id="st-dis-cap" style="margin:10px 0 0"></p>`,
      wire: () => {
        const show = id => { setLayer(id); byId('st-dis').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.l === id))); byId('st-dis-cap').innerHTML = layer(id).cap; };
        byId('st-dis').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.l); });
        show(['dengue', 'wnv', 'malaria'].includes(cur) ? cur : 'dengue');
      },
      enter: () => { setView(WORLD); setLabels(regionLabels()); } },
    { id: 'next', chap: 'What comes next', title: 'What is finished, and what is still to run',
      body: 'Results on this site carry their status. The HiCo-Fuse 2 benchmarks are completed runs; the earlier representation benchmark is report-derived until its frozen inputs are recovered; the next experiments are planned and have no results yet.',
      ctrl: () => `<div class="lists3">
          <div class="l-done"><b>${EV.done}</b><span>HiCo-Fuse 2 on 20 transfer splits, coherence, two-part maps, nine holdout designs and a ${B.ledger.length}-entry research ledger.</span></div>
          <div class="l-rep"><b>${EV.report}</b><span>The 1,601-site representation benchmark (AlphaEarth + logistic development AP ${f3(B.foundation.find(r => r.representation === 'AlphaEarth64' && r.learner === 'GLM').AP, 2)}) and the NEON 2025 diagnostic. Not reproduced.</span></div>
          <div class="l-plan"><b>${EV.plan}</b><span>P0 recovery gate → P1 replication → P2 TESSERA and fusion study → P3 ablations → P4 occupancy–detection → P5 dengue branch.</span></div>
        </div>
        <div class="row" style="margin-top:14px"><a class="btn primary" href="#plan">Open the research plan ${arrow}</a><a class="btn quiet" href="#explore">Explore the maps</a></div>`,
      enter: () => { setLayer('albopictus'); setView(WORLD); setLabels(regionLabels()); } },
  ];
}
let STEPS = [];
function storyGo(i, force) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  if (i === si && !force) return;
  si = i; closeProbe(); renderStory(); STEPS[i].enter();
  history.replaceState(null, '', i ? `#story/${i}` : '#story');
}
function renderStory() {
  const st = STEPS[si], n = STEPS.length - 1;
  rail.classList.remove('fade'); void rail.offsetWidth; rail.classList.add('fade');
  const figs = st.figs ? `<div class="figs${st.figsTwo ? ' two' : ''}">${st.figs.map(([v, u, l]) => `<div class="fig"><b>${v}${u ? `<small>${u}</small>` : ''}</b><span>${l}</span></div>`).join('')}</div>` : '';
  const kick = st.cover ? `<div class="kicker"><span class="chap">${st.chap}</span></div>`
    : `<div class="kicker"><span class="n">${si} / ${n}</span><span class="chap">${st.chap}</span>${st.ev ? EV[st.ev] : ''}</div>`;
  const nav = st.cover
    ? `<div class="nav" style="border-top:0;padding-top:4px"><button type="button" class="btn primary" id="s-next">Begin ${arrow}</button>
         <div class="row" style="gap:2px"><a class="btn quiet" href="#explore">Explore</a><a class="btn quiet" href="#framework">Framework</a></div></div>
       <p class="small" style="margin:14px 0 0">4 vectors · 3 disease indices · 0.2° previews of 0.05° maps · a relative ranking, not occurrence</p>`
    : `<div class="nav"><button type="button" class="btn quiet" id="s-prev">← Back</button>
         <div class="steps">${STEPS.slice(1).map((s, k) => `<button type="button" data-step="${k + 1}" class="${k + 1 === si ? 'on' : (k + 1 < si ? 'done' : '')}" aria-label="Chapter ${k + 1}: ${esc(s.chap)}"${k + 1 === si ? ' aria-current="step"' : ''}></button>`).join('')}</div>
         ${si < n ? '<button type="button" class="btn" id="s-next">Next →</button>' : '<span style="width:64px"></span>'}</div>`;
  rail.innerHTML = `<button type="button" class="grip" aria-label="Collapse or expand the panel"><i></i></button>${kick}<h2 class="${st.cover ? 'cover' : ''}">${st.title}</h2><p>${st.body}</p>${figs}${st.ctrl ? `<div class="ctrl">${st.ctrl()}</div>` : ''}${nav}`;
  const q = s => rail.querySelector(s);
  q('#s-next') && (q('#s-next').onclick = () => storyGo(si + 1));
  q('#s-prev') && (q('#s-prev').onclick = () => storyGo(si - 1));
  rail.querySelectorAll('[data-step]').forEach(b => { b.onclick = () => storyGo(+b.dataset.step); });
  wireGrip();
  if (st.wire) st.wire();
  afterRail();
}

/* ------------------------------------------------------------------ explore */
function renderExplore() {
  let html = '', group = '';
  LAYERS.forEach(l => {
    if (l.group !== group) { group = l.group; html += `<li class="grp">${group}</li>`; }
    html += `<li><label><input type="radio" name="ex-layer" value="${l.id}"${l.id === cur ? ' checked' : ''}><span><b>${l.name}</b><small>${l.sub}</small></span><i class="sw" style="background:${l.ramp}"></i></label></li>`;
  });
  const opts = LAYERS.map(l => `<option value="${l.id}">${l.short}</option>`).join('');
  rail.classList.remove('fade'); void rail.offsetWidth; rail.classList.add('fade');
  rail.innerHTML = `<button type="button" class="grip" aria-label="Collapse or expand the panel"><i></i></button>
    <div class="section-h">Global layers <small>HiCo-Fuse 2 · 0.2° preview</small></div>
    <ul class="layers" id="ex-layers">${html}</ul>
    <p class="layer-cap" id="ex-cap"></p>
    <div class="section-h">Compare</div>
    <ul class="layers"><li><label><input type="checkbox" id="ex-cmp"${cmp ? ' checked' : ''}><span>Swipe against another layer</span></label><select id="ex-cmp-layer" aria-label="Comparison layer">${opts}</select></li></ul>
    <div class="section-h">Show</div>
    <ul class="layers">
      <li><label><input type="checkbox" id="ex-grat"${byId('graticule').classList.contains('off') ? '' : ' checked'}><span>Graticule, equator and tropics</span></label></li>
      <li><label><input type="checkbox" id="ex-places" checked><span>Zoom windows and validation regions</span></label></li>
    </ul>
    <div class="section-h">Go to</div>
    <div class="goto" id="ex-goto">${GOTO.map(([t], i) => `<button type="button" data-g="${i}">${t}</button>`).join('')}</div>
    <p class="hint">${infoIcon}<span>Drag to pan, scroll or pinch to zoom, click a cell to read it. Low values in tropical Asia and Africa are weak evidence, not absence.</span></p>
    <p class="small" style="margin:12px 0 0"><span class="ev ev-done">Completed runs</span>&nbsp; Maps from the HiCo-Fuse 2 deployment. <a href="#framework">How they are made →</a></p>`;
  const sel = byId('ex-cmp-layer');
  sel.value = cmp || (cur === 'aegypti' ? 'albopictus' : 'aegypti');
  byId('ex-layers').addEventListener('change', e => { if (e.target.name === 'ex-layer') { setLayer(e.target.value); if (cmp && sel.value === cur) { sel.value = LAYERS.find(l => l.id !== cur).id; setCompare(sel.value); } } });
  byId('ex-cmp').addEventListener('change', e => { if (e.target.checked && sel.value === cur) sel.value = LAYERS.find(l => l.id !== cur).id; setCompare(e.target.checked ? sel.value : null); });
  sel.addEventListener('change', () => { if (sel.value === cur) return; if (byId('ex-cmp').checked) setCompare(sel.value); });
  byId('ex-grat').addEventListener('change', e => byId('graticule').classList.toggle('off', !e.target.checked));
  byId('ex-places').addEventListener('change', e => setLabels(e.target.checked ? placeLabels() : []));
  byId('ex-goto').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const g = GOTO[+b.dataset.g][1]; setView(g ? boundsView(g, .92) : WORLD); });
  wireGrip();
  syncExplore();
  afterRail();
}
function syncExplore() {
  const r = rail.querySelector(`input[name="ex-layer"][value="${cur}"]`); if (r) r.checked = true;
  const cap = byId('ex-cap'); if (cap) cap.innerHTML = layer(cur).cap;
  history.replaceState(null, '', `#explore/${cur}`);
}

/* ------------------------------------------------------------------ rail helpers */
function wireGrip() {
  const g = rail.querySelector('.grip');
  if (g) g.onclick = () => { document.body.classList.toggle('rail-min'); setTimeout(() => { computeArea(); render(); }, 380); };
}
function afterRail() { requestAnimationFrame(() => { computeArea(); render(); }); }

/* ------------------------------------------------------------------ public */
function enter(m, arg) {
  const first = !active;
  active = true;
  if (!STEPS.length) STEPS = chapters();
  if (m !== mode) { closeProbe(); document.body.classList.remove('rail-min'); }
  const prev = mode; mode = m;
  computeArea();
  if (first) { Object.assign(view, WORLD); updateLegend(); }
  if (m === 'story') {
    if (cmp) setCompare(null);
    const i = Math.max(0, Math.min(STEPS.length - 1, parseInt(arg, 10) || 0));
    if (prev !== 'story' || i !== si || first) { si = i; renderStory(); STEPS[si].enter(); }
  } else {
    if (arg && layer(arg)) setLayer(arg, { silent: true });
    if (prev !== 'explore') { renderExplore(); setLabels(placeLabels()); if (prev === 'story' || first) setView(WORLD, first ? 0 : 900); }
    else syncExplore();
  }
  computeArea(); render();
}
function leave() { active = false; mode = null; closeProbe(); stopAnim(); }
function key(e) {
  if (!active) return;
  if (e.key === 'Escape') { closeProbe(); return; }
  if (mode !== 'story' || e.target.closest('input, select, textarea, .map-viewport, [role="slider"]')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); storyGo(si + 1); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); storyGo(si - 1); }
}
addEventListener('resize', () => { if (active) { computeArea(); render(); } });
window.Atlas = { enter, leave, key };
})();
