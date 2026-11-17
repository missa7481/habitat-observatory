'use strict';
/* Habitat Observatory · HiCo-Fuse. Every number is read from data/model_benchmarks.json (aggregate results only). */
(() => {
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatNumber = value => Number(value || 0).toLocaleString('en-US');
const f3 = (v, k = 3) => (v === null || v === undefined || !Number.isFinite(Number(v))) ? '—' : Number(v).toFixed(k);
const sgn = (v, k = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(k);
const pct = v => `${Math.round(v * 100)}%`;
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SEQ = ['#f3f7fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
let B;
const state = { design: 'loro', metric: 'AUC' };

async function getJSON(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/* ------------------------------------------------------------------ routing */
const PAGES = ['framework', 'maps', 'evidence', 'methods'];
const ANCHOR_PAGE = {
  architecture: 'framework', hf2: 'framework', coherence: 'framework', twopart: 'framework', 'fusion-results': 'framework', gates: 'framework', extensions: 'framework', status: 'framework',
  findings: 'evidence', lab: 'evidence', benchmark: 'evidence', fusion: 'evidence', experiments: 'evidence', families: 'evidence', ledger: 'evidence',
  data: 'methods', features: 'methods', pipeline: 'methods', validation: 'methods', limits: 'methods', terms: 'methods',
  research: 'evidence', explore: 'maps', models: 'evidence', review: 'methods', monitor: 'methods',
};
function route() {
  const name = location.hash.slice(1) || 'framework';
  const page = PAGES.includes(name) ? name : (ANCHOR_PAGE[name] || 'framework');
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.id !== `page-${page}`; });
  document.querySelectorAll('.site-header nav a').forEach(a => {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const target = !PAGES.includes(name) && document.getElementById(name);
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', route);
route();

/* ------------------------------------------------------------------ tooltip */
const tip = byId('tip');
document.addEventListener('pointerover', e => {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
});
document.addEventListener('pointermove', e => {
  if (tip.hidden) return;
  tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${e.clientY + 16}px`;
});
document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tip.hidden = true; });

/* ------------------------------------------------------------------ map layers */
const NIGHT = 'linear-gradient(90deg, #0f2238, #15568c, #2b95c8, #86d3dc, #fff4c2)';
const EMBER = 'linear-gradient(90deg, #1f1626, #62203a, #b8412c, #f0a032, #fff4c2)';
const LAYERS = [
  { id: 'albopictus', group: 'Vectors', name: '<i>Ae. albopictus</i>', short: 'Ae. albopictus', sub: 'Asian tiger mosquito', ramp: NIGHT, unit: 'Two-part intensity, scaled to the upper tail',
    cap: '<i>Ae. albopictus</i>: community support × species share (HiCo-Fuse 2), shown at 0.2° as the mean of 0.05° cells.' },
  { id: 'aegypti', group: 'Vectors', name: '<i>Ae. aegypti</i>', short: 'Ae. aegypti', sub: 'Yellow fever mosquito', ramp: NIGHT, unit: 'Two-part intensity, scaled to the upper tail',
    cap: '<i>Ae. aegypti</i>: strongest in the Gulf of Mexico, Central America, the Caribbean, coastal Brazil and north-east Australia.' },
  { id: 'culex', group: 'Vectors', name: '<i>Culex</i> spp.', short: 'Culex', sub: 'Genus-level class', ramp: NIGHT, unit: 'Two-part intensity, scaled to the upper tail',
    cap: '<i>Culex</i> spp., genus-level. Held-out AUC is only 0.55–0.59 because <i>Culex</i> is reported almost everywhere mosquitoes are.' },
  { id: 'anopheles', group: 'Vectors', name: '<i>Anopheles</i> spp.', short: 'Anopheles', sub: 'Genus-level class', ramp: NIGHT, unit: 'Two-part intensity, scaled to the upper tail',
    cap: '<i>Anopheles</i> spp., genus-level, dominated by North American and Australian reports in this data.' },
  { id: 'dengue', group: 'Disease indices', name: 'Dengue · chikungunya · Zika', short: 'Dengue', sub: '<i>Aedes</i> × thermal envelope', ramp: EMBER, unit: 'Disease index, percentile among land cells',
    cap: 'Index 1 − (1 − S<sub>aeg</sub>·T<sub>aeg</sub>)(1 − S<sub>alb</sub>·T<sub>alb</sub>), with thermal envelopes from Mordecai et al. (2017) averaged over BIO10, BIO1 and BIO11.' },
  { id: 'wnv', group: 'Disease indices', name: 'West Nile', short: 'West Nile', sub: '<i>Culex</i> × thermal envelope', ramp: EMBER, unit: 'Disease index, percentile among land cells',
    cap: '<i>Culex</i> suitability × thermal envelope (16.0–24.5–33.0 °C, approximate, after Shocket et al. 2020; to be verified before use).' },
  { id: 'malaria', group: 'Disease indices', name: 'Malaria', short: 'Malaria', sub: '<i>Anopheles</i> × thermal envelope', ramp: EMBER, unit: 'Disease index, percentile among land cells',
    cap: '<i>Anopheles</i> suitability × thermal envelope (16–25–34 °C, Mordecai et al. 2013). The vector layer is genus-level; reports are Americas-heavy, partly offset by the GBIF genus pool on the region term. Treat Africa with caution.' },
  { id: 'support', group: 'Framework terms', name: 'Community support σ(h)', short: 'Support', sub: 'Where a mosquito community is observed', ramp: NIGHT, unit: 'Percentile among land cells',
    cap: 'Probability that a cell hosts a reported mosquito community, from climate and landscape with observer access held at the global mean.' },
];
const layer = id => LAYERS.find(l => l.id === id);

function swapImage(img, src) {
  if (img.getAttribute('src') === src) return;
  img.style.opacity = '0';
  const next = new Image();
  next.onload = () => { img.src = src; img.style.opacity = '1'; };
  next.src = src;
}
function wireHud(frame) {
  const img = frame.querySelector('img'), out = byId(frame.dataset.hud);
  frame.addEventListener('pointermove', e => {
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    const lat = 85 - fy * 145, lon = -180 + fx * 360;
    out.textContent = `LAT ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}  LON ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  });
  frame.addEventListener('pointerleave', () => { out.textContent = 'LAT —  LON —'; });
}
document.querySelectorAll('.globe-frame[data-hud]').forEach(wireHud);
function segGroup(id, attr, onPick) {
  const g = byId(id);
  g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset[attr]);
  });
}

function initHeroMap() {
  byId('hero-ramp').style.background = NIGHT;
  segGroup('hero-seg', 'layer', id => {
    const l = layer(id);
    swapImage(byId('globe-map'), `assets/hico/global_${id}.webp`);
    byId('hud-layer').innerHTML = `HiCo-Fuse 2 · ${l.group === 'Vectors' ? `<i>${l.short}</i>` : l.short} · 0.2°`;
    byId('hero-ramp').style.background = l.ramp;
  });
}

function initViewer() {
  let html = '', group = '';
  LAYERS.forEach((l, i) => {
    if (l.group !== group) { group = l.group; html += `<div class="layer-group">${group}</div>`; }
    html += `<button type="button" class="layer-btn" role="radio" aria-checked="${i === 0}" data-layer="${l.id}"><b>${l.name}</b><span>${l.sub}</span></button>`;
  });
  const list = byId('layer-list');
  list.innerHTML = html;
  const pick = id => {
    const l = layer(id);
    list.querySelectorAll('.layer-btn').forEach(b => b.setAttribute('aria-checked', String(b.dataset.layer === id)));
    swapImage(byId('viewer-map'), `assets/hico/global_${id}.webp`);
    byId('viewer-layer').innerHTML = `HiCo-Fuse 2 · ${l.name} · 0.2°`;
    byId('viewer-legend').innerHTML = `<span>Low</span><i style="background:${l.ramp}"></i><span>High · ${l.unit}</span>`;
    byId('viewer-cap').innerHTML = l.cap;
  };
  list.addEventListener('click', e => { const b = e.target.closest('.layer-btn'); if (b) pick(b.dataset.layer); });
  list.addEventListener('keydown', e => {
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!k) return;
    const btns = [...list.querySelectorAll('.layer-btn')], i = btns.findIndex(b => b.getAttribute('aria-checked') === 'true');
    const n = btns[(i + k + btns.length) % btns.length]; e.preventDefault(); n.focus(); pick(n.dataset.layer);
  });
  pick('albopictus');
}

/* ------------------------------------------------------------------ HiCo-Fuse framework */
const cv = m => B.hico.cv.find(r => r.model === m);
const ext = (ds, sub, model) => (B.hico.external.find(r => r.dataset === ds && r.subset === sub && r.model === model) || {}).AUC;
const cohRow = (model, cls) => B.hico.coherence.find(r => r.model === model && r.class === cls);

function renderHicoTelemetry() {
  const sep = cohRow('MLPEarly', 'Ae_albopictus'), H = B.hf2;
  const best = H.arms.find(a => a.id === 'HF2-shrink2+pool4') || H.arms.find(a => a.id === 'HF2-shrink2'), rf = H.arms.find(a => a.id === 'RF');
  const neon = H.external['NEON 2026 Ae. albopictus · 373 sites'];
  byId('hico-telemetry').innerHTML = [
    ['Cross-scale error', f3(H.coherence_max_abs_log, 4), 'Median log-error between each 0.5° region and the mean of its 100 child cells, HiCo-Fuse 2 global maps, all four vectors'],
    ['Without the hierarchy', `${pct(sep.share_parents_off_by_more_than_2x)} → 0`, 'Regions off by more than 2× when the coarse level is fitted separately (Ae. albopictus)'],
    ['Transfer splits won', `${best.auc_test.wins}/${best.auc_test.n}`, `Held-out splits where HiCo-Fuse 2 beats the random forest on ranking (AUC); ${best.nll_test.wins}/${best.nll_test.n} on log-loss. Not yet significant (p = ${f3(best.auc_test.p, 2)})`],
    ['Field traps', f3(neon, 2), 'AUC on NEON 2026 Ae. albopictus trap detections, 373 sites (earlier NEON years enter the GBIF pool at 5° resolution)'],
  ].map(([k, v, d]) => `<div role="listitem"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${esc(d)}</span></div>`).join('');
}

