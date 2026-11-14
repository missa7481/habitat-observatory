'use strict';

const byId = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));
const formatNumber = value => Number(value || 0).toLocaleString('en-US');
const formatMetric = value => Number.isFinite(Number(value)) ? Number(value).toFixed(3) : '—';
const svgNS = 'http://www.w3.org/2000/svg';
const SOURCE_COLORS = {
  training_sites: '#28644f',
  mosquito_alert_candidates: '#c58022',
  globe_habitat_observations: '#4d79a5',
  neon_validation_sites: '#7d5c9d',
};
const SOURCE_METRICS = {
  training_sites: ['training_sites', 'training_presence', 'training_background'],
  mosquito_alert_candidates: ['mosquito_alert_candidates'],
  globe_habitat_observations: [
    'globe_habitat_observations',
    'globe_species_claims',
    'globe_verified_species_claims',
  ],
  neon_validation_sites: ['neon_validation_sites', 'neon_detections'],
};

let inventory;
let coverage;
let comparison;

async function getJSON(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function sourceCountText(source) {
  const parts = [];
  if (source.locations) parts.push(`${formatNumber(source.locations)} locations`);
  if (source.observations) {
    parts.push(`${formatNumber(source.observations)} observations`);
    if (source.coordinate_valid_observations !== undefined) {
      parts.push(`${formatNumber(source.coordinate_valid_observations)} with valid coordinates`);
    }
  }
  if (source.records) {
    parts.push(`${formatNumber(source.records)} records`);
    if (source.coordinate_precision_le_500m !== undefined) {
      parts.push(`${formatNumber(source.coordinate_precision_le_500m)} pass the ≤500 m screen`);
    }
  }
  if (source.high_confidence_release_records) {
    parts.push(
      `${formatNumber(source.high_confidence_release_records)} high-confidence 2024 release records`,
    );
  }
  if (source.country_count) parts.push(`${formatNumber(source.country_count)} countries`);
  if (source.presence !== undefined) {
    parts.push(
      `${formatNumber(source.presence)} presences · ${formatNumber(source.target_group_background)} target-group background`,
    );
  }
  if (source.detections !== undefined) {
    parts.push(`${formatNumber(source.detections)} detections`);
  }
  if (source.species_claims !== undefined) {
    parts.push(
      `${formatNumber(source.species_claims)} species claims · ${formatNumber(source.expert_verified_species_claims)} expert-verified`,
    );
  }
  return parts.join(' · ');
}

function renderStats() {
  const sources = inventory.sources;
  const training = sources.find(source => source.id === 'training_sites');
  const alert = sources.find(source => source.id === 'mosquito_alert_candidates');
  const globe = sources.find(source => source.id === 'globe_habitat_observations');
  const neon = sources.find(source => source.id === 'neon_validation_sites');
  byId('source-stats').innerHTML = [
    [training.locations, 'Core development cohort', `${training.presence} presences · ${training.target_group_background} background`],
    [alert.locations, 'Mosquito Alert candidate subset', `${alert.country_count} countries · not used for training`],
    [globe.coordinate_valid_observations, 'GLOBE habitat reports', `${globe.country_count} countries · no expert-verified claims`],
    [neon.locations, 'NEON independent 2026 sites', `${neon.detections} detections · U.S. diagnostic`],
  ].map(([value, label, note]) => `
    <article class="stat-card">
      <strong>${formatNumber(value)}</strong>
      <span>${escapeHTML(label)}</span>
      <small>${escapeHTML(note)}</small>
    </article>
  `).join('');
}

function renderSourceCards() {
  byId('source-cards').innerHTML = inventory.sources.map(source => `
    <article class="source-card panel">
      <span class="source-role">${escapeHTML(source.role)}</span>
      <h3>${escapeHTML(source.name)}</h3>
      <p class="source-count">${escapeHTML(sourceCountText(source))}</p>
      <p class="source-limit">${escapeHTML(source.limitation)}</p>
      ${source.release_years ? `<p>${source.release_years.map(item =>
        `${item.year}: ${formatNumber(item.high_confidence_records)} high-confidence`
      ).join(' · ')}</p>` : ''}
      <a href="${escapeHTML(source.source)}" target="_blank" rel="noopener">Source record ↗</a>
    </article>
  `).join('');
}

function drawGrid() {
  const group = byId('map-grid');
  for (let longitude = 0; longitude <= 360; longitude += 60) {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(longitude * 2));
    line.setAttribute('x2', String(longitude * 2));
    line.setAttribute('y1', '0');
    line.setAttribute('y2', '360');
    line.setAttribute('class', 'grid-line');
    group.append(line);
  }
  for (let latitude = 0; latitude <= 180; latitude += 30) {
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('x2', '720');
    line.setAttribute('y1', String(latitude * 2));
    line.setAttribute('y2', String(latitude * 2));
    line.setAttribute('class', 'grid-line');
    group.append(line);
  }
}

function sourceDetails(source, properties) {
  if (source.map_layer === 'training_sites') {
    return `${formatNumber(properties.training_sites)} training locations: ${formatNumber(properties.training_presence)} presences and ${formatNumber(properties.training_background)} target-group background records.`;
  }
  if (source.map_layer === 'mosquito_alert_candidates') {
    return `${formatNumber(properties.mosquito_alert_candidates)} selected candidate locations. These are exploratory presence-only records, not training labels.`;
  }
  if (source.map_layer === 'globe_habitat_observations') {
    return `${formatNumber(properties.globe_habitat_observations)} habitat observations; ${formatNumber(properties.globe_species_claims)} coordinate-valid species claims, of which ${formatNumber(properties.globe_verified_species_claims)} are expert-verified.`;
  }
  return `${formatNumber(properties.neon_validation_sites)} validation sites; ${formatNumber(properties.neon_detections)} detections. Sites are kept separate from the 2024 training cohort.`;
}

