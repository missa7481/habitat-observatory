# Habitat Observatory

Public, read-only research explorer for global mosquito habitat suitability.

Website: https://missa7481.github.io/habitat-observatory/
Research page: https://missa7481.github.io/habitat-observatory/research.html

## Research scope

- Target of the global maps: *Aedes albopictus*, using 2024 environmental conditions.
- 12 released model maps, 6 quality layers and 15 aggregate experiment collections.
- Classical predictors and Earth-observation foundation representations, with their individual coverage and validation limits.
- Model inputs, source attributions, metric definitions and a dated scientific review.

The maps show retrospective relative habitat suitability. They are not calibrated probabilities of presence, mosquito abundance, disease risk or a future forecast. The 2025 NEON diagnostic has previously been examined. Added 2026 provisional year-to-date temporal validation uses frozen 2024 predictors, mostly at revisited locations; it does not update model selection or maps. Results do not establish universal superiority of foundation models.

## Using the website

The site has five sections with one shared header:

- **Maps**: interactive explorer of the 12 released *Ae. albopictus* suitability maps, with quality layers (coverage, extrapolation, model disagreement) and two-model comparison.
- **Models**: evidence behind the released maps: inputs × learners matrix, development and NEON diagnostic performance, foundation encoders and all 15 result tables (filter or download as CSV).
- **Research**: model development and fusion research: four model families, ten fusion methods with outcomes, an interactive benchmark of nine models under nine spatial and temporal holdout designs, experiments, findings and the research ledger. Numbers come from `data/model_benchmarks.json` (aggregate metrics only).
- **Data**: sources and their roles, 5-degree aggregate coverage by source, and the feature dictionary.
- **Methods**: what is mapped, validation designs, terms and metrics, release review and methods literature.

Map downloads contain quantized raster previews, not full-resolution GeoTIFF products. Code and full benchmark tables: https://github.com/missa7481/NASA_Global_Habitat_Mapping

## Publication and updates

This repository contains only the reviewed public presentation. No raw occurrence or surveillance records, precise site coordinates, per-site predictions, credentials, local reports or training services are included. The new coverage layers use 5-degree polygon aggregates; the MLP file contains only fold-level summary metrics. The website is a frozen snapshot; local daily source checks do not automatically publish updates.

Deploy using GitHub Pages, branch `main`, folder `/ (root)`. No build or secrets are required. All paths are relative, so the site also runs from a local static server.

## Attribution and reuse

See the Data page and foundation-model cards for original providers and license conditions. Original datasets and model weights retain their respective licenses. Public access to this repository does not itself grant a blanket reuse license. This release does not redistribute original datasets or model weights.

## Provenance

`data/release.json` records release scope and dates. `data/catalog.json` contains aggregate benchmarks and source links; `data/review.json` records the scientific audit snapshot.