function archNodes() {
  const h = B.hico, e = B.external['HiCo x support (two-part)'];
  const tc = B.coherence.tests;
  const oa = B.oadsdm.find(r => r.model === 'OA-DSDM');
  const aeR2 = Math.max(...B.effort_r2.filter(r => r.predictors === 'AlphaEarth64').map(r => r.spatial_cv_R2));
  return [
    { col: 'Data', id: 'data', title: 'Observations', sub: `${formatNumber(h.meta.records_on_complete_cells)} reports · ${formatNumber(h.meta.report_cells)} cells`,
      q: 'What is observed, and where?', eq: 'P(class k | report at x) = softmax([η₁ … η₄, 0])ₖ',
      text: 'iNaturalist research-grade Culicidae reports are aggregated to 0.05° cells. The model learns the class mix of reports, so observer effort, which multiplies every class equally, cancels. Literature compendia and trap surveys are kept for validation and for the observation-aware module.',
      dl: [['Classes', '<i>Ae. albopictus</i>, <i>Ae. aegypti</i>, <i>Culex</i>, <i>Anopheles</i>, other Culicidae (reference)'], ['Held out', 'Kraemer compendium, NEON 2026 traps, Austrian surveys, AIMSurv ovitraps']],
      metrics: [[formatNumber(h.meta.records_on_complete_cells), 'reports'], [formatNumber(h.meta.report_cells), 'report cells'], [formatNumber(h.meta.parents_with_reports), '0.5° regions with reports']] },
    { col: 'Representation', id: 'repr', title: 'Multimodal features', sub: 'climate 26 · landscape 11 · human 4 · AlphaEarth 64',
      q: 'What does each place look like?', eq: 'x = [climate, landscape, human, AlphaEarth]  (standardised, no learned encoder)',
      text: 'Four modalities, kept as named blocks so each can be ablated. AlphaEarth satellite embeddings carry most of the signal alone, but they also encode human footprint, which is why reporting effort is modelled explicitly downstream. Learned encoders, sparse codes and newer self-supervised embeddings were tested here and in the representation lab; none beat the plain features under transfer, so the method uses none.',
      dl: [['Strongest alone', `AlphaEarth, mean AUC ${f3(cv('Single:AlphaEarth').AUC_mean)}`], ['Weakest alone', `Human footprint ${f3(cv('Single:Human').AUC_mean)}, climate ${f3(cv('Single:Climate').AUC_mean)}`]],
      metrics: [['105', 'features'], [f3(aeR2, 2), 'AlphaEarth → effort R²']] },
    { col: 'Niche', id: 'niche', title: 'Random-forest niche term', sub: 'B(x) on all 105 features', newbit: true,
      q: 'Where does the environment suit each vector?', eq: 'B_s(x) = log P_RF(s | x) − log P_RF(other | x)',
      text: 'A random forest over all four modalities is the local term. It replaced the neural local network and the gated modality experts: those matched early fusion in-sample but lost under transfer, and an independent project found the same for adaptive gates. Fusion happens inside the forest, which reads every modality at once.',
      dl: [['Why not gates', `Original HiCo ${B.hf2.arms.find(a => a.id === 'HiCo').auc_test.wins}/20 AUC wins vs the forest; the lab's environment gate failed 3 of 3 pre-declared tests`], ['Representation', 'Plain AlphaEarth 64-D; a PCA-16 compression ranks as well as learned sparse codes']],
      metrics: [[f3(B.hf2.arms.find(a => a.id === 'RF').AUC_loro), 'forest AUC, region out'], ['105', 'features']] },
    { col: 'Hierarchy', id: 'macro', title: 'Region term A(P)', sub: `forest map + species pool, ${B.hf2.n_params} numbers`, newbit: true,
      q: 'How much of each vector does the region hold?', eq: 'A_s(P) = α_s + γ_s M_s(P) + w_s · z(P)',
      text: 'M is the forest\'s own regional map, the mean of its children. z is a species-pool layer from sources the forest never sees: the Kraemer literature compendium and 2.55 million GBIF mosquito records up to 2021 (genus shares per 5° tile). It enters only here, at regional scale, because the main transfer error is which species have arrived in a region, not the local habitat relation.',
      dl: [['Fitted on', 'Spatially out-of-fold forest predictions (5° blocks), never on in-sample output'], ['Penalty', 'Ridge towards α = 0, γ = τ = 1, w = 0, where the model equals the forest exactly']],
      metrics: [[String(B.hf2.n_params), 'learned numbers'], [`${B.hf2.arms.find(a => a.id === 'HF2').auc_test.wins}/20`, 'AUC wins vs forest']] },
    { col: 'Hierarchy', id: 'micro', title: 'Coherent micro allocation', sub: 'softmax within parent P', newbit: true,
      q: 'Where inside the region?', eq: 'η_s(x) = A_s(P) + B_s(x) − log mean_{x′∈P} e^{B_s(x′)}',
      text: 'The local term only redistributes the region total among its children, so the mean of the children equals the parent exactly. A city layer can never exceed its region. The same rule can be applied after the fact to any trained model.',
      dl: [['Cross-scale error', `${f3(cohRow('HiCo', 'Ae_albopictus').median_abs_log_ratio, 4)} median log-ratio, 0% of regions off by 2×`], ['Under transfer', `Applied to a random forest: ${tc['RF+Recon'].wins}/${tc['RF+Recon'].n} AUC wins vs the forest (p = ${f3(tc['RF+Recon'].p, 2)}), so coherence is free`]],
      metrics: [['0%', 'regions off by 2×'], [`${pct(B.coherence.flip_min)}–${pct(B.coherence.flip_max)}`, 'class flips removed']] },
    { col: 'Trust', id: 'trust', title: 'Novelty trust', sub: 'fall back to the forest where novel', newbit: true,
      q: 'Is this region like anything seen in training?', eq: 'ρ(P) = min(ρ_env, ρ_pool),  ρ = clip(2 − d(P)/q₉₀, 0, 1)',
      text: 'Each 0.5° region gets a trust weight from its distance to the nearest training regions, in environment space and in species-pool space: full trust up to the novelty the head saw while being fitted, falling to the plain forest at twice that. The rule was fixed before testing, and it is constant within a region, so coherence stays exact.',
      dl: [['Region-out log-loss', `${f3(B.hf2.arms.find(a => a.id === 'HF2').nll_loro)} → ${f3(B.hf2.arms.find(a => a.id === 'HF2-shrink2').nll_loro)} (forest ${f3(B.hf2.arms.find(a => a.id === 'RF').nll_loro)})`], ['Rejected variant', 'Fitting the head on 20° blocks made it worse (logged as rejected)']],
      metrics: [['0', 'new fitted numbers'], [f3(B.hf2.arms.find(a => a.id === 'HF2-shrink2').AUC_zone), 'AUC, climate zone out']] },
    { col: 'Products', id: 'twopart', title: 'Two-part vector maps', sub: 'support × species share', newbit: true,
      q: 'Is there a mosquito community here at all?', eq: 'S_s(x) = σ(h(x)) · π_s(x)',
      text: 'Composition is undefined where no community is observed. A support term h, fitted with effort covariates and mapped with effort held at its mean, removes deserts and empty land that composition-only maps ranked highest.',
      dl: [['Kraemer <i>Ae. aegypti</i>', `${f3(ext('Kraemer Ae. aegypti', 'all', 'HiCo (composition only)'))} → ${f3(ext('Kraemer Ae. aegypti', 'all', 'HiCo x support (two-part)'))}`], ['NEON 2026', `${f3(ext('NEON 2026 Ae. albopictus', '373 sites', 'HiCo (composition only)'))} → ${f3(e['NEON 2026 Ae. albopictus · 373 sites'])}`]],
      metrics: [[f3(B.hico.support_cv[0]), 'support spatial-CV AUC'], [f3(e['Kraemer Ae. albopictus · >~110 km from iNat reports']), 'AUC >110 km away']] },
    { col: 'Products', id: 'disease', title: 'Disease layers', sub: '× thermal transmission envelope',
      q: 'Where could the vector transmit?', eq: 'D = 1 − Π_v (1 − S_v · T_v)',
      text: 'Each vector map is multiplied by a thermal performance envelope for its pathogen and combined across vectors. These are suitability indices, not incidence or risk forecasts.',
      dl: [['Dengue · chikungunya · Zika', '<i>Ae. aegypti</i> + <i>Ae. albopictus</i>, Mordecai et al. (2017)'], ['West Nile · malaria', '<i>Culex</i> (approximate limits) · <i>Anopheles</i>, Mordecai et al. (2013)']],
      metrics: [['3', 'disease indices']] },
    { col: 'Products', id: 'oa', title: 'Observation-aware module', sub: 'occupancy-detection + reporting-bias head',
      q: 'Where is it habitat, not just people reporting?', eq: 'reports: logit = η(x) + g(effort);  surveys: z ~ Bern(σ(η + α))',
      text: 'Reports and repeat-visit surveys share one latent suitability. Reports get a bias head on effort covariates; surveys use an occupancy-detection likelihood with visits and trap-hours. It recovers true suitability under confounding in simulation; real gains wait for surveys across the urban gradient.',
      dl: [['NEON 2026 AUC', `${f3(oa.NEON_OOF_AUC)} (OA-DSDM)`], ['Next endpoint', 'AIMSurv: 1,405 European ovitraps, mostly urban, with non-detections']],
      metrics: [[f3(oa.NEON_OOF_AUC), 'NEON AUC']] },
  ];
}

