'use strict';
/* Habitat Observatory · research plan, dataset inventory and methods review.
   Reads data/research_handoff.json (catalogue metadata and aggregate counts only). */
(() => {
const HO = window.HO;
const { byId, esc, f3 } = HO;
const formatInt = v => Number(v || 0).toLocaleString('en-US');

/* ------------------------------------------------------------------ new benchmark (18 Nov 2026) */
const FS_LABEL = { climate19: 'Climate 19', environment41: 'Environment 41', alphaearth64: 'AlphaEarth 64', fusion105: 'Environment + AlphaEarth (early)', 'late_env41|ae64': 'Environment / AlphaEarth late, equal score', ae64_trainfold_pca16: 'AlphaEarth PCA-16 (train-fold)', 'env41+ae_pca16': 'Environment + AlphaEarth PCA-16' };
const LR_LABEL = { logistic: 'Logistic', rf: 'RF', brt: 'BRT', maxent: 'MaxEnt', late_logistic: 'Logistic' };
const GROUP_LABEL = { CLIM19: 'Climate 19 (WorldClim)', ERA5: 'ERA5-Land weather (7)', TERRAIN: 'Terrain (2)', LAND: 'Vegetation, land cover, LST, water (9)', HUMAN: 'Human footprint (4)', AE64: 'AlphaEarth 64' };

function forest(el, rows, { lim, label, fmt = v => HO.sgn(v, 3) }) {
  const W = 640, L = 250, R = 70, rowH = 30, T = 6, Hh = T + rows.length * rowH + 24;
  const x = v => L + (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(label)}">`;
  [-lim, -lim / 2, 0, lim / 2, lim].forEach(v => { s += `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${Hh - 20}"${v === 0 ? ' style="stroke:var(--ink-3)"' : ''}/><text x="${x(v)}" y="${Hh - 4}" text-anchor="middle" style="font-size:11px">${v === 0 ? '0' : HO.sgn(v, 2)}</text>`; });
  rows.forEach((r, i) => {
    const yc = T + i * rowH + rowH / 2, sig = r.lo > 0 || r.hi < 0;
    const col = sig ? (r.d > 0 ? HO.css('--ok') : HO.css('--bad')) : HO.css('--ink-3');
    s += `<text x="${L - 10}" y="${yc + 4}" text-anchor="end"${r.bold ? ' style="font-weight:700;fill:var(--ink)"' : ''}>${esc(r.label)}</text>`;
    s += `<line x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${yc}" y2="${yc}" stroke="${col}" stroke-width="2"/>`;
    s += `<circle cx="${x(r.d)}" cy="${yc}" r="5" fill="${sig ? col : HO.css('--surface')}" stroke="${col}" stroke-width="2"/>`;
    s += `<text class="val" x="${W - R + 8}" y="${yc + 4}">${fmt(r.d)}</text>`;
    s += `<rect x="0" y="${yc - rowH / 2}" width="${W}" height="${rowH}" fill="transparent" data-tip="${esc(r.tip)}"/>`;
  });
  el.innerHTML = `${s}</svg>`;
}

function renderBenchmark(R) {
  const N = R.benchmark; if (!N) return;
  const D = N.designs, S = D.spatial, get = (d, id) => (D[d] && D[d].summary.find(r => r.experiment === id)) || null;
  byId('bm-figs').innerHTML = N.figures.map(([v, l, d]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(d)}</small></div>`).join('');
  byId('bm-findings').innerHTML = N.findings.map(f => `<li><b>${esc(f.head)}</b> ${esc(f.body)}</li>`).join('');
  byId('bm-caveats').innerHTML = N.caveats.map(t => `<li>${esc(t)}</li>`).join('');

  // paired comparisons, spatial design
  const drawPaired = learner => {
    const rows = N.paired_spatial.filter(p => p.learner === learner).map(p => {
      const r = S.paired.find(q => q.reference === p.reference && q.candidate === p.candidate);
      return r && { label: p.label, d: r.delta_ap, lo: r.ci_low, hi: r.ci_high, bold: p.bold,
        tip: `${p.label}: ΔAP ${HO.sgn(r.delta_ap, 3)} (95% ${HO.sgn(r.ci_low, 3)} to ${HO.sgn(r.ci_high, 3)}); candidate better in ${r.folds_candidate_better} of ${r.folds} folds; ${r.clusters} block clusters` };
    }).filter(Boolean);
    forest(byId('bm-paired'), rows, { lim: 0.2, label: 'Paired AP differences' });
  };
  // ablations
  const drawAbl = learner => {
    const rows = Object.keys(GROUP_LABEL).map(g => {
      const r = S.paired.find(q => q.reference === `fusion105_${learner}` && q.candidate === `fusion_minus_${g}_${learner}`);
      return r && { label: `− ${GROUP_LABEL[g]}`, d: r.delta_ap, lo: r.ci_low, hi: r.ci_high,
        tip: `Removing ${GROUP_LABEL[g]} from the 105-feature fusion (${LR_LABEL[learner]}): ΔAP ${HO.sgn(r.delta_ap, 3)} (95% ${HO.sgn(r.ci_low, 3)} to ${HO.sgn(r.ci_high, 3)}); ${r.folds_candidate_better} of ${r.folds} folds improved` };
    }).filter(Boolean);
    forest(byId('bm-ablation'), rows, { lim: 0.1, label: 'Ablation AP differences' });
  };
  // transfer across designs (AUC)
  const ARMS = [['spatial', '--s1', 'Spatial blocks (150 km)'], ['region', '--s2', 'Leave one region out (mean of 3)'], ['survey', '--s3', 'Austrian survey transfer (313 sites)']];
  byId('bm-tr-legend').innerHTML = ARMS.map(([, c, l]) => `<span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${HO.css(c)}"/></svg>${esc(l)}</span>`).join('');
  const drawTransfer = learner => {
    const fsets = ['climate19', 'environment41', 'alphaearth64', 'fusion105'];
    const rows = fsets.map(fs => {
      const id = `${fs}_${learner}`, v = {};
      ARMS.forEach(([d]) => { const r = get(d, id); if (r) v[d] = r.auc; });
      return { label: FS_LABEL[fs], v, id };
    });
    if (learner === 'logistic') rows.push({ label: 'Late, equal score', v: Object.fromEntries(ARMS.map(([d]) => [d, (get(d, 'late_env41_ae64_logistic') || {}).auc]).filter(([, x]) => x !== undefined)) });
    const W = 640, L = 210, Rr = 24, rowH = 40, T = 8, Hh = T + rows.length * rowH + 24, lo = 0.5, hi = 1.0;
    const x = v => L + (v - lo) / (hi - lo) * (W - L - Rr);
    let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="AUC by holdout design">`;
    [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(v => { s += `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${Hh - 22}"/><text x="${x(v)}" y="${Hh - 6}" text-anchor="middle" style="font-size:11px">${v.toFixed(1)}</text>`; });
    rows.forEach((r, i) => {
      const yc = T + i * rowH + rowH / 2;
      s += `<line class="axis" x1="${L}" x2="${W - Rr}" y1="${yc}" y2="${yc}"/><text x="${L - 10}" y="${yc + 4}" text-anchor="end">${esc(r.label)}</text>`;
      ARMS.forEach(([d, c, nm], j) => { const v = r.v[d]; if (v === undefined || v === null) return;
        s += `<circle cx="${x(Math.max(lo, v))}" cy="${yc + (j - 1) * 4}" r="6" fill="${HO.css(c)}" stroke="${HO.css('--surface')}" stroke-width="2" data-tip="${esc(nm)} · ${esc(r.label)} · ${LR_LABEL[learner]}: AUC ${f3(v)}"/>`; });
    });
    byId('bm-transfer').innerHTML = `${s}</svg>`;
  };
  const seg = (id, draw, first) => { const g = byId(id); g.innerHTML = ['logistic', 'rf', 'brt', 'maxent'].filter(l => id !== 'bm-abl-seg' || l === 'logistic' || l === 'rf').map(l => `<button type="button" data-l="${l}" aria-pressed="${l === first}">${LR_LABEL[l]}</button>`).join('');
    g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(b.dataset.l); }); draw(first); };
  seg('bm-pair-seg', drawPaired, 'rf');
  seg('bm-abl-seg', drawAbl, 'rf');
  seg('bm-tr-seg', drawTransfer, 'rf');

  // regions table
  const regs = ['Americas', 'Europe', 'Asia_Pacific'], RL = { Americas: 'Americas', Europe: 'Europe', Asia_Pacific: 'Asia-Pacific' };
  const rr = (id, reg) => D.region.by_region.find(r => r.experiment === id && r.fold === reg);
  const ids = N.region_rows;
  byId('bm-region').innerHTML = `<thead><tr><th>Features · learner</th>${regs.map(g => { const r = rr(ids[0][0], g); return `<th class="num">${RL[g]}<br><small class="muted">n ${r ? r.n : '—'} · prev ${r ? Math.round(r.prevalence * 100) + '%' : '—'}</small></th>`; }).join('')}</tr></thead><tbody>${
    ids.map(([id, label]) => `<tr><td>${esc(label)}</td>${regs.map(g => { const r = rr(id, g); return `<td class="num">${r ? f3(r.auc) : '—'}<small class="muted"> · AP ${r ? f3(r.ap) : '—'}</small></td>`; }).join('')}</tr>`).join('')}</tbody>`;
  byId('bm-failed').innerHTML = N.not_run.map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join('');
  byId('bm-repro').innerHTML = N.reproducibility.map(t => `<li>${esc(t)}</li>`).join('');
}

/* ------------------------------------------------------------------ 19 Nov: reproduction, MLP, TESSERA, 2025 */
const FACT = { BioClim19: 'Climate 19', Environment41: 'Environment 41', AlphaEarth64: 'AlphaEarth 64', Environment_AlphaEarth105: 'Env + AlphaEarth', Nonlinear_late_fusion: 'Nonlinear late fusion', TESSERA128: 'TESSERA 128', Environment_TESSERA169: 'Env + TESSERA', TESSERA_PCA32: 'TESSERA PCA-32' };
const LRN = { GLM: 'logistic', RF: 'RF', BRT: 'BRT', MaxNet: 'MaxNet', MaxEnt: 'MaxEnt (elapid)', MLP: 'MLP' };
const ARM = id => { const [f, l] = id.split('__'); return `${FACT[f] || f.replace(/_/g, ' ')} · ${LRN[l] || l}`; };

function renderExtended(R) {
  const N = R.benchmark, X = N && N.extended; if (!X) return;
  const I = N.extended_text;
  byId('rx-figs').innerHTML = I.figures.map(([v, l, d]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(d)}</small></div>`).join('');
  byId('rx-findings').innerHTML = I.findings.map(f => `<li><b>${esc(f.head)}</b> ${esc(f.body)}</li>`).join('');
  const ver = (f, l) => X.reproduction.verified.find(r => r.factor === f && r.learner === l);
  byId('rx-repro').innerHTML = `<thead><tr><th>Features · learner</th><th class="num">Report AP</th><th class="num">Verified</th><th class="num">Refit</th><th class="num">Max fold Δ</th></tr></thead><tbody>${
    X.reproduction.verified.map(v => { const b = X.reproduction.refit.find(r => r.factor === v.factor && r.learner === v.learner);
      return `<tr><td>${esc(ARM(`${v.factor}__${v.learner}`))}</td><td class="num">${f3(b ? b.AP_original : v.AP, 4)}</td><td class="num">${f3(v.AP, 4)}</td><td class="num">${b ? f3(b.AP_refit, 4) : '<span class="muted">R only</span>'}</td><td class="num">${b ? f3(b.max_abs_fold_diff, 3) : '—'}</td></tr>`; }).join('')}</tbody>`;
  byId('rx-mlp').innerHTML = `<thead><tr><th>Representation</th><th class="num">Report AP</th><th class="num">Seed mean</th><th class="num">Seed range</th></tr></thead><tbody>${
    X.mlp.map(m => `<tr><td>${esc(FACT[m.representation] || m.representation)}</td><td class="num">${f3(m.AP_original, 4)}</td><td class="num">${f3(m.AP_seed_mean, 4)}</td><td class="num">${f3(m.AP_seed_min, 3)}–${f3(m.AP_seed_max, 3)}</td></tr>`).join('')}</tbody>`;
  const p2rows = X.p2.paired.map(p => ({ label: `${ARM(p.reference)} → ${ARM(p.candidate).split(' · ')[0]}`, d: p.delta_ap, lo: p.ci_low, hi: p.ci_high,
    bold: /TESSERA128__GLM$/.test(p.candidate) && /AlphaEarth64/.test(p.reference),
    tip: `${ARM(p.reference)} → ${ARM(p.candidate)}: ΔAP ${HO.sgn(p.delta_ap, 3)} (95% ${HO.sgn(p.ci_low, 3)} to ${HO.sgn(p.ci_high, 3)}); better in ${p.folds_candidate_better} of 6 folds` }));
  forest(byId('rx-p2'), p2rows, { lim: 0.2, label: 'TESSERA paired differences' });
  const TESTS = [['NEON2025|all_primary', 'NEON 2025'], ['AGES2025|without_AGES', 'Austria 2025, no Austrian training rows'], ['AGES2025|all_primary', 'Austria 2025, same traps’ 2024 rows in training']];
  const g = byId('rx-tr-seg');
  g.innerHTML = TESTS.map(([k, l], i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}">${esc(l)}</button>`).join('');
  const draw = k => {
    const [test, train] = k.split('|');
    const rows = X.transfer2025.metrics.filter(r => r.test === test && r.train === train).sort((a, b) => b.AP - a.AP);
    const best = rows.length ? rows[0].AP : 0, n = rows[0] || {};
    byId('rx-transfer').innerHTML = `<thead><tr><th>Features · learner</th><th class="num">AP</th><th class="num">AUC</th></tr></thead><tbody>${
      rows.map(r => `<tr${r.AP === best ? ' class="hl"' : ''}><td>${esc(ARM(r.model.replace('__MaxNet', '__MaxEnt')))}</td><td class="num">${f3(r.AP)}</td><td class="num">${f3(r.AUC)}</td></tr>`).join('')}</tbody>`;
    const pr = X.transfer2025.paired.filter(p => p.test === test && p.train === train);
    byId('rx-transfer-note').textContent = `${n.n} sites, ${n.positives} detected (prevalence ${Math.round(n.positives / n.n * 100)}%). ` + I.transfer_notes[k] + ' Paired ΔAP: ' +
      pr.map(p => `${ARM(p.candidate)} vs ${ARM(p.reference)} ${HO.sgn(p.delta_ap, 3)} (${HO.sgn(p.ci_low, 2)} to ${HO.sgn(p.ci_high, 2)})`).join('; ') + '.';
  };
  g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(b.dataset.k); });
  draw(TESTS[0][0]);
}

