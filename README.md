# Habitat Observatory

Public, read-only research explorer for global mosquito habitat suitability.

Intended website: https://missa7481.github.io/habitat-observatory/

## Research scope

- Target of the global maps: *Aedes albopictus*, using 2024 environmental conditions.
- 12 released model maps, 6 quality layers and 15 aggregate experiment collections.
- Classical predictors and Earth-observation foundation representations, with their individual coverage and validation limits.
- Model inputs, source attributions, metric definitions and a dated scientific review.

The maps show retrospective relative habitat suitability. They are not calibrated probabilities of presence, mosquito abundance, disease risk or a future forecast. The 2025 NEON diagnostic has previously been examined. Added 2026 provisional year-to-date temporal validation uses frozen 2024 predictors, mostly at revisited locations; it does not update model selection or maps. Results do not establish universal superiority of foundation models.

## Using the website

Choose an input group and learner, then switch layers or compare two models. The Models, Experiments, Data, Review and Methodology pages explain the available results. Map downloads contain quantized raster preview data, not full-resolution GeoTIFF products. Aggregate result tables can be downloaded from Experiments.

## Publication and updates

This repository contains only the reviewed public presentation. No raw occurrence or surveillance records, credentials, local reports or training services are included. The website is a frozen snapshot; local daily source checks do not automatically publish updates.

Deploy using GitHub Pages, branch `main`, folder `/ (root)`. No build or secrets are required. Paths are configured for `/habitat-observatory/`; changes to the repository name require updating those paths.

## Attribution and reuse

See the Data page and foundation-model cards for original providers and license conditions. Original datasets and model weights retain their respective licenses. Public access to this repository does not itself grant a blanket reuse license. This release does not redistribute original datasets or model weights.

## Provenance

`data/release.json` records release scope and dates. `data/catalog.json` contains aggregate benchmarks and source links; `data/review.json` records the scientific audit snapshot.