const eqHTML = s => esc(s).replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_([A-Za-z]+)/g, '<sub>$1</sub>').replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>');
function renderArchitecture() {
  const nodes = archNodes();
  const cols = [...new Set(nodes.map(n => n.col))];
  byId('arch-flow').innerHTML = cols.map(c => `<div class="arch-col"><span class="arch-k">${c}</span>${
    nodes.filter(n => n.col === c).map(n => `<button type="button" class="arch-node${n.newbit ? ' new' : ''}" role="tab" data-node="${n.id}" aria-selected="false">${n.newbit ? '<span class="arch-tag">HiCo-Fuse 2</span>' : ''}<b>${n.title}</b><span>${n.sub}</span></button>`).join('')
  }</div>`).join('');
  byId('arch-flow').insertAdjacentHTML('afterend', '<div class="arch-legend"><span><i class="n"></i>New in HiCo-Fuse 2</span><span><i></i>Standard component</span><span>Select any layer for its rule and evidence</span></div>');
  const show = id => {
    const n = nodes.find(x => x.id === id);
    document.querySelectorAll('.arch-node').forEach(b => b.setAttribute('aria-selected', String(b.dataset.node === id)));
    byId('arch-detail').innerHTML = `
      <div class="arch-left"><span class="q">${esc(n.col)} · ${esc(n.q)}</span><h3>${n.title}</h3><div class="eq">${eqHTML(n.eq)}</div><p>${n.text}</p></div>
      <div class="arch-left"><div class="metric-row">${n.metrics.map(([v, k]) => `<div class="metric"><b>${v}</b><span>${k}</span></div>`).join('')}</div>
      <dl>${n.dl.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`;
  };
  document.querySelector('.arch').addEventListener('click', e => { const b = e.target.closest('.arch-node'); if (b) show(b.dataset.node); });
  show('micro');
}

function hbars(el, rows, { min, max, fmt = v => f3(v), band = null, W = 560, L = 200 }) {
  const rowH = 26, T = 6, Hh = T + rows.length * rowH + 22, R = 50;
  const x = v => L + (Math.max(v, min) - min) / (max - min) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img">`;
  for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; s += `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${Hh - 20}"/><text x="${x(v)}" y="${Hh - 4}" text-anchor="middle" style="font-size:11px">${fmt(v)}</text>`; }
  if (band) s += `<rect x="${x(band[0])}" y="${T}" width="${x(band[1]) - x(band[0])}" height="${Hh - 26 - T + 6}" fill="${css('--nasa-blue')}" opacity=".08"/>`;
  rows.forEach((r, i) => {
    const y = T + i * rowH, w = Math.max(1.5, x(r.v) - L);
    s += `<text x="${L - 8}" y="${y + 16}" text-anchor="end"${r.bold ? ' style="font-weight:700;fill:var(--ink)"' : ''}>${r.label}</text>`;
    s += `<rect x="${L}" y="${y + 5}" width="${w}" height="${rowH - 10}" rx="4" fill="${r.color}"/>`;
    s += `<text class="val" x="${L + w + 6}" y="${y + 16}">${fmt(r.v)}</text>`;
    s += `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent" data-tip="${esc(r.tip || r.label)}: ${fmt(r.v)}"/>`;
  });
  el.innerHTML = `${s}</svg>`;
}

function renderCoherenceSection() {
  const CLS = [['Ae_albopictus', 'Ae. albopictus'], ['Ae_aegypti', 'Ae. aegypti'], ['Culex', 'Culex'], ['Anopheles', 'Anopheles']];
  const rows = CLS.flatMap(([c, n]) => [
    { label: `${n} · separate`, tip: `${n}, separately fitted coarse model`, v: cohRow('MLPEarly', c).share_parents_off_by_more_than_2x, color: css('--s2') },
    { label: `${n} · HiCo`, tip: `${n}, HiCo`, v: cohRow('HiCo', c).share_parents_off_by_more_than_2x, color: css('--s1'), bold: true },
  ]);
  hbars(byId('coh-chart'), rows, { min: 0, max: 1, fmt: v => pct(v), W: 520, L: 170 });
  const t = B.coherence.tests, arms = Object.fromEntries(B.coherence.arms.map(a => [a.id, a]));
  const item = (label, test, note) => `<div class="cost-row"><b>${label}</b><span class="chip ${test.p < 0.05 && test.mean_diff < 0 ? 'rejected' : test.wins >= test.n * 0.4 ? 'kept' : 'mixed'}">${test.wins}/${test.n} wins · p = ${f3(test.p, test.p < 0.01 ? 4 : 2)}</span><small>${note}</small></div>`;
  byId('coh-cost').innerHTML =
    item('Coherent random forest (HiCo rule on RF)', t['RF+Recon'], `Mean AUC change ${sgn(t['RF+Recon'].mean_diff)}; region-out AUC ${f3(arms['RF+Recon'].AUC_loro)} vs ${f3(arms.RF.AUC_loro)}. Coherence costs nothing.`) +
    item('HiCo with random-forest local term', t['HiCo-RF'], `Best of all arms on 10° blocks (${f3(arms['HiCo-RF'].AUC_block10)}); weaker when a whole region is held out.`) +
    item('HiCo with neural terms (original)', t.HiCo, `Mean AUC change ${sgn(t.HiCo.mean_diff)}: the learned neural terms, not the hierarchy, cost accuracy under transfer.`);
  const ZN = { florida: 'Miami metro', seasia: 'Singapore and Johor Bahru', italy: 'Rome' };
  const setZoom = z => {
    ['coarse', 'fine', 'city'].forEach(k => swapImage(byId(`z-${k}`), `assets/hico/zoom_${z}_${k}.webp`));
    byId('z-city-name').textContent = ZN[z];
    byId('zoom-parents').textContent = `${B.hico.zoom_parents[z]} regions in view · each parent = mean of its children`;
  };
  segGroup('zoom-seg', 'zoom', setZoom);
  setZoom('florida');
}

function renderExternal() {
  byId('support-auc').textContent = f3(B.hico.support_cv[0]);
  const tests = [
    ['Kraemer Ae. aegypti', 'all', 'Kraemer <i>Ae. aegypti</i> · all cells'],
    ['Kraemer Ae. aegypti', '>~110 km from iNat reports', 'Kraemer <i>Ae. aegypti</i> · >110 km'],
    ['Kraemer Ae. albopictus', 'all', 'Kraemer <i>Ae. albopictus</i> · all cells'],
    ['Kraemer Ae. albopictus', '>~110 km from iNat reports', 'Kraemer <i>Ae. albopictus</i> · >110 km'],
    ['NEON 2026 Ae. albopictus', '373 sites', 'NEON 2026 traps · 373 sites'],
  ];
  const models = [['MLPEarly', css('--s3'), 'MLP'], ['HiCo', css('--s1'), 'HiCo']];
  const W = 760, L = 230, R = 30, rowH = 44, T = 10, Hh = T + tests.length * rowH + 26;
  const lo = 0.3, hi = 1.0, x = v => L + (v - lo) / (hi - lo) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="External validation AUC, composition only versus two-part maps">`;
  [0.3, 0.5, 0.7, 0.9, 1.0].forEach(v => { s += `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${Hh - 22}"/><text x="${x(v)}" y="${Hh - 6}" text-anchor="middle" style="font-size:11px">${v.toFixed(1)}</text>`; });
  s += `<line class="ref" x1="${x(0.5)}" x2="${x(0.5)}" y1="${T}" y2="${Hh - 22}"/>`;
  tests.forEach(([ds, sub, label], i) => {
    const yc = T + i * rowH + rowH / 2;
    s += `<text x="${L - 12}" y="${yc + 4}" text-anchor="end">${label.replace(/<\/?i>/g, '')}</text>`;
    models.forEach(([m, col, nm], j) => {
      const y = yc + (j ? 8 : -8);
      const a = ext(ds, sub, `${m} (composition only)`), b = ext(ds, sub, `${m} x support (two-part)`);
      if (a === undefined || b === undefined) return;
      s += `<line x1="${x(a)}" x2="${x(b)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2.5" opacity=".55"/>`;
      s += `<circle cx="${x(a)}" cy="${y}" r="5.5" fill="${css('--surface')}" stroke="${col}" stroke-width="2" data-tip="${nm} composition only · ${label.replace(/<\/?i>/g, '')}: ${f3(a)}"/>`;
      s += `<circle cx="${x(b)}" cy="${y}" r="6.5" fill="${col}" stroke="${css('--surface')}" stroke-width="2" data-tip="${nm} two-part · ${label.replace(/<\/?i>/g, '')}: ${f3(b)}"/>`;
      if (j === 1 || i === 0) s += `<text class="val" x="${x(b) + 10}" y="${y + 4}" style="font-size:11px">${f3(b)}</text>`;
    });
  });
  s += `<text class="reft" x="${x(0.5)}" y="${T - 1}" text-anchor="middle" dy="-2"> </text></svg>`;
  byId('ext-chart').innerHTML = s;
}

function renderCV() {
  const LBL = { MLPEarly: 'MLP early fusion', 'Single:AlphaEarth': 'AlphaEarth only', LinearEarly: 'Linear early fusion', GatedMoE: 'Gated modality experts', LateRankEnsemble: 'Late rank ensemble',
    'Single:Landscape': 'Landscape only', 'Single:Climate': 'Climate only', 'Single:Human': 'Human footprint only', HiCo: 'HiCo (pooled macro)', HiCoMoE: 'HiCo + gated experts',
    'HiCo-climA': 'HiCo (climate macro)', 'HiCoMoE-climA': 'HiCo + gates (climate macro)' };
  const col = m => m.startsWith('Single') ? css('--s4') : m.startsWith('HiCo') ? css('--s1') : css('--s3');
  const rows = [...B.hico.cv].sort((a, b) => b.AUC_mean - a.AUC_mean).map(r => ({ label: LBL[r.model] || r.model, v: r.AUC_mean, color: col(r.model), bold: r.model.startsWith('HiCo') }));
  const best = rows[0].v;
  hbars(byId('cv-chart'), rows, { min: 0.55, max: 0.75, band: [best - 0.02, best], W: 600, L: 210 });
  byId('hico-cost').textContent = f3(cv('MLPEarly').AUC_mean - cv('HiCo').AUC_mean, 3);
}