function render(B, R) {
  renderBenchmark(R);
  renderExtended(R);
  renderStatusBoard(B, R);
  renderMatrix(B, R);
  renderReport(R);
  byId('check-grid').innerHTML = R.checks.map(c => `<article class="check"><b>${esc(c.value)}</b><span>${esc(c.label)}</span><p>${esc(c.detail)}</p></article>`).join('');
  const PSTATE = { blocked: '<span class="ev ev-blocked">Blocked</span>', done: '<span class="ev ev-done">Run 18 Nov · new analysis</span>', partial: '<span class="ev ev-mixed">Partly resolved</span>', planned: '<span class="ev ev-plan">Planned</span>' };
  byId('prio-grid').innerHTML = R.priorities.map(p => `
    <article class="prio ${esc(p.state)}">
      <header><span class="pid">${esc(p.id)}</span>${PSTATE[p.state] || PSTATE.planned}</header>
      <h3>${esc(p.title)}</h3><p class="q">${esc(p.question)}</p>
      <ul>${p.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="blk"><b>Waits on:</b> ${esc(p.blocker)}</p>
    </article>`).join('');
  byId('gap-grid').innerHTML = R.gaps.map(g => `<article class="card"><h3>${esc(g.title)}</h3><ul class="clean">${g.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></article>`).join('');
  byId('drive-link').href = R.drive_folder;
  renderInventory(R.inventory);
  renderReview(R.review);
}

