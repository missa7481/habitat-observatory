'use strict';
/* Habitat Observatory · research plan, dataset inventory and methods review.
   Reads data/research_handoff.json (catalogue metadata and aggregate counts only). */
(() => {
const HO = window.HO;
const { byId, esc, f3 } = HO;

function render(B, R) {
  renderStatusBoard(B, R);
  renderMatrix(B, R);
  renderReport(R);
  byId('check-grid').innerHTML = R.checks.map(c => `<article class="check"><b>${esc(c.value)}</b><span>${esc(c.label)}</span><p>${esc(c.detail)}</p></article>`).join('');
  byId('prio-grid').innerHTML = R.priorities.map(p => `
    <article class="prio${p.state === 'blocked' ? ' blocked' : ''}">
      <header><span class="pid">${esc(p.id)}</span>${p.state === 'blocked' ? '<span class="ev ev-blocked">Blocked</span>' : '<span class="ev ev-plan">Planned</span>'}</header>
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
  const cols = [
    ['done', 'Completed runs', `${B.holdout.n_splits}`, 'holdout splits', 'Benchmarks run in the project code repository, published here as aggregate tables.',
      ['HiCo-Fuse 2 vs random forest on 20 transfer splits', 'Nine models × nine holdout designs', 'Coherence, weighting, invariance, species pool, observation-aware SDM', `Research ledger of ${B.ledger.length} experiments`], ['#evidence', 'See the evidence']],
    ['report', 'Report-derived', f3(fx.AP, 4), 'AlphaEarth + logistic, development AP', 'From the 6 November project report. Its frozen inputs were not recovered, so these are not reproduced and not new runs.',
      ['1,601-site representation and learner benchmark', 'NEON 2025 reused diagnostic', 'Twelve global 2024 maps and their coverage'], ['#report', 'Read the caveats']],
    ['check', 'Handoff checks', `${R.inventory.length}`, 'sources inventoried', 'Downloads, adapters and tests completed on 17 November 2026. Checks, not benchmarks.',
      ['AGES and OpenDengue downloads profiled', 'AGES site count does not match the report (336 vs 313)', '7 of 7 synthetic tests passed'], ['#checks', 'See the checks']],
    ['plan', 'Planned', `${R.priorities.length}`, 'priorities, P0–P5', 'Designed experiments with no results yet. P0 recovery is blocked on the original project files.',
      R.priorities.map(p => `${p.id} · ${p.title}`), ['#priorities', 'See the plan']],
  ];
  const tag = { done: '<span class="ev ev-done">Completed runs</span>', report: '<span class="ev ev-report">Report-derived</span>', check: '<span class="ev ev-check">Handoff check</span>', plan: '<span class="ev ev-plan">Planned</span>' };
  byId('status-board-grid').innerHTML = cols.map(([k, t, n, nl, d, items, [href, more]]) => `
    <article class="sb-col ${k}">${tag[k]}<h3>${t}</h3><div class="sb-n">${n}<small>${nl}</small></div><p>${d}</p>
      <ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul><a class="more" href="${href}">${more} →</a></article>`).join('');
}

function renderMatrix(B, R) {
  const M = R.matrix, rep = (r, c) => B.foundation.find(x => x.representation === r && x.learner === c);
  let group = '', html = `<thead><tr><th>Representation</th>${M.cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>`;
  M.rows.forEach(row => {
    if (row.group !== group) { group = row.group; html += `<tr><th class="grp" colspan="${M.cols.length + 1}">${esc(group)}</th></tr>`; }
    html += `<tr><td>${esc(row.label)}</td>`;
    M.cols.forEach(([c, cl]) => {
      const r = rep(row.id, c), p = (M.planned[row.id] || {})[c];
      if (r && p) html += `<td><div class="mc m-both" data-tip="${esc(`${row.label} · ${cl}: report AP ${f3(r.AP)} (fold SD ${f3(r.AP_sd)}); re-run planned in ${p}`)}"><b>${f3(r.AP, 3)}</b><span>re-run ${esc(p)}</span></div></td>`;
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