function renderGates() {
  const MODS = [['Climate anomaly', '#3987e5'], ['Landscape', '#d95926'], ['Human footprint', '#199e70'], ['AlphaEarth', '#c98500']];
  const draw = g => {
    swapImage(byId('gate-img'), `assets/hico/gates_${g}.webp`);
    const sh = B.hico.gate_dominant_share[g];
    byId('gate-legend').innerHTML = MODS.map(([n, c], i) => `<div style="--c:${c}"><b>${n}</b><span class="bar"><i style="width:${(sh[i] * 100).toFixed(1)}%"></i></span>${pct(sh[i])} of land cells dominant</div>`).join('');
  };
  segGroup('gate-seg', 'gate', draw);
  draw('albopictus');
}

function renderExtensions() {
  const mr = B.hico.multires, step = B.hico.step1, q1 = B.hico.q1;
  const ARM = { MLPEarly: "MLP, iNaturalist only", "MLPEarly+Kfine": "MLP + Kraemer as fine presences", HiCo: "HiCo, iNaturalist only", "HiCo+Kcoarse": "HiCo + Kraemer on the macro term" };
  const mrRows = mr.map(r => `<tr><td class="wrap">${esc(ARM[r.arm] || r.arm)}</td><td class="num">${f3(r.AUC_Ae_albopictus)}</td><td class="num">${f3(r.trop_AUC_Ae_albopictus)}</td></tr>`).join('');
  const qRows = q1.filter(r => r.predictors === 'AlphaEarth64').map(r => `<tr><td class="wrap">${esc(r.effort_covariate.replace(/_/g, ' '))}</td><td class="num">${f3(r.spatial_cv_R2, 2)}</td></tr>`).join('');
  const oaRows = B.oadsdm.slice(0, 6).map(r => `<tr><td class="wrap">${esc(r.model)}</td><td class="num">${f3(r.NEON_OOF_AUC)}</td></tr>`).join('');
  const cards = [
    ['Multi-resolution evidence', 'mixed', 'The Kraemer compendium is coarse and older than citizen science. Pooling it as fine presences, or entering it at 0.5° on the macro term only?',
      'Pooling as fine presences hurts <i>Ae. albopictus</i>, most in the tropics; macro-only entry is roughly neutral. The endpoint, report composition, is barely informed by range data.',
      `<table><thead><tr><th>Training evidence</th><th class="num">AUC alb.</th><th class="num">Tropics</th></tr></thead><tbody>${mrRows}</tbody></table>`],
    ['Observation-aware likelihood', 'mixed', 'Does modelling where people report separate habitat from effort?',
      'Recovers true suitability under strong confounding in simulation (ρ 0.40 → 0.80). On real data gains are within noise: NEON sites lie outside the urban gradient where bias acts.',
      `<table><thead><tr><th>AlphaEarth predicts</th><th class="num">R²</th></tr></thead><tbody>${qRows}</tbody></table><table><thead><tr><th>Model</th><th class="num">NEON AUC</th></tr></thead><tbody>${oaRows}</tbody></table>`],
    ['Vision-language concepts', 'rejected', 'RemoteCLIP scored Sentinel-2 chips of 2,202 cells against 23 habitat prompts. Do named concepts add predictive value?',
      'Concepts alone reach 0.70–0.80 AUC for <i>Aedes</i> but add at most +0.002 once AlphaEarth is present. Value: an interpretable vocabulary (dense urban, tyre dumps) and a case for finer imagery.',
      '<table><thead><tr><th>Vector</th><th class="num">AlphaEarth</th><th class="num">Concepts</th><th class="num">Both</th></tr></thead><tbody><tr><td><i>Ae. albopictus</i></td><td class="num">0.821</td><td class="num">0.696</td><td class="num">0.823</td></tr><tr><td><i>Ae. aegypti</i></td><td class="num">0.919</td><td class="num">0.797</td><td class="num">0.921</td></tr><tr><td><i>Culex</i></td><td class="num">0.595</td><td class="num">0.490</td><td class="num">0.587</td></tr><tr><td><i>Anopheles</i></td><td class="num">0.746</td><td class="num">0.674</td><td class="num">0.742</td></tr></tbody></table>'],
  ];
  const lab = { mixed: 'Inconclusive', rejected: 'No gain' };
  byId('ext-grid').innerHTML = cards.map(([t, st, q, v, tb]) => `<article class="card ext"><header><h3>${t}</h3><span class="chip ${st}">${lab[st]}</span></header><p>${q}</p><div class="verdict">${v}</div><details><summary>Show the numbers</summary><div class="table-wrap">${tb}</div></details></article>`).join('');
}

/* ------------------------------------------------------------------ HiCo-Fuse 2 */
const HF2_ARMS = [['HiCo', '--s2', 'HiCo, original'], ['RF', '--ink-3', 'Random forest'], ['HF2', '--s4', 'HiCo-Fuse 2'],
  ['HF2-shrink2', '--s1', 'HiCo-Fuse 2 + trust'], ['HF2-shrink2+pool4', '--s3', '+ all-genus pool']];
function hf2Arms() { const have = new Set(B.hf2.arms.map(a => a.id)); return HF2_ARMS.filter(([id]) => have.has(id)); }
function dotRows(el, rows, arms, { lo, hi, ticks, fmt, label }) {
  const W = 640, L = 150, R = 24, rowH = 40, T = 8, Hh = T + rows.length * rowH + 24;
  const x = v => L + (v - lo) / (hi - lo) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(label)}">`;
  ticks.forEach(v => { s += `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${Hh - 22}"/><text x="${x(v)}" y="${Hh - 6}" text-anchor="middle" style="font-size:11px">${fmt(v)}</text>`; });
  rows.forEach((r, i) => {
    const yc = T + i * rowH + rowH / 2;
    s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${yc}" y2="${yc}"/>`;
    s += `<text x="${L - 10}" y="${yc + 4}" text-anchor="end">${esc(r.label)}</text>`;
    arms.forEach(([id, col, nm], j) => {
      const v = r.v[id]; if (v === undefined || v === null) return;
      const big = id.startsWith('HF2-shrink2');
      s += `<circle cx="${x(Math.min(hi, Math.max(lo, v)))}" cy="${yc + (j - (arms.length - 1) / 2) * 3}" r="${big ? 7 : 5.5}" fill="${css(col)}" stroke="${css('--surface')}" stroke-width="2" data-tip="${esc(nm)} · ${esc(r.label)}: ${fmt(v)}"/>`;
    });
  });
  el.innerHTML = `${s}</svg>`;
}
function renderHF2() {
  const H = B.hf2, arms = hf2Arms(), by = Object.fromEntries(H.arms.map(a => [a.id, a]));
  const legend = arms.map(([, c, n]) => `<span><i style="background:var(${c})"></i>${n}</span>`).join('');
  byId('hf2-legend').innerHTML = legend; byId('hf2-loro-legend').innerHTML = legend;
  const D = [['block10', '10° blocks'], ['env', 'Climate cluster out'], ['loro', 'World region out'], ['zone', 'Climate zone out']];
  const draw = m => dotRows(byId('hf2-chart'), D.map(([d, l]) => ({ label: l, v: Object.fromEntries(arms.map(([id]) => [id, by[id][`${m}_${d}`]])) })), arms,
    m === 'AUC' ? { lo: 0.62, hi: 0.78, ticks: [0.62, 0.66, 0.70, 0.74, 0.78], fmt: v => f3(v), label: 'Mean held-out AUC by design' }
      : { lo: 0.85, hi: 1.5, ticks: [0.9, 1.1, 1.3, 1.5], fmt: v => f3(v, 2), label: 'Mean held-out log-loss by design' });
  segGroup('hf2-metric', 'm', draw); draw('AUC');
  const best = by['HF2-shrink2+pool4'] ? 'HF2-shrink2+pool4' : 'HF2-shrink2', b = by[best], h = by.HiCo;
  const chip = t => t.p < 0.05 && t.mean_diff < 0 ? 'rejected' : t.wins >= t.n * 0.6 ? 'kept' : 'mixed';
  const item = (label, t, note) => `<div class="cost-row"><b>${label}</b><span class="chip ${chip(t)}">${t.wins}/${t.n} wins vs forest · p = ${f3(t.p, t.p < 0.01 ? 4 : 2)}</span><small>${note}</small></div>`;
  byId('hf2-tests').innerHTML =
    item('Original HiCo · AUC', h.auc_test, `Mean ${sgn(h.auc_test.mean_diff)}: its neural terms lose under transfer.`) +
    item('HiCo-Fuse 2 · AUC', b.auc_test, `Mean ${sgn(b.auc_test.mean_diff)}; best or tied-best AUC on every design, still exactly coherent.`) +
    item('HiCo-Fuse 2 · log-loss', b.nll_test, 'Better than the forest on blocks, clusters and zones; worse when a whole world region is held out.') +
    `<p class="note">Fitted region term: γ for <i>Ae. albopictus</i> / <i>Ae. aegypti</i> / <i>Culex</i> / <i>Anopheles</i> = ${H.gamma_mean.map(v => f3(v, 2)).join(' / ')}. Values above 1 sharpen the regional signal. That helps ranking but makes probabilities overconfident in unseen regions; the trust rule pulls them back where a region's environment or species pool is novel.</p>`;
  const regs = H.loro_nll.map(r => ({ label: r.region, v: Object.fromEntries(arms.map(([id]) => [id, r[id]])) }));
  dotRows(byId('hf2-loro'), regs, arms, { lo: 1.0, hi: 2.0, ticks: [1.0, 1.25, 1.5, 1.75, 2.0], fmt: v => f3(v, 2), label: 'Log-loss with each region held out' });
  const af = H.loro_nll.find(r => r.region === 'Africa'), na = H.loro_nll.find(r => r.region === 'N America');
  byId('hf2-loro-note').innerHTML = `The trust rule nearly closes the gap for North America (${f3(na.HF2, 2)} → ${f3(na['HF2-shrink2'], 2)}; forest ${f3(na.RF, 2)}). Africa (75 test cells) is not flagged as novel by climate or by the <i>Aedes</i> pool, yet has the largest error: its reports are dominated by <i>Anopheles</i> and <i>Culex</i>, which the first pool layer did not describe.${af['HF2-shrink2+pool4'] !== undefined ? ` With the all-genus pool, Africa: ${f3(af['HF2-shrink2+pool4'], 2)}.` : ''}`;
}

