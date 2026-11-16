'use strict';

/* Research foundation page. Every number is read from data/*.json (aggregate results only). */

const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatNumber = value => Number(value || 0).toLocaleString('en-US');
const f3 = (v, k = 3) => (v === null || v === undefined || !Number.isFinite(Number(v))) ? '—' : Number(v).toFixed(k);
const sgn = (v, k = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(k);
const pct = v => `${Math.round(v * 100)}%`;
const svgNS = 'http://www.w3.org/2000/svg';
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const SOURCE_COLORS = {
  training_sites: '#2a78d6',
  mosquito_alert_candidates: '#eb6834',
  globe_habitat_observations: '#1baf7a',
  neon_validation_sites: '#c98500',
};
const SEQ = ['#f3f7fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

let inventory, coverage, comparison, B;
const state = { design: 'loro', metric: 'AUC' };

async function getJSON(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

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

/* ------------------------------------------------------------------ hero map */
function initGlobe() {
  const img = byId('globe-map');
  const buttons = [...document.querySelectorAll('.globe-controls .seg button')];
  buttons.forEach(button => {
    new Image().src = `assets/maps/map_${button.dataset.map}.webp`;
    button.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      img.classList.add('fade');
      setTimeout(() => {
        img.src = `assets/maps/map_${button.dataset.map}.webp`;
        img.onload = () => img.classList.remove('fade');
      }, 200);
      byId('hud-layer').innerHTML = `HiCo-Fuse · <i>${esc(button.dataset.name)}</i> · 0.2°`;
    });
  });
  const frame = byId('globe-frame');
  frame.addEventListener('pointermove', e => {
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    const lat = 85 - fy * 145, lon = -180 + fx * 360;
    byId('hud-pos').textContent = `LAT ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}  LON ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  });
  frame.addEventListener('pointerleave', () => { byId('hud-pos').textContent = 'LAT —  LON —'; });
}

/* ------------------------------------------------------------------ section navigation */
function initSubnav() {
  const links = [...document.querySelectorAll('.subnav a')];
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === `#${entry.target.id}`));
  }), { rootMargin: '-40% 0px -55% 0px' });
  links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
}

/* ------------------------------------------------------------------ coverage (existing data) */
function sourceCountText(source) {
  const parts = [];
  if (source.locations) parts.push(`${formatNumber(source.locations)} locations`);
  if (source.observations) {
    parts.push(`${formatNumber(source.observations)} observations`);
    if (source.coordinate_valid_observations !== undefined) parts.push(`${formatNumber(source.coordinate_valid_observations)} with valid coordinates`);
  }
  if (source.records) {
    parts.push(`${formatNumber(source.records)} records`);
    if (source.coordinate_precision_le_500m !== undefined) parts.push(`${formatNumber(source.coordinate_precision_le_500m)} pass the ≤500 m screen`);
  }
  if (source.high_confidence_release_records) parts.push(`${formatNumber(source.high_confidence_release_records)} high-confidence 2024 release records`);
  if (source.country_count) parts.push(`${formatNumber(source.country_count)} countries`);
  if (source.presence !== undefined) parts.push(`${formatNumber(source.presence)} presences · ${formatNumber(source.target_group_background)} target-group background`);
  if (source.detections !== undefined) parts.push(`${formatNumber(source.detections)} detections`);
  if (source.species_claims !== undefined) parts.push(`${formatNumber(source.species_claims)} species claims · ${formatNumber(source.expert_verified_species_claims)} expert-verified`);
  return parts.join(' · ');
}

function renderStats() {
  const s = id => inventory.sources.find(source => source.id === id);
  const training = s('training_sites'), alert = s('mosquito_alert_candidates'), globe = s('globe_habitat_observations'), neon = s('neon_validation_sites');
  byId('source-stats').innerHTML = [
    [training.locations, 'Core development cohort', `${training.presence} presences · ${training.target_group_background} background`],
    [7004, 'Multi-species report cells', '0.05° cells · 5 Culicidae classes · 2022–2025'],
    [globe.coordinate_valid_observations, 'GLOBE habitat reports', `${globe.country_count} countries · no expert-verified claims`],
    [neon.locations, 'NEON independent 2026 sites', `${neon.detections} detections · U.S. diagnostic`],
    [alert.locations, 'Mosquito Alert candidates', `${alert.country_count} countries · not used for training`],
  ].map(([value, label, note]) => `<article class="stat-card"><strong>${formatNumber(value)}</strong><span>${esc(label)}</span><small>${esc(note)}</small></article>`).join('');
}