function renderStatusBoard(B, R) {
  const fx = B.foundation.find(r => r.representation === 'AlphaEarth64' && r.learner === 'GLM');
  const N = R.benchmark;
  const nFits = N ? Object.values(N.designs).reduce((a, d) => a + d.fits_ok, 0) : 0;
  const cols = [
    ['done', 'Completed runs', N ? formatInt(nFits) : `${B.holdout.n_splits}`, N ? 'new held-out fits, 18 Nov' : 'holdout splits', 'Benchmarks run in the project code repository, published here as aggregate tables.',
      [...(N ? [`18 Nov: ${N.n_experiments} configurations on the recovered 1,601-site cohort, 4 holdout designs`] : []), 'HiCo-Fuse 2 vs random forest on 20 transfer splits', 'Nine models × nine holdout designs', `Research ledger of ${B.ledger.length} experiments`], [N ? '#benchmark' : '#evidence', N ? 'See the new benchmark' : 'See the evidence']],
    ['report', 'Report-derived', f3(fx.AP, 4), 'AlphaEarth + logistic, development AP', 'From the 6 November project report. Its frozen inputs were not recovered, so these are not reproduced and not new runs.',
      ['1,601-site representation and learner benchmark', 'NEON 2025 reused diagnostic', 'Twelve global 2024 maps and their coverage'], ['#report', 'Read the caveats']],
    ['check', 'Handoff checks', `${R.inventory.length}`, 'sources inventoried', 'Downloads, adapters and tests completed on 17 November 2026. Checks, not benchmarks.',
      ['AGES and OpenDengue downloads profiled', 'AGES site count does not match the report (336 vs 313)', '7 of 7 synthetic tests passed'], ['#checks', 'See the checks']],
    ['plan', 'Planned', `${R.priorities.filter(p => p.state !== 'done').length}`, 'priorities still open', 'Next experiments, not yet run. Each names the data, accounts or environments it waits on.',
      R.priorities.map(p => `${p.id} · ${p.title}${p.state === 'done' ? ' (run 18 Nov)' : p.state === 'partial' ? ' (partly resolved)' : ''}`), ['#priorities', 'See the plan']],
  ];
  const tag = { done: '<span class="ev ev-done">Completed runs</span>', report: '<span class="ev ev-report">Report-derived</span>', check: '<span class="ev ev-check">Handoff check</span>', plan: '<span class="ev ev-plan">Planned</span>' };
  byId('status-board-grid').innerHTML = cols.map(([k, t, n, nl, d, items, [href, more]]) => `
    <article class="sb-col ${k}">${tag[k]}<h3>${t}</h3><div class="sb-n">${n}<small>${nl}</small></div><p>${d}</p>
      <ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul><a class="more" href="${href}">${more} →</a></article>`).join('');
}

