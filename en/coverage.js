'use strict';
/* Data page: 5-degree aggregate observation coverage by source (no point coordinates). */
(() => {
  const el = id => document.getElementById(id);
  if (!el('coverage-map')) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Number(v || 0).toLocaleString('en-US');
  const COLORS = { training_sites: '#2a78d6', mosquito_alert_candidates: '#eb6834', globe_habitat_observations: '#1baf7a', neon_validation_sites: '#c98500' };

  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(svgNS, 'line');
    Object.entries({ x1, y1, x2, y2, class: 'grid-line' }).forEach(([k, v]) => l.setAttribute(k, String(v)));
    return l;
  };
  function grid() {
    const g = el('map-grid');
    for (let x = 0; x <= 360; x += 60) g.append(line(x * 2, 0, x * 2, 360));
    for (let y = 0; y <= 180; y += 30) g.append(line(0, y * 2, 720, y * 2));
  }
  function details(source, p) {
    if (source.map_layer === 'training_sites') return `${num(p.training_sites)} training locations: ${num(p.training_presence)} presences and ${num(p.training_background)} target-group background records.`;
    if (source.map_layer === 'mosquito_alert_candidates') return `${num(p.mosquito_alert_candidates)} candidate locations: exploratory presence-only records, not training labels.`;
    if (source.map_layer === 'globe_habitat_observations') return `${num(p.globe_habitat_observations)} habitat observations; ${num(p.globe_species_claims)} species claims, ${num(p.globe_verified_species_claims)} expert-verified.`;
    return `${num(p.neon_validation_sites)} validation sites; ${num(p.neon_detections)} detections. Kept separate from the 2024 training cohort.`;
  }
  function draw(source, features) {
    const g = el('map-cells');
    g.replaceChildren();
    el('coverage-source-name').textContent = source.name;
    el('coverage-source-role').textContent = source.role;
    el('coverage-source-limit').textContent = source.limitation || '';
    el('coverage-source-link').href = source.source;
    el('coverage-cell-detail').textContent = 'Select a coloured 5° cell for its aggregate counts.';
    const max = Math.max(1, ...features.map(f => Number(f.properties[source.map_layer] || 0)));
    for (const f of features) {
      const v = Number(f.properties[source.map_layer] || 0);
      if (!v) continue;
      const ring = f.geometry.coordinates[0];
      const [w, s] = ring[0], e = ring[1][0], n = ring[2][1];
      const r = document.createElementNS(svgNS, 'rect');
      Object.entries({ x: (w + 180) * 2, y: (90 - n) * 2, width: (e - w) * 2, height: (n - s) * 2, fill: COLORS[source.map_layer],
        'fill-opacity': 0.2 + 0.78 * Math.sqrt(v / max), class: 'coverage-cell', tabindex: 0, role: 'button',
        'aria-label': `${num(v)} records in one 5 degree cell` }).forEach(([k, val]) => r.setAttribute(k, String(val)));
      const t = document.createElementNS(svgNS, 'title');
      t.textContent = `${num(v)} records · 5° × 5° cell`;
      r.append(t);
      const show = () => { el('coverage-cell-detail').textContent = details(source, f.properties); };
      r.addEventListener('click', show);
      r.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); show(); } });
      g.append(r);
    }
    document.querySelector('#page-data .map-legend i').style.background = `linear-gradient(90deg, #eef2f7, ${COLORS[source.map_layer]})`;
  }
  Promise.all(['data/source_inventory.json', 'data/source_coverage_5deg.geojson'].map(u => fetch(u, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`${u}: ${r.status}`);
    return r.json();
  }))).then(([inv, cov]) => {
    const sources = inv.sources.filter(s => s.map_layer);
    const sel = el('coverage-source');
    sel.innerHTML = sources.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    sel.disabled = false;
    sel.addEventListener('change', () => draw(sources.find(s => s.id === sel.value), cov.features));
    grid();
    draw(sources[0], cov.features);
  }).catch(err => {
    el('coverage-source-name').textContent = 'Coverage data unavailable';
    el('coverage-cell-detail').textContent = String(err);
  });
})();