function renderSourceCards() {
  byId('source-cards').innerHTML = inventory.sources.map(source => `
    <article class="source-card">
      <span class="source-role">${esc(source.role)}</span>
      <h3>${esc(source.name)}</h3>
      <p class="source-count">${esc(sourceCountText(source))}</p>
      <p class="source-limit">${esc(source.limitation)}</p>
      ${source.release_years ? `<p>${source.release_years.map(item => `${item.year}: ${formatNumber(item.high_confidence_records)} high-confidence`).join(' · ')}</p>` : ''}
      <a href="${esc(source.source)}" target="_blank" rel="noopener">Source record ↗</a>
    </article>`).join('');
}

function drawGrid() {
  const group = byId('map-grid');
  for (let x = 0; x <= 360; x += 60) group.append(line(x * 2, 0, x * 2, 360, 'grid-line'));
  for (let y = 0; y <= 180; y += 30) group.append(line(0, y * 2, 720, y * 2, 'grid-line'));
}
function line(x1, y1, x2, y2, cls) {
  const l = document.createElementNS(svgNS, 'line');
  Object.entries({ x1, y1, x2, y2, class: cls }).forEach(([k, v]) => l.setAttribute(k, String(v)));
  return l;
}

function sourceDetails(source, p) {
  if (source.map_layer === 'training_sites') return `${formatNumber(p.training_sites)} training locations: ${formatNumber(p.training_presence)} presences and ${formatNumber(p.training_background)} target-group background records.`;
  if (source.map_layer === 'mosquito_alert_candidates') return `${formatNumber(p.mosquito_alert_candidates)} selected candidate locations. Exploratory presence-only records, not training labels.`;
  if (source.map_layer === 'globe_habitat_observations') return `${formatNumber(p.globe_habitat_observations)} habitat observations; ${formatNumber(p.globe_species_claims)} coordinate-valid species claims, of which ${formatNumber(p.globe_verified_species_claims)} are expert-verified.`;
  return `${formatNumber(p.neon_validation_sites)} validation sites; ${formatNumber(p.neon_detections)} detections. Kept separate from the 2024 training cohort.`;
}

function renderCell(source, feature, maxCount) {
  const ring = feature.geometry.coordinates[0];
  const [west, south] = ring[0], east = ring[1][0], north = ring[2][1];
  const value = Number(feature.properties[source.map_layer] || 0);
  if (!value) return null;
  const rect = document.createElementNS(svgNS, 'rect');
  const attrs = { x: (west + 180) * 2, y: (90 - north) * 2, width: (east - west) * 2, height: (north - south) * 2,
    fill: SOURCE_COLORS[source.map_layer], 'fill-opacity': 0.2 + 0.78 * Math.sqrt(value / maxCount), class: 'coverage-cell',
    tabindex: 0, role: 'button', 'aria-label': `${formatNumber(value)} records in one 5 degree cell`, 'data-tip': `${formatNumber(value)} records · 5° × 5° cell` };
  Object.entries(attrs).forEach(([k, v]) => rect.setAttribute(k, String(v)));
  const show = () => { byId('coverage-cell-detail').textContent = sourceDetails(source, feature.properties); };
  rect.addEventListener('click', show);
  rect.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
  return rect;
}

function renderCoverage(source) {
  const group = byId('map-cells');
  group.replaceChildren();
  byId('coverage-title').textContent = source.name;
  byId('coverage-source-name').textContent = source.name;
  byId('coverage-source-role').textContent = source.role;
  byId('coverage-source-link').href = source.source;
  byId('coverage-cell-detail').textContent = 'Select a coloured 5° cell to inspect aggregate counts; no point coordinates are published.';
  const maxCount = Math.max(1, ...coverage.features.map(f => Number(f.properties[source.map_layer] || 0)));
  coverage.features.forEach(f => { const c = renderCell(source, f, maxCount); if (c) group.append(c); });
  byId('coverage-map').setAttribute('aria-label', `Global ${source.name} coverage aggregated to 5 degree cells`);
  document.querySelector('.map-legend i').style.background = `linear-gradient(90deg, ${css('--surface-2')}, ${SOURCE_COLORS[source.map_layer]})`;
}