function renderMatrix(B, R) {
  const M = R.matrix, rep = (r, c) => B.foundation.find(x => x.representation === r && x.learner === c);
  let group = '', html = `<thead><tr><th>Representation</th>${M.cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>`;
  const ROWMAP = { BioClim19: 'climate19', Environment41: 'environment41', AlphaEarth64: 'alphaearth64', Environment_AlphaEarth105: 'fusion105' };
  const COLMAP = { GLM: 'logistic', MaxNet: 'maxent', RF: 'rf', BRT: 'brt' };
  const S = R.benchmark && R.benchmark.designs.spatial;
  const done = (rid, c) => {
    if (!S) return null;
    const id = rid === 'Late_equal' ? (c === 'GLM' ? 'late_env41_ae64_logistic' : null) : (ROWMAP[rid] && COLMAP[c] ? `${ROWMAP[rid]}_${COLMAP[c]}` : null);
    return id ? S.summary.find(x => x.experiment === id) : null;
  };
  const best = S ? Math.max(...S.summary.filter(x => x.family === 'main' || x.family === 'fusion').map(x => x.ap)) : 0;
  const X = R.benchmark && R.benchmark.extended;
  const cell = (rid, c) => X && X.matrix_cells.find(x => x.row === rid && x.col === c);
  const xbest = X ? Math.max(...X.matrix_cells.map(x => x.ap)) : 0;
  const KIND = { refit: 'refit on frozen folds', verified: 'original R predictions recomputed (not refit)', seeds: 'mean of 10 seeds', new: 'new experiment, frozen folds' };
  M.rows.forEach(row => {
    if (row.group !== group) { group = row.group; html += `<tr><th class="grp" colspan="${M.cols.length + 1}">${esc(group)}</th></tr>`; }
    html += `<tr><td>${esc(row.label)}</td>`;
    M.cols.forEach(([c, cl]) => {
      const r = rep(row.id, c), p = (M.planned[row.id] || {})[c], n = X ? null : done(row.id, c), x = cell(row.id, c);
      if (x) {
        const spread = x.kind === 'seeds' ? `${f3(x.lo, 3)}–${f3(x.hi, 3)}` : `± ${f3(x.ap_sd, 3)}`;
        html += `<td><div class="mc m-done${x.ap >= xbest - 0.02 ? ' top' : ''}" data-tip="${esc(`${row.label} · ${cl}: AP ${f3(x.ap)} (${spread}), ${KIND[x.kind]}${x.report !== null && x.report !== undefined ? `; report ${f3(x.report)}` : '; not in the report'}`)}"><b>${f3(x.ap, 3)}</b><span>${spread}</span>${x.report !== null && x.report !== undefined ? `<small>${x.kind === 'verified' ? 'verified' : `report ${f3(x.report, 3)}`}</small>` : '<small>new</small>'}</div></td>`;
      } else if (n) html += `<td><div class="mc m-done${n.ap >= best - 0.02 ? ' top' : ''}" data-tip="${esc(`${row.label} · ${cl}: new run AP ${f3(n.ap)} ± ${f3(n.ap_sd)} (fold SD, 6 folds), AUC ${f3(n.auc)}${r ? `; report AP ${f3(r.AP)}, not reproduced` : '; not in the report'}`)}"><b>${f3(n.ap, 3)}</b><span>± ${f3(n.ap_sd, 3)}</span>${r ? `<small>report ${f3(r.AP, 3)}</small>` : ''}</div></td>`;
      else if (r && p) html += `<td><div class="mc m-both" data-tip="${esc(`${row.label} · ${cl}: report AP ${f3(r.AP)} (fold SD ${f3(r.AP_sd)}); re-run planned in ${p}`)}"><b>${f3(r.AP, 3)}</b><span>re-run ${esc(p)}</span></div></td>`;
      else if (r) html += `<td><div class="mc m-rep" data-tip="${esc(`${row.label} · ${cl}: report AP ${f3(r.AP)} (fold SD ${f3(r.AP_sd)})`)}"><b>${f3(r.AP, 3)}</b>report</div></td>`;
      else if (p) html += `<td><div class="mc m-plan" data-tip="${esc(`${row.label} · ${cl}: planned in ${p}, no result yet`)}"><span>${esc(p)}</span>planned</div></td>`;
      else html += '<td><div class="mc empty">—</div></td>';
    });
    html += '</tr>';
  });
  byId('matrix-table').innerHTML = `${html}</tbody>`;
}