/* ------------------------------------------------------------------ representation lab */
function renderLab() {
  const L = B.lab, lab = { kept: 'Used in the method', rejected: 'Ruled out', proposed: 'Next step', mixed: 'Inconclusive' };
  byId('lab-task').textContent = `The Habitat Representation Lab is a separate project on the same question: ${L.task}; ${L.fits}. Its results are independent checks on our representation and fusion choices; each is listed with what it changes in HiCo-Fuse 2.`;
  byId('lab-grid').innerHTML = L.findings.map(f => `<article class="card ext"><header><span class="arch-k">${esc(f.component)}</span><span class="chip ${f.verdict}">${lab[f.verdict]}</span></header><h3>${esc(f.title)}</h3><p class="lab-num">${esc(f.result)}</p><div class="verdict">${esc(f.use)}</div></article>`).join('');
  byId('lab-skip').innerHTML = L.not_featured.map(t => `<li>${esc(t)}</li>`).join('');
  byId('lab-next').innerHTML = L.next.map(t => `<li>${esc(t)}</li>`).join('');
}

/* ------------------------------------------------------------------ methods page */
function renderMethods() {
  const m = B.hico.meta;
  byId('data-stats').innerHTML = [
    [formatNumber(m.records_on_complete_cells), 'Reports', 'iNaturalist research-grade Culicidae, 2022–2025'],
    [formatNumber(m.report_cells), 'Report cells at 0.05°', `${formatNumber(m.parents_with_reports)} parent regions at 0.5°`],
    [String(m.cv_blocks), 'Spatial CV blocks', '10° blocks, 5 folds × 2 seeds'],
    [`${formatNumber(m.kraemer_cells.albopictus + m.kraemer_cells.aegypti)}`, 'External compendium cells', 'Kraemer et al. (2015), never used for fitting'],
  ].map(([v, k, d]) => `<article class="stat-card"><strong>${v}</strong><span>${k}</span><small>${d}</small></article>`).join('');
  const names = { Ae_albopictus: 'Ae. albopictus', Ae_aegypti: 'Ae. aegypti', Culex: 'Culex', Anopheles: 'Anopheles', other: 'Other Culicidae' };
  const rows = Object.entries(m.class_cells).map(([k, v]) => ({ label: names[k], v, color: k === 'other' ? css('--ink-3') : css('--s1'), tip: `${names[k]} · ${formatNumber(m.class_records[k])} reports` }));
  hbars(byId('class-chart'), rows, { min: 0, max: Math.ceil(Math.max(...rows.map(r => r.v)) / 1000) * 1000, fmt: v => formatNumber(Math.round(v)), W: 520, L: 130 });
  const rf = B.holdout.AUC.RF;
  byId('design-grid').innerHTML = B.designs.map(d => `<article class="design${d.id === 'random5' ? ' ref' : ''}"><b>${esc(d.label)}</b><p>${esc(d.desc)}</p><span class="rf">Random forest AUC ${f3(rf[d.id])}</span></article>`).join('');
  const TERMS = [
    ['AUC', 'Area under the ROC curve: the chance that a random positive cell is ranked above a random negative one. 0.5 is chance.'],
    ['Log-loss', 'Average negative log-probability of what was observed. Lower is better; it rewards calibrated probabilities, not just ranking.'],
    ['Coherence', 'Every regional value equals the mean of its local cells, so maps at different scales never contradict each other.'],
    ['Macro / micro term', 'In HiCo, the macro term sets a 0.5° region\'s total; the micro term only decides where inside the region it goes.'],
    ['Two-part map', 'Community support (is any mosquito community observed here?) times species share (which species is it?).'],
    ['Gated experts', 'One expert per modality; a learned gate weights them cell by cell and shows which one drives the prediction.'],
    ['Leave region out', 'Train on five world regions and test on the sixth: the main test of transfer to places the model has not seen.'],
    ['Class prior shift', 'The species mix differs between regions. A model can know the habitat and still be wrong about which species has arrived.'],
    ['Intensity-space ensemble', 'Averaging seeds as mean of e^η rather than mean of η, which keeps the hierarchy exactly additive.'],
  ];
  byId('terms-list').innerHTML = TERMS.map(([t, d]) => `<div><dt>${t}</dt><dd>${esc(d)}</dd></div>`).join('');
}

/* ------------------------------------------------------------------ evidence foundation panel */
function renderFoundation() {
  const rows = [...B.foundation].sort((a, b) => b.AP - a.AP).map(r => [esc(`${r.representation.replace(/_/g, ' + ')} · ${r.learner}`), f3(r.AP), f3(r.AP_sd), f3(r.AUC)]);
  byId('panel-foundation').innerHTML = `
    <h3>Representation and fusion benchmark · <i>Ae. albopictus</i> presence vs target-group background</h3>
    <p class="lead">Stage 1 of the project: which representation and learner rank 1,601 presence and background sites best across six spatial folds. It motivated AlphaEarth as the main representation and early fusion as the default.</p>
    ${table(['Representation · learner', 'AP mean', 'Fold SD', 'ROC-AUC'], rows, { best: bestCells(rows, [1, 3]) })}
    <p class="note">Fold SD describes variation across six spatial contexts; it is not a confidence interval. Background records are not confirmed absences.</p>`;
}
/* ------------------------------------------------------------------ headline numbers */
function H() {
  const auc = B.holdout.AUC, nll = B.holdout.nll, ps = B.prior_shift.rows.find(r => r.model === 'Random forest');
  const stack = B.weighting.find(w => w.id === 'Stack-global');
  const recon = B.coherence.tests['RF+Recon'];
  const aeEffort = Math.max(...B.effort_r2.filter(r => r.predictors === 'AlphaEarth64').map(r => r.spatial_cv_R2));
  return { auc, nll, ps, stack, recon, aeEffort };
}

function renderTelemetry() {
  const h = H();
  byId('telemetry').innerHTML = [
    ['Transfer penalty', `−${f3(B.optimism.RF, 2)}`, `AUC the random forest loses when a whole region is held out (geographic interpolation: −${f3(B.optimism['kNN-geo'], 2)})`],
    ['Species-pool shift', `${f3(h.ps.none, 2)} → ${f3(h.ps.oracle, 2)}`, 'Forest log-loss on new regions once given the true regional class mix'],
    ['Cross-scale contradiction', `${pct(B.coherence.flip_min)}–${pct(B.coherence.flip_max)} → 0`, 'Dominant-class flips between separate coarse and fine maps, removed by reconciliation'],
    ['Benchmark scale', `${B.holdout.n_splits} splits`, `${B.holdout.models.length} models × ${B.designs.length} holdout designs, plus 5 redesign iterations`],
  ].map(([k, v, d]) => `<div role="listitem"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${esc(d)}</span></div>`).join('');
}

/* ------------------------------------------------------------------ model families */
function renderFamilies() {
  const f = B.foundation.reduce((a, b) => (b.AP > a.AP ? b : a));
  const oa = B.oadsdm.find(r => r.model === 'OA-DSDM'), pbg = B.oadsdm.find(r => r.model === 'PB-GLM-sklearn');
  const hico = B.hico_cv.find(r => r.model === 'HiCo'), mlp = B.hico_cv.find(r => r.model === 'MLPEarly');
  const ext = B.external['HiCo x support (two-part)']['Kraemer Ae. albopictus · all'];
  const rf = B.holdout.AUC.RF;
  const fam = [
    ['Stage 1', 'Foundation fusion benchmark', '<i>Ae. albopictus</i> presence vs target-group background · 1,601 sites',
      'GLM, MaxNet, BRT, RF, MLP over BioClim19, Environment41, AlphaEarth64, early and late fusion', '6 frozen spatial folds',
      `${f3(f.AP)}`, `best AP: ${esc(f.representation.replace(/_/g, ' + '))} · ${esc(f.learner)}`, 'scripts/'],
    ['Stage 2', 'Observation-aware SDM', 'Shared suitability with separate report and survey processes',
      'PB, Pooled, SurveyOnly, ISDM, OA-DSDM (effort-bias head), linear and neural', 'Frozen protocol · NEON 2026 and Austrian surveys',
      `${f3(oa.NEON_OOF_AUC)}`, `NEON 2026 AUC for OA-DSDM vs ${f3(pbg.NEON_OOF_AUC)} for the GLM baseline`, 'oadsdm/'],
    ['Stage 3', 'HiCo-Fuse composition', 'Five Culicidae classes per 0.05° cell · 105 features',
      'Early fusion, gated mixture of experts, HiCo coarse-to-fine hierarchy, two-part support model, VLM probes', '10° spatial blocks · external Kraemer and NEON checks',
      `${f3(ext)}`, `Kraemer <i>Ae. albopictus</i> AUC, HiCo two-part (block-CV mean AUC ${f3(hico.AUC_mean)} vs MLP ${f3(mlp.AUC_mean)})`, 'hicofuse/'],
    ['Stage 4 · current', 'Recursive research loop', 'Same composition task, diagnosed under transfer',
      '9 baselines, 8 weighting schemes, invariance, support-decay fusion, species pool, coherence reconciliation', '9 holdout designs · paired sign tests',
      `${f3(rf.loro)}`, `random-forest AUC when a whole region is held out (random split ${f3(rf.random5)})`, 'rsi/'],
  ];
  byId('families-grid').innerHTML = fam.map(([stage, title, task, models, val, big, small, code], i) => `
    <article class="card family${i === 3 ? ' current' : ''}">
      <span class="stage">${stage}</span><h3>${title}</h3>
      <dl><div><dt>Task</dt><dd>${task}</dd></div><div><dt>Models</dt><dd>${models}</dd></div><div><dt>Validation</dt><dd>${val}</dd></div></dl>
      <div class="headline"><b>${big}</b>${small}</div>
      <code>${code}</code>
    </article>`).join('');
}