function renderCell(source, feature, maxCount) {
  const ring = feature.geometry.coordinates[0];
  const west = ring[0][0];
  const south = ring[0][1];
  const east = ring[1][0];
  const north = ring[2][1];
  const value = Number(feature.properties[source.map_layer] || 0);
  if (!value) return null;
  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', String((west + 180) * 2));
  rect.setAttribute('y', String((90 - north) * 2));
  rect.setAttribute('width', String((east - west) * 2));
  rect.setAttribute('height', String((north - south) * 2));
  rect.setAttribute('fill', SOURCE_COLORS[source.map_layer]);
  rect.setAttribute('fill-opacity', String(0.18 + 0.78 * Math.sqrt(value / maxCount)));
  rect.setAttribute('class', 'coverage-cell');
  rect.setAttribute('tabindex', '0');
  rect.setAttribute('role', 'button');
  rect.setAttribute(
    'aria-label',
    `${formatNumber(value)} records in one coarse 5 degree cell`,
  );
  rect.setAttribute('title', `${formatNumber(value)} records · 5° × 5° aggregate cell`);
  const showDetails = () => {
    byId('coverage-cell-detail').textContent = sourceDetails(source, feature.properties);
  };
  rect.addEventListener('click', showDetails);
  rect.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showDetails();
    }
  });
  return rect;
}

function renderCoverage(source) {
  const group = byId('map-cells');
  group.replaceChildren();
  byId('coverage-title').textContent = source.name;
  byId('coverage-source-name').textContent = source.name;
  byId('coverage-source-role').textContent = source.role;
  byId('coverage-source-link').href = source.source;
  byId('coverage-cell-detail').textContent =
    'Select a colored 5° cell to inspect aggregate counts; no point coordinates are published.';
  const maxCount = Math.max(
    1,
    ...coverage.features.map(feature => Number(feature.properties[source.map_layer] || 0)),
  );
  for (const feature of coverage.features) {
    const cell = renderCell(source, feature, maxCount);
    if (cell) group.append(cell);
  }
  const color = SOURCE_COLORS[source.map_layer];
  byId('coverage-map').setAttribute(
    'aria-label',
    `Global ${source.name} coverage aggregated to 5 degree cells`,
  );
  document.querySelector('.map-legend i').style.background =
    `linear-gradient(90deg, #edf2e8, ${color})`;
}

function renderCoverageChoices() {
  const sources = inventory.sources.filter(source => source.map_layer);
  const select = byId('coverage-source');
  select.innerHTML = sources.map(source => `
    <option value="${escapeHTML(source.id)}">${escapeHTML(source.name)}</option>
  `).join('');
  select.disabled = false;
  select.addEventListener('change', () => {
    const source = sources.find(item => item.id === select.value);
    if (source) renderCoverage(source);
  });
  renderCoverage(sources[0]);
}

function renderComparison() {
  const models = comparison.models;
  byId('comparison-rows').innerHTML = models.map(model => `
    <tr>
      <td>${escapeHTML(model.display_name || `${model.representation} · ${model.learner}`)}</td>
      <td class="numeric">${formatMetric(model.AP_mean)}</td>
      <td class="numeric">${formatMetric(model.AP_fold_SD)}</td>
      <td class="numeric">${formatMetric(model.AUC_mean)}</td>
      <td>${escapeHTML(model.source)}</td>
    </tr>
  `).join('');
  const early = models.find(model =>
    model.representation === 'Environment_AlphaEarth105' &&
    model.learner === 'MLPClassifier' &&
    model.source === 'new fold-aligned MLP experiment'
  );
  const embedding = models.find(model =>
    model.representation === 'AlphaEarth64' &&
    model.learner === 'MLPClassifier' &&
    model.source === 'new fold-aligned MLP experiment'
  );
  const late = models.find(model =>
    model.representation === 'Nonlinear_late_fusion' &&
    model.learner === 'MLPClassifier'
  );
  byId('fusion-callout').textContent =
    `New MLP experiment: early fusion AP ${formatMetric(early.AP_mean)} ` +
    `(fold SD ${formatMetric(early.AP_fold_SD)}), AlphaEarth-only AP ` +
    `${formatMetric(embedding.AP_mean)}, and nonlinear late-fusion AP ` +
    `${formatMetric(late.AP_mean)}. Early fusion is only a small descriptive ` +
    'difference from the embedding-only MLP; the six-fold result does not establish a reliable gain.';
}

async function main() {
  try {
    [inventory, coverage, comparison] = await Promise.all([
      getJSON('data/source_inventory.json'),
      getJSON('data/source_coverage_5deg.geojson'),
      getJSON('data/fusion_mlp_summary.json'),
    ]);
    renderStats();
    renderSourceCards();
    drawGrid();
    renderCoverageChoices();
    renderComparison();
  } catch (error) {
    console.error('Unable to load research snapshot:', error);
    byId('source-stats').innerHTML =
      '<p class="loading">The reviewed data snapshot could not be loaded. Please try again later.</p>';
    byId('coverage-title').textContent = 'Coverage data unavailable';
    byId('coverage-cell-detail').textContent = String(error);
    byId('comparison-rows').innerHTML =
      '<tr><td colspan="5">Model results could not be loaded.</td></tr>';
    byId('fusion-callout').textContent = 'The model comparison data could not be loaded.';
  }
}

main();