function renderCoverageChoices() {
  const sources = inventory.sources.filter(source => source.map_layer);
  const select = byId('coverage-source');
  select.innerHTML = sources.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  select.disabled = false;
  select.addEventListener('change', () => { const s = sources.find(x => x.id === select.value); if (s) renderCoverage(s); });
  renderCoverage(sources[0]);
}

function renderComparison() {
  const models = comparison.models;
  byId('comparison-rows').innerHTML = models.map(m => `
    <tr><td>${esc(m.display_name || `${m.representation} · ${m.learner}`)}</td>
    <td class="num">${f3(m.AP_mean)}</td><td class="num">${f3(m.AP_fold_SD)}</td><td class="num">${f3(m.AUC_mean)}</td><td>${esc(m.source)}</td></tr>`).join('');
  const find = (rep, src) => models.find(m => m.representation === rep && m.learner === 'MLPClassifier' && (!src || m.source === src));
  const early = find('Environment_AlphaEarth105', 'new fold-aligned MLP experiment');
  const emb = find('AlphaEarth64', 'new fold-aligned MLP experiment');
  const late = find('Nonlinear_late_fusion');
  byId('fusion-callout').textContent = `Early fusion MLP AP ${f3(early.AP_mean)} (fold SD ${f3(early.AP_fold_SD)}), AlphaEarth-only MLP ${f3(emb.AP_mean)}, nonlinear late fusion ${f3(late.AP_mean)}. Early fusion is a small descriptive difference from the embedding alone; six folds do not establish a reliable gain.`;
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

function renderHiCo() {
  const rows = B.hico_cv.map(r => [esc(r.model), f3(r.test_nll), f3(r.AUC_Ae_albopictus), f3(r.AUC_Ae_aegypti), f3(r.AUC_Culex), f3(r.AUC_Anopheles), f3(r.AUC_mean)]);
  const cols = ['Kraemer Ae. albopictus · all', 'Kraemer Ae. albopictus · >~110 km from iNat reports', 'Kraemer Ae. aegypti · all', 'NEON 2026 Ae. albopictus · 373 sites'];
  const er = Object.entries(B.external).map(([m, v]) => [esc(m), ...cols.map(c => f3(v[c]))]);
  byId('panel-hico').innerHTML = `
    <h3>HiCo-Fuse architectures (10° spatial blocks)</h3>
    <p class="lead">Composition of five Culicidae classes per 0.05° cell. Fusion architectures from linear early fusion to the coherent HiCo hierarchy and its mixture-of-experts variant.</p>
    ${table(['Architecture', 'Log-loss', 'AUC albopictus', 'AUC aegypti', 'AUC Culex', 'AUC Anopheles', 'Mean AUC'], rows, { best: bestCells(rows, [2, 3, 4, 5, 6]) })}
    ${table(['Model', 'Kraemer albopictus', 'Kraemer albopictus >110 km', 'Kraemer aegypti', 'NEON 2026'], er, { best: bestCells(er, [1, 2, 3, 4]), caption: 'External checks (AUC, never used in training). Two-part = composition × reporting support.' })}`;
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
  initGlobe();
  initSubnav();
  initTabs();
  try {
    B = await getJSON('data/model_benchmarks.json');
    byId('generated').textContent = `Benchmark data generated ${B.generated}`;
    renderTelemetry(); renderFamilies(); renderFusion(); initBenchmark();
    renderWeighting(); renderCausal(); renderDecay(); renderPool(); renderCoherence(); renderOADSDM(); renderHiCo();
    renderFindings(); renderLedger();
  } catch (error) {
    console.error('Unable to load model benchmarks:', error);
    byId('families-grid').innerHTML = '<p class="loading">Model benchmark data could not be loaded.</p>';
  }
  try {
    [inventory, coverage, comparison] = await Promise.all([
      getJSON('data/source_inventory.json'), getJSON('data/source_coverage_5deg.geojson'), getJSON('data/fusion_mlp_summary.json'),
    ]);
    renderStats(); renderSourceCards(); drawGrid(); renderCoverageChoices(); renderComparison();
  } catch (error) {
    console.error('Unable to load research snapshot:', error);
    byId('source-stats').innerHTML = '<p class="loading">The reviewed data snapshot could not be loaded.</p>';
    byId('coverage-title').textContent = 'Coverage data unavailable';
    byId('comparison-rows').innerHTML = '<tr><td colspan="5">Model results could not be loaded.</td></tr>';
  }
}

main();