/* ------------------------------------------------------------------ fusion methods */
function renderFusion() {
  const h = H(), auc = B.holdout.AUC, w = id => B.weighting.find(x => x.id === id);
  const found = (rep, l) => B.foundation.find(r => r.representation === rep && r.learner === l);
  const inv = B.invariance, dt = B.decay_tests;
  const pool = (m, f) => B.pool.find(r => r.model === m && r.features === f);
  const methods = [
    ['Early concatenation', 'kept', 'η = f([x_climate, x_landscape, x_human, x_AlphaEarth])',
      'All modalities enter one learner. Simple, and the strongest neural fusion in every family.',
      `Foundation MLP AP <b>${f3(found('Environment_AlphaEarth105', 'MLP').AP)}</b> vs AlphaEarth alone ${f3(found('AlphaEarth64', 'MLP').AP)}; composition MLP region-out AUC <b>${f3(auc.MLP.loro)}</b>.`],
    ['Nonlinear late fusion', 'rejected', 'η = g( f_env(x_env), f_AE(x_AE) ),  g fit on spatial OOF scores',
      'Separate experts per modality combined by a meta-network.',
      `AP <b>${f3(found('Nonlinear_late_fusion', 'MLP').AP)}</b>, below early fusion, with the largest fold spread.`],
    ['Gated mixture of experts', 'rejected', 'η_s = Σ_m g_sm(context) · u_sm(enc_m(x_m))',
      'Per-class gates choose which modality to trust where.',
      `Region-out AUC <b>${f3(auc.GatedMoE.loro)}</b> vs random forest ${f3(auc.RF.loro)}; Europe hold-out near chance.`],
    ['HiCo hierarchical normalisation', 'kept', 'η_s(x) = A_s(P) + B_s(x) − log mean_{x′∈P} exp B_s(x′)',
      'A coarse 0.5° term and a fine local term; every parent equals the mean of its children, so city maps never contradict country maps.',
      `Kept as a <b>constraint</b>. As a learner, HiCo beats the forest in only ${B.coherence.tests.HiCo.wins}/${B.coherence.tests.HiCo.n} splits.`],
    ['Log-linear pooling, 8 weighting schemes', 'rejected', 'log p(y|x) ∝ Σ_m w_m(x) · log p_m(y|x)',
      'Equal, theory-fixed, stacked, regional, attention, inverse-variance and reliability weights over four modality experts plus kNN.',
      `Learned stacking: <b>${sgn(h.stack.inner_gain, 2)}</b> log-loss on training folds, <b>${sgn(h.stack.outer_gain, 2)}</b> on new regions. Only local reliability helped (${sgn(w('Reliability').outer_gain, 3)}).`],
    ['Invariance penalties', 'rejected', 'min Σ_e R_e + λ · Var_e(R_e)   (V-REx; or group-DRO)',
      'Penalise risk differences between training regions to find stable relations.',
      `Region-out AUC: ERM <b>${f3(inv.ERM.loro)}</b>, V-REx ${f3(inv['V-REx l=1'].loro)}, group-DRO ${f3(inv.GroupDRO.loro)}. Shift is in p(y), not p(y|x).`],
    ['Support-decay fusion', 'mixed', 'w_Geo(x) = w·exp(−d(x)/ρ);  w_m(x) = w_m·exp(−β_m·novelty(x))',
      'Monotone constraint: trust spatial interpolation only within a learned range, and fade covariate experts toward the prior when environments are novel.',
      `Beats a free attention gate in <b>${dt.vs_gate.wins}/${dt.vs_gate.n}</b> splits (p = ${f3(dt.vs_gate.p)}); ties equal pooling (${dt.vs_equal.wins}/${dt.vs_equal.n}). Learned ρ ≈ ${formatNumber(B.rho_km.mixed)} km.`],
    ['Species-pool covariates', 'mixed', 'x′ = [x, log1p #records within 100 / 500 km (Kraemer)]',
      'An exogenous signal of which species have arrived nearby, from literature records never used as labels.',
      `MLP region-out AUC <b>${f3(pool('MLP', 'base').loro)} → ${f3(pool('MLP', '+pool').loro)}</b>; covers only two of five classes.`],
    ['Post-hoc coherence reconciliation', 'kept', 'η_s(x) = A_RF,coarse(P) + B_RF(x) − log mean_P exp B_RF',
      'Apply HiCo’s rule to any trained model, here the random forest.',
      `Same accuracy as the forest (<b>${h.recon.wins}/${h.recon.n}</b>, p = ${f3(h.recon.p, 2)}); dominant-class flips <b>${pct(B.coherence.flip_min)}–${pct(B.coherence.flip_max)} → 0</b>.`],
    ['Observation-aware joint likelihood', 'mixed', 'reports: logit = η(x) + g(effort);  surveys: z ~ Bern(σ(η + α_s)), detection p(effort)',
      'Fuses opportunistic reports and repeat-visit surveys through one shared suitability, with an explicit effort-bias head.',
      `NEON 2026 AUC <b>${f3(B.oadsdm.find(r => r.model === 'OA-DSDM').NEON_OOF_AUC)}</b>; AlphaEarth predicts human footprint with R² up to ${f3(h.aeEffort, 2)}.`],
  ];
  const label = { kept: 'Kept', rejected: 'Rejected', mixed: 'Inconclusive' };
  byId('fusion-grid').innerHTML = methods.map(([title, status, eq, desc, result], i) => `
    <article class="card fusion" data-status="${status}">
      <header><div><span class="num">F${String(i + 1).padStart(2, '0')}</span><h3>${title}</h3></div><span class="chip ${status}">${label[status]}</span></header>
      <div class="eq">${esc(eq)}</div>
      <p>${desc}</p>
      <div class="result">${result}</div>
    </article>`).join('');
  document.querySelectorAll('#fusion .filter-row button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('#fusion .filter-row button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    document.querySelectorAll('.fusion').forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.status !== button.dataset.filter; });
  }));
}

/* ------------------------------------------------------------------ benchmark explorer */
function initBenchmark() {
  byId('design-chips').innerHTML = B.designs.map(d => `<button type="button" data-design="${d.id}" aria-pressed="${d.id === state.design}" data-tip="${esc(d.desc)}">${esc(d.label)}</button>`).join('');
  byId('design-chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.design = b.dataset.design; renderBenchmark();
  });
  byId('metric-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.metric = b.dataset.metric; renderBenchmark();
  });
  renderBenchmark();
}