function renderReport(R) {
  const P = R.report;
  byId('report-caveat').textContent = P.caveat;
  byId('report-cohort').innerHTML = P.cohort.map(([v, l, d]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(d)}</small></div>`).join('');
  byId('report-neon').innerHTML = `<thead><tr><th>Quantity</th><th class="num">Value</th><th>Denominator and caveat</th></tr></thead><tbody>${
    P.neon.map(([k, v, d]) => `<tr><td class="wrap">${esc(k)}</td><td class="num">${esc(v)}</td><td class="wrap">${esc(d)}</td></tr>`).join('')}</tbody>`;
  const W = 520, L = 150, R2 = 54, rowH = 30, Hh = P.coverage.length * rowH + 26, x = v => L + v / 100 * (W - L - R2);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Input coverage of the declared map domain by feature group">`;
  [0, 25, 50, 75, 100].forEach(v => { s += `<line class="axis" x1="${x(v)}" x2="${x(v)}" y1="2" y2="${Hh - 20}"/><text x="${x(v)}" y="${Hh - 4}" text-anchor="middle" style="font-size:11px">${v}%</text>`; });
  P.coverage.forEach(([k, v], i) => {
    const y = 4 + i * rowH;
    s += `<text x="${L - 10}" y="${y + 15}" text-anchor="end">${esc(k)}</text><rect x="${L}" y="${y + 3}" width="${x(v) - L}" height="16" rx="2" fill="${HO.css('--steel')}" data-tip="${esc(k)}: ${v}% of the declared domain"/><text class="val" x="${x(v) + 6}" y="${y + 15}">${v}%</text>`;
  });
  byId('report-coverage').innerHTML = `${s}</svg>`;
  byId('report-notes').innerHTML = P.notes.map(n => `<li>${esc(n)}</li>`).join('');
}

/* ------------------------------------------------------------------ dataset inventory */
const TYPES = [['all', 'All'], ['observation', 'Observations'], ['environmental_predictor', 'Environment'], ['imagery', 'Imagery'], ['embedding', 'Embeddings'], ['encoder_weights', 'Encoders'], ['disease_outcome', 'Disease'], ['model_prediction', 'Model maps']];
const TYPE_LABEL = Object.fromEntries(TYPES);
const ACQ = [['downloaded', 'Downloaded and profiled'], ['metadata', 'Metadata or config only'], ['blocked', 'Download blocked'], ['report', 'Acquired per report, not recovered'], ['documented', 'Documented, not downloaded']];
const ACQ_SHORT = { downloaded: 'Downloaded', metadata: 'Metadata only', blocked: 'Blocked', report: 'Report only', documented: 'Documented' };
const inv = { type: 'all', acq: null, q: '', open: new Set() };

function renderInventory(rows) {
  const counts = rows.reduce((a, r) => ({ ...a, [r.acquisition]: (a[r.acquisition] || 0) + 1 }), {});
  const sum = byId('inv-summary');
  sum.innerHTML = ACQ.filter(([k]) => counts[k]).map(([k, l]) => `<button type="button" data-acq="${k}" aria-pressed="false"><b>${counts[k]}</b><span class="acq ${k}">${l}</span></button>`).join('');
  sum.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; inv.acq = inv.acq === b.dataset.acq ? null : b.dataset.acq; draw(); });
  const tg = byId('inv-type');
  tg.innerHTML = TYPES.map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('');
  tg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; inv.type = b.dataset.t; draw(); });
  byId('inv-q').addEventListener('input', e => { inv.q = e.target.value.trim().toLowerCase(); draw(); });
  byId('inv-table').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const tr = e.target.closest('tr.main'); if (!tr) return;
    const id = tr.dataset.id; inv.open.has(id) ? inv.open.delete(id) : inv.open.add(id); draw();
  });
  byId('inv-table').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr.main')) { e.preventDefault(); e.target.click(); } });
  function draw() {
    sum.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.acq === inv.acq)));
    tg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === inv.type)));
    const shown = rows.filter(r => (inv.type === 'all' || r.data_type === inv.type) && (!inv.acq || r.acquisition === inv.acq)
      && (!inv.q || Object.values(r).join(' ').toLowerCase().includes(inv.q)));
    const head = '<thead><tr><th>ID</th><th>Dataset</th><th class="cov">Coverage</th><th class="acc">Access and licence</th><th>Status</th><th>Priority</th></tr></thead>';
    const body = shown.map(r => {
      const open = inv.open.has(r.dataset_id);
      const name = r.source_download_link ? `<a href="${esc(r.source_download_link)}" target="_blank" rel="noopener">${esc(r.dataset_name)} ↗</a>` : `${esc(r.dataset_name)}${r.internal ? ' <span class="muted">(internal project file)</span>' : ''}`;
      return `<tr class="main${open ? ' open' : ''}" data-id="${esc(r.dataset_id)}" tabindex="0" aria-expanded="${open}">
        <td class="id">${esc(r.dataset_id)}</td>
        <td class="nm"><span class="caret" aria-hidden="true">›</span>${name}<small>${esc(TYPE_LABEL[r.data_type] || r.data_type)} · ${esc(r.species_or_disease)}</small></td>
        <td class="cov">${esc(r.spatial_coverage_resolution)}</td>
        <td class="acc">${esc(r.access_license)}</td>
        <td><span class="acq ${r.acquisition}" title="${esc(r.download_status)}">${ACQ_SHORT[r.acquisition]}</span></td>
        <td><span class="pri ${esc(r.priority)}">${esc(r.priority)}</span></td></tr>${open ? `
        <tr class="detail"><td colspan="6"><div class="inv-detail">
          <div><b>Variables</b>${esc(r.variables)}</div><div><b>Time</b>${esc(r.temporal_coverage_resolution)}</div><div><b>Intended use</b>${esc(r.intended_use)}</div>
          <div><b>Limitations</b>${esc(r.limitations)}</div><div><b>Download status</b>${esc(r.download_status)}</div><div><b>How access was verified</b>${esc(r.access_verification)}</div>
        </div></td></tr>` : ''}`;
    }).join('');
    byId('inv-table').innerHTML = head + `<tbody>${body || '<tr><td colspan="6" class="empty-note">No dataset matches these filters.</td></tr>'}</tbody>`;
    byId('inv-count').textContent = `${shown.length} of ${rows.length} entries · search date 17 November 2026. P0 = needed for the recovery and replication gate; P1 = next extensions. "Documented" means the source and access route were checked, not that data were obtained.`;
  }
  draw();
}

