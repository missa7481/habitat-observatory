# Habitat Observatory · HiCo-Fuse 2

Public website for **HiCo-Fuse 2**, a hierarchical, coherent method for global mosquito vector and disease habitat mapping: a random-forest niche model over climate, landscape, human footprint and AlphaEarth embeddings, an exact global-to-local hierarchy, an independent species-pool layer (Kraemer compendium and GBIF genus counts up to 2021) on the regional term, and a fallback to the plain niche model in novel regions.

Website: https://missa7481.github.io/habitat-observatory/
Code and benchmark tables: https://github.com/missa7481/NASA_Global_Habitat_Mapping

## Layout

The design follows the editorial atlas layout of the Ashburn Heat Twin: a full-screen map under a floating masthead, a chapter rail, a legend card, a click-to-read probe and a slide-in About sheet.

- **Story** (home): seven chapters over the global map (observations, niche model, coherence with Florida / Malay Peninsula / Northern Italy zooms, two-part maps, transfer tests, disease layers, what is planned). Arrow keys move between chapters.
- **Explore**: every global 0.2° layer with pan and zoom, swipe comparison of two layers, a probe that reads a cell's position on the colour ramp, go-to views, graticule and place toggles. `#explore/<layer>` links to a layer.
- **Framework**, **Evidence**, **Methods**: the HiCo-Fuse 2 architecture, benchmarks, experiments, ledger, data, features and validation designs. Methods also has the 42-entry dataset inventory and the 25-entry methods review from the 17 November 2026 research handoff.
- **Plan**: evidence status (completed runs, report-derived, handoff checks, planned), the representation × learner experiment matrix, report-derived results with their denominators, handoff checks, priorities P0–P5 and access gaps.

Every section carries an evidence badge. Report-derived scores (the 1,601-site representation benchmark) are not presented as completed runs, and planned experiments show no results.

## Files

- `index.html`, `assets/site.css`: page shell and styles (no build step).
- `assets/site.js`: routing, document pages and charts; `assets/atlas.js`: map, story and explore; `assets/plan.js`: plan, inventory and methods review.
- `assets/hico/*.webp`: rendered map previews (`rsi/render_framework_maps.py` in the code repository).
- `data/model_benchmarks.json`: aggregate metrics only (`rsi/build_observatory_data.py`).
- `data/research_handoff.json`: catalogue metadata and aggregate counts from the research handoff (`python tools/build_handoff_data.py /path/to/handoff`). Internal project documents are named but not linked.

## Data policy

No raw occurrence or surveillance records, site coordinates, per-site or per-cell predictions, or credentials are published. Maps are rendered previews of relative suitability, not presence probabilities, abundance or disease risk.

Independent research prototype; not an official NASA product. Original datasets keep their licenses.

Deploy with GitHub Pages from branch `main`, folder `/ (root)`. All paths are relative, so the site also runs from any local static server.