function renderBenchmark() {
  document.querySelectorAll('#design-chips button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.design === state.design)));
  document.querySelectorAll('#metric-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.metric === state.metric)));
  const M = B.holdout[state.metric], hi = state.metric === 'AUC';
  const d = B.designs.find(x => x.id === state.design);
  byId('bar-title').textContent = `${d.label} · ${hi ? 'mean per-class AUC' : 'log-loss'}`;
  byId('bar-desc').textContent = d.desc;

  // dot chart (no zero-baseline distortion), Prior drawn as a reference line
  const models = B.holdout.models.filter(m => m.id !== 'Prior');
  const rows = models.map(m => ({ ...m, v: M[m.id][state.design] })).filter(r => r.v !== null)
    .sort((a, b) => hi ? b.v - a.v : a.v - b.v);
  const ref = hi ? 0.5 : M.Prior[state.design];
  const vals = rows.map(r => r.v).concat(ref);
  const lo = Math.min(...vals), up = Math.max(...vals), pad = (up - lo) * 0.12 || 0.02;
  const W = 430, L = 150, R = 48, T = 12, rowH = 30, Hh = T + rows.length * rowH + 30;
  const x = v => L + (v - (lo - pad)) / ((up + pad) - (lo - pad)) * (W - L - R);
  const best = rows[0].id;
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(d.label)} ${hi ? 'AUC' : 'log-loss'} by model">`;
  rows.forEach((r, i) => {
    const y = T + i * rowH + rowH / 2;
    s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
    s += `<text x="${L - 10}" y="${y + 4}" text-anchor="end"${r.id === best ? ' style="font-weight:700;fill:var(--ink)"' : ''}>${esc(r.label)}</text>`;
    s += `<line x1="${x(lo - pad)}" x2="${x(r.v)}" y1="${y}" y2="${y}" stroke="${css('--s1')}" stroke-width="2" opacity=".35"/>`;
    s += `<circle cx="${x(r.v)}" cy="${y}" r="7" fill="${r.id === best ? css('--nasa-blue') : css('--s1')}" stroke="${css('--surface')}" stroke-width="2" data-tip="${esc(r.label)} · ${d.label}: ${f3(r.v)}"/>`;
    s += `<rect x="${L}" y="${y - rowH / 2}" width="${W - L - R}" height="${rowH}" fill="transparent" data-tip="${esc(r.label)} · ${d.label}: ${f3(r.v)}"/>`;
    s += `<text class="val" x="${W - R + 8}" y="${y + 4}">${f3(r.v)}</text>`;
  });
  const yb = T + rows.length * rowH;
  s += `<line class="ref" x1="${x(ref)}" x2="${x(ref)}" y1="${T - 4}" y2="${yb}"/>`;
  s += `<text class="reft" x="${x(ref)}" y="${yb + 18}" text-anchor="middle">${hi ? 'chance 0.5' : `class prior ${f3(ref)}`}</text>`;
  s += `<text x="${W - R}" y="${yb + 18}" text-anchor="end" style="font-size:11px;fill:var(--ink-3)">${hi ? 'higher is better →' : '← lower is better'}</text></svg>`;
  byId('bench-bars').innerHTML = s;

  // heat table, colour scaled over the whole table
  const all = B.holdout.models.filter(m => m.id !== 'Prior').flatMap(m => B.designs.map(dd => M[m.id][dd.id])).filter(v => v !== null);
  const mn = Math.min(...all), mx = Math.max(...all);
  const step = v => { const t = (v - mn) / (mx - mn || 1); const k = Math.round((hi ? t : 1 - t) * (SEQ.length - 1)); return k; };
  let t = `<thead><tr><th>Model</th>${B.designs.map(dd => `<th class="${dd.id === state.design ? 'sel' : ''}">${esc(dd.label)}</th>`).join('')}</tr></thead><tbody>`;
  B.holdout.models.forEach(m => {
    t += `<tr${m.id === 'Prior' ? ' class="ref"' : ''}><td>${esc(m.label)}${m.id === 'Prior' ? ' (reference)' : ''}</td>`;
    B.designs.forEach(dd => {
      const v = M[m.id][dd.id];
      if (v === null) { t += '<td class="num">—</td>'; return; }
      const k = step(v);
      if (m.id === 'Prior') { t += `<td class="num${dd.id === state.design ? ' sel' : ''}">${f3(v)}</td>`; return; }
      t += `<td class="num${k >= 4 ? ' dark' : ''}${dd.id === state.design ? ' sel' : ''}" style="background:${SEQ[k]}" data-tip="${esc(m.label)} · ${esc(dd.label)}: ${f3(v)}">${f3(v)}</td>`;
    });
    t += '</tr>';
  });
  byId('heat-table').innerHTML = `${t}</tbody>`;
  const rf = B.holdout.AUC.RF;
  byId('bench-note').textContent = `Mean over splits of each design (${B.holdout.n_splits} splits in total). The random forest is best under every design; its AUC falls from ${f3(rf.random5)} (random cells) to ${f3(rf.loro)} when a whole region is held out. Neural models are averaged over two seeds.`;
}

/* ------------------------------------------------------------------ experiments tabs */
function initTabs() {
  const tabs = [...document.querySelectorAll('#exp-tabs [role="tab"]')];
  const select = tab => {
    tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; byId(t.getAttribute('aria-controls')).hidden = !on; });
  };
  tabs.forEach((tab, i) => {
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!k) return;
      const next = tabs[(i + k + tabs.length) % tabs.length]; select(next); next.focus();
    });
  });
}

function table(head, rows, opts = {}) {
  return `<div class="table-wrap"><table>${opts.caption ? `<caption>${opts.caption}</caption>` : ''}<thead><tr>${head.map((h, i) => `<th class="${i ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}${(opts.best || []).includes(`${rows.indexOf(r)}:${i}`) ? ' best' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function bestCells(rows, cols, higher = true) {
  const out = [];
  cols.forEach(c => {
    const vals = rows.map(r => parseFloat(r[c])).filter(Number.isFinite);
    const b = higher ? Math.max(...vals) : Math.min(...vals);
    rows.forEach((r, i) => { if (parseFloat(r[c]) === b) out.push(`${i}:${c}`); });
  });
  return out;
}

function renderWeighting() {
  const rows = B.weighting.filter(w => w.id !== 'Equal');
  const vals = rows.flatMap(r => [r.inner_gain, r.outer_gain]).concat(0);
  const lo = Math.min(...vals) - 0.02, up = Math.max(...vals) + 0.02;
  const W = 640, L = 190, R = 20, T = 30, rowH = 30, Hh = T + rows.length * rowH + 26;
  const x = v => L + (v - lo) / (up - lo) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Log-loss gain over equal weights on training folds and on held-out regions">`;
  s += `<line class="axis" x1="${x(0)}" x2="${x(0)}" y1="${T - 12}" y2="${Hh - 22}" stroke-width="1.5"/>`;
  rows.forEach((r, i) => {
    const y = T + i * rowH;
    s += `<text x="${L - 10}" y="${y + 4}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<line x1="${x(r.inner_gain)}" x2="${x(r.outer_gain)}" y1="${y}" y2="${y}" stroke="${css('--ink-3')}" stroke-width="1.5"/>`;
    s += `<circle cx="${x(r.inner_gain)}" cy="${y}" r="6" fill="${css('--s1')}" stroke="${css('--surface')}" stroke-width="2" data-tip="${esc(r.label)} · training folds: ${sgn(r.inner_gain)}"/>`;
    s += `<circle cx="${x(r.outer_gain)}" cy="${y}" r="6" fill="${css('--s2')}" stroke="${css('--surface')}" stroke-width="2" data-tip="${esc(r.label)} · held-out regions: ${sgn(r.outer_gain)}"/>`;
  });
  s += `<text x="${x(0)}" y="${Hh - 6}" text-anchor="middle" style="font-size:11px;fill:var(--ink-3)">0 = equal weights · right = better</text></svg>`;
  const tr = B.weighting.map(r => [esc(r.label), f3(r.AUC_block10), f3(r.AUC_loro), f3(r.AUC_env)]);
  byId('panel-weighting').innerHTML = `
    <h3>Should modalities be weighted, and should weights vary in space?</h3>
    <p class="lead">Four modality experts (climate, landscape, human, AlphaEarth) and a kNN geographic expert are pooled log-linearly. Learned weights are fitted on inner spatial folds of the training set, then deployed on held-out regions.</p>
    <div class="legend"><span><i style="background:var(--s1)"></i>Gain on training-side folds</span><span><i style="background:var(--s2)"></i>Gain on held-out regions</span></div>
    <div class="chart">${s}</div>
    ${table(['Weighting', 'AUC · block 10°', 'AUC · region out', 'AUC · env. cluster'], tr, { best: bestCells(tr, [1, 2, 3]) })}
    <p class="note">Every learned scheme gains on the folds it was fitted on and loses on new regions: weights learned where data are dense trust spatial interpolation too much.</p>`;
}

function renderCausal() {
  const inv = B.invariance, prox = B.proxy.AUC, t = B.transfer_na_eu;
  const ir = Object.entries(inv).map(([k, v]) => [esc(k), f3(v.block10), f3(v.loro), f3(v.env), f3(v.zone)]);
  const pr = Object.entries(prox).map(([k, v]) => [esc(k), f3(v.block10), f3(v.loro), f3(v.zone)]);
  const order = ['Climate', 'All', 'AlphaEarth', 'Landscape', 'Human'].filter(k => t[k] !== undefined);
  const W = 520, L = 110, R = 50, rowH = 28, Hh = order.length * rowH + 30;
  const x = v => L + (v - 0.45) / (0.7 - 0.45) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="AUC of models trained in North America and tested in Europe">`;
  order.forEach((k, i) => {
    const y = 10 + i * rowH;
    s += `<text x="${L - 10}" y="${y + 13}" text-anchor="end">${k}</text>`;
    s += `<rect x="${x(0.45)}" y="${y + 2}" width="${x(t[k]) - x(0.45)}" height="16" rx="3" fill="${k === 'Climate' ? css('--nasa-blue') : css('--s1')}" opacity="${k === 'Climate' ? 1 : .7}" data-tip="N America → Europe, ${k}: ${f3(t[k])}"/>`;
    s += `<text class="val" x="${x(t[k]) + 6}" y="${y + 14}">${f3(t[k])}</text>`;
  });
  s += `<line class="ref" x1="${x(0.5)}" x2="${x(0.5)}" y1="4" y2="${Hh - 22}"/><text class="reft" x="${x(0.5)}" y="${Hh - 6}" text-anchor="middle">chance</text></svg>`;
  byId('panel-causal').innerHTML = `
    <h3>Which relations travel between continents?</h3>
    <p class="lead">A causal diagram was written before the results. Models trained on one region were tested on others, invariance objectives were tried, and AlphaEarth was split into the part explained by named drivers (AE_hat, linear R² ${f3(B.proxy.r2, 2)}) and the residual (AE_perp).</p>
    <div class="two">
      <div><div class="card-top"><span>Trained in North America, tested in Europe</span><span class="muted">AUC · axis from 0.45</span></div><div class="chart">${s}</div></div>
      <div><div class="card-top"><span>Proxy decomposition</span><span class="muted">AUC</span></div>${table(['Representation', 'Block 10°', 'Region out', 'Climate zone'], pr, { best: bestCells(pr, [1, 2, 3]) })}</div>
    </div>
    ${table(['Objective / features', 'Block 10°', 'Region out', 'Env. cluster', 'Climate zone'], ir, { best: bestCells(ir, [1, 2, 3, 4]), caption: 'Invariance penalties and causally motivated feature subsets (mean AUC)' })}
    <p class="note">Climate transfers best between temperate invasion fronts; human-footprint relations do not transfer. AlphaEarth's residual carries in-region signal that is near chance in a new region. Invariance penalties do not help, because the dominant shift is in the class prior.</p>`;
}