/* ------------------------------------------------------------------ methods review */
const THEMES = [['all', 'All'], ['vector', 'Vector maps'], ['bias', 'Presence-only and bias'], ['occ', 'Occupancy'], ['val', 'Validation'], ['stat', 'Hierarchical and count'], ['neural', 'Neural species maps'], ['eo', 'EO encoders'], ['disease', 'Disease and time']];
const THEME_OF = id => {
  const n = parseInt(id.slice(1), 10);
  return n <= 3 ? 'vector' : n <= 6 ? 'bias' : n <= 8 ? 'occ' : n <= 10 ? 'val' : n <= 13 ? 'stat' : n <= 16 ? 'neural' : n <= 23 ? 'eo' : 'disease';
};
function renderReview(rows) {
  const st = { theme: 'all', q: '' };
  const tg = byId('rev-theme');
  tg.innerHTML = THEMES.map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('');
  tg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.theme = b.dataset.t; draw(); });
  byId('rev-q').addEventListener('input', e => { st.q = e.target.value.trim().toLowerCase(); draw(); });
  const themeLabel = Object.fromEntries(THEMES);
  function draw() {
    tg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === st.theme)));
    const shown = rows.filter(r => (st.theme === 'all' || THEME_OF(r.method_id) === st.theme) && (!st.q || Object.values(r).join(' ').toLowerCase().includes(st.q)));
    byId('rev-grid').innerHTML = shown.map(r => {
      const partial = /pending|not extracted|no exact|abstract/i.test(r.evidence_depth);
      return `<article class="card rev">
        <span class="rid">${esc(r.method_id)}<span>${themeLabel[THEME_OF(r.method_id)]}</span></span>
        <h3>${r.citation_link ? `<a href="${esc(r.citation_link)}" target="_blank" rel="noopener">${esc(r.citation)} ↗</a>` : esc(r.citation)}</h3>
        <dl><div><dt>Target</dt><dd>${esc(r.research_target)}</dd></div>
          <div><dt>Features and fusion</dt><dd>${esc(r.feature_embedding_construction)} · ${esc(r.fusion_strategy)}</dd></div>
          <div><dt>Learner</dt><dd>${esc(r.learner)}</dd></div>
          <div><dt>Validation</dt><dd>${esc(r.validation_design_metrics)}</dd></div></dl>
        <details><summary>Findings, code and relevance</summary><dl style="margin-top:8px"><div><dt>Findings and limitations</dt><dd>${esc(r.key_findings_limitations)}</dd></div><div><dt>Code</dt><dd>${esc(r.code_availability)}</dd></div><div><dt>Relevance here</dt><dd>${esc(r.relevance)}</dd></div></dl></details>
        <p class="depth${partial ? ' partial' : ''}">Evidence depth: ${esc(r.evidence_depth)}</p>
      </article>`;
    }).join('') || '<p class="empty-note">No method matches these filters.</p>';
  }
  draw();
}

window.Plan = { render };
})();