function renderDecay() {
  const d = B.decay;
  const names = Object.keys(d).sort((a, b) => (d[b].loro ?? 0) - (d[a].loro ?? 0));
  const rows = names.map(k => [esc(k), f3(d[k].block10), f3(d[k].loro), f3(d[k].env), f3(d[k].zone)]);
  const dt = B.decay_tests;
  byId('panel-decay').innerHTML = `
    <h3>Monotone support constraints with regime-matched training</h3>
    <p class="lead">Six experts (four modality MLPs, an all-feature MLP and kNN-geo). The geographic weight decays with distance to training data, w·exp(−d/ρ); covariate experts fade toward the class prior as environmental novelty grows. About 15 parameters, trained on inner folds that include leave-a-training-region-out.</p>
    <div class="callout">Support decay beats the free attention gate in <b>${dt.vs_gate.wins}/${dt.vs_gate.n}</b> splits (sign test p = ${f3(dt.vs_gate.p)}) but ties equal pooling (${dt.vs_equal.wins}/${dt.vs_equal.n}, p = ${f3(dt.vs_equal.p, 2)}). Median learned range ρ under region holdout: ${formatNumber(B.rho_km.block)} km with block-only training, ${formatNumber(B.rho_km.mixed)} km with regime-matched training.</div>
    ${table(['Fusion', 'Block 10°', 'Region out', 'Env. cluster', 'Climate zone'], rows, { best: bestCells(rows, [1, 2, 3, 4]) })}`;
}

function renderPool() {
  const rows = B.pool.map(r => [`${esc(r.model)} · ${r.features === '+pool' ? 'with pool covariates' : 'base features'}`, f3(r.block10), f3(r.loro), f3(r.zone), f3(r.env)]);
  const g = (m, k) => B.pool.find(r => r.model === m && r.features === '+pool')[k] - B.pool.find(r => r.model === m && r.features === 'base')[k];
  byId('panel-pool').innerHTML = `
    <h3>An exogenous species-pool signal</h3>
    <p class="lead">Log record density of the Kraemer et al. (2015) literature compendium within 100 km and 500 km for the two <i>Aedes</i> species. Prediction: a larger gain under transfer than in-distribution.</p>
    <div class="callout">MLP AUC gain: region out <b>${sgn(g('MLP', 'loro'))}</b> vs block 10° ${sgn(g('MLP', 'block10'))}, as predicted. Random forest: ${sgn(g('RF', 'loro'))} vs ${sgn(g('RF', 'block10'))}. Calibration is not fixed: the pool covers only two of five classes.</div>
    ${table(['Model · features', 'Block 10°', 'Region out', 'Climate zone', 'Env. cluster'], rows, { best: bestCells(rows, [1, 2, 3, 4]) })}`;
}

function renderCoherence() {
  const c = B.coherence;
  const rows = c.arms.map(a => [esc(a.label), f3(a.AUC_block10), f3(a.AUC_loro), f3(a.AUC_env), f3(a.AUC_zone), f3(a.nll_loro), a.coherent ? '0 (exact)' : `${pct(c.flip_min)}–${pct(c.flip_max)}`]);
  const t = c.tests;
  byId('panel-coherence').innerHTML = `
    <h3>Does global-to-local coherence cost accuracy?</h3>
    <p class="lead">Coherence means every 0.5° parent's map value equals the average of its 0.05° children, so a city map never contradicts the country map. Four arms on the same 20 splits.</p>
    ${table(['Arm', 'AUC · block 10°', 'AUC · region out', 'AUC · env.', 'AUC · zone', 'Log-loss · region out', 'Dominant-class flips'], rows, { best: bestCells(rows, [1, 2, 3, 4]) })}
    <div class="callout">Reconciled forest vs forest: ${t['RF+Recon'].wins}/${t['RF+Recon'].n} AUC wins, mean ${sgn(t['RF+Recon'].mean_diff)}, p = ${f3(t['RF+Recon'].p, 2)}: coherence is free. Original HiCo loses ${t.HiCo.n - t.HiCo.wins}/${t.HiCo.n} (p = ${f3(t.HiCo.p, 4)}): its learned neural terms, not the hierarchy, cost accuracy. A hierarchy adds information only when the coarse level has its own data, such as country checklists.</div>`;
}

function renderOADSDM() {
  const rows = B.oadsdm.map(r => [esc(r.model), f3(r.PB_AP), f3(r.AT_AUC), f3(r.NEON_OOF_AUC), f3(r.NEON_OOF_AP)]);
  const er = B.effort_r2.map(r => [esc(r.effort_covariate.replace(/_/g, ' ')), esc(r.predictors), f3(r.spatial_cv_R2, 2)]);
  byId('panel-oadsdm').innerHTML = `
    <h3>Separating where mosquitoes live from where people report them</h3>
    <p class="lead">Opportunistic reports and repeat-visit surveys share one latent suitability. Reports carry a bias head on human-footprint covariates; surveys use occupancy-detection with effort. Protocol frozen before fitting.</p>
    ${table(['Model', 'Presence-background AP', 'Austria survey AUC', 'NEON 2026 AUC', 'NEON 2026 AP'], rows, { best: bestCells(rows, [1, 2, 3, 4]) })}
    ${table(['Effort covariate', 'Predicted from', 'Spatial-CV R²'], er, { caption: 'How much reporting effort a representation can encode' })}
    <p class="note">AlphaEarth recovers population, built-up area and night lights, so presence-background models can learn reporting effort. Joint likelihoods change NEON transfer only slightly because the available surveys do not span the urban gradient.</p>`;
}

/* ------------------------------------------------------------------ findings */
function renderFindings() {
  const h = H(), aep = B.proxy.AUC['AE_perp (residual)'];
  const items = [
    [`−${f3(B.optimism.RF, 2)}`, 'Random splits overstate skill', `Holding out a whole region costs the random forest ${f3(B.optimism.RF, 2)} AUC, the MLP ${f3(B.optimism.MLP, 2)} and geographic interpolation ${f3(B.optimism['kNN-geo'], 2)}. Report region and climate-zone holdouts.`],
    [`${f3(h.ps.none, 2)} → ${f3(h.ps.oracle, 2)}`, 'Transfer error is the regional species mix', `Re-weighting predictions to the true regional class mix nearly reaches the held-out prior itself (${f3(B.prior_shift.heldout_prior, 2)}). Which species have arrived is not learnable from environment.`],
    [`${sgn(h.stack.inner_gain, 2)} / ${sgn(h.stack.outer_gain, 2)}`, 'Learned weights fit the training geography', 'Stacked weights gain on training-side folds and lose on new regions. Fusion weights must be learned in the regime they are deployed in, and constrained to be monotone in support.'],
    [`${f3(aep ? aep.block10 : NaN, 2)} → ${f3(aep ? aep.loro : NaN, 2)}`, 'AlphaEarth is a regional fingerprint', `The part of AlphaEarth not explained by climate, landscape and human covariates scores ${f3(aep ? aep.block10 : NaN, 2)} AUC in-region and ${f3(aep ? aep.loro : NaN, 2)} in a new region; it also encodes reporting effort (R² up to ${f3(h.aeEffort, 2)}).`],
    [`${pct(B.coherence.flip_min)}–${pct(B.coherence.flip_max)} → 0`, 'Coherence is free', `HiCo's normalisation applied to the random forest keeps its accuracy (${h.recon.wins}/${h.recon.n}, p = ${f3(h.recon.p, 2)}) and removes every cross-scale contradiction.`],
  ];
  byId('finding-grid').innerHTML = items.map(([big, title, text], i) => `
    <article class="card finding"><span class="n">FINDING ${String(i + 1).padStart(2, '0')}</span><span class="big">${big}</span><h3>${title}</h3><p>${text}</p></article>`).join('');
}

/* ------------------------------------------------------------------ ledger */
const STATUS = { 'baseline-candidate': 'Kept', rejected: 'Rejected', inconclusive: 'Inconclusive', proposed: 'Proposed', infrastructure: 'Method rule' };
function renderLedger(filter = 'all') {
  const counts = B.ledger.reduce((a, e) => ({ ...a, [e.status]: (a[e.status] || 0) + 1 }), {});
  const fr = byId('ledger-filter');
  if (!fr.childElementCount) {
    fr.innerHTML = `<button type="button" data-f="all" aria-pressed="true">All (${B.ledger.length})</button>` +
      Object.keys(STATUS).filter(k => counts[k]).map(k => `<button type="button" data-f="${k}" aria-pressed="false">${STATUS[k]} (${counts[k]})</button>`).join('');
    fr.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; fr.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderLedger(b.dataset.f); });
  }
  const rows = B.ledger.filter(e => filter === 'all' || e.status === filter);
  byId('ledger-table').innerHTML = `<thead><tr><th>ID</th><th>Level</th><th>Entry</th><th>Status</th><th>Next step it set</th></tr></thead><tbody>${
    rows.map(e => `<tr><td><code>${esc(e.id)}</code></td><td>${esc(e.level)}</td><td class="wrap">${esc(e.title)}</td><td><span class="chip ${esc(e.status)}">${STATUS[e.status] || esc(e.status)}</span></td><td class="wrap">${esc(e.next)}</td></tr>`).join('')}</tbody>`;
}


/* ------------------------------------------------------------------ main */
async function main() {
  initHeroMap();
  initViewer();
  initTabs();
  try {
    B = await getJSON('data/model_benchmarks.json');
    byId('generated').textContent = `Benchmark data generated ${B.generated}`;
    const steps = [renderHicoTelemetry, renderArchitecture, renderCoherenceSection, renderExternal, renderHF2, renderCV, renderExtensions, renderLab,
      renderTelemetry, renderFindings, initBenchmark, renderFusion, renderCoherence, renderWeighting, renderCausal, renderDecay, renderPool, renderOADSDM,
      renderFoundation, renderFamilies, renderLedger, renderMethods];
    steps.forEach(fn => { try { fn(); } catch (err) { console.error(fn.name, err); } });
  } catch (error) {
    console.error('Unable to load model benchmarks:', error);
    byId('arch-detail').textContent = 'Benchmark data could not be loaded. Please reload.';
  }
}
main();
})();
