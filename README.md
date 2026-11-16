# Habitat Observatory · HiCo-Fuse

Public website for **HiCo-Fuse**, a hierarchical, coherent framework for global mosquito vector and disease habitat mapping from Earth-observation fusion.

Website: https://missa7481.github.io/habitat-observatory/
Code and benchmark tables: https://github.com/missa7481/NASA_Global_Habitat_Mapping

## Sections

- **Framework** (home): the HiCo-Fuse architecture as an interactive diagram (data → modality encoders → gated fusion → coherent macro/micro hierarchy → two-part vector maps and disease layers), the coherence result with global → regional → city zooms, external validation, fusion comparison, modality-gate maps, extensions under test and current status.
- **Maps**: global 0.2° views of *Ae. albopictus*, *Ae. aegypti*, *Culex*, *Anopheles*, dengue/chikungunya/Zika, West Nile and malaria indices, and community support.
- **Evidence**: the research loop: headline findings, an interactive benchmark of nine models under nine spatial and temporal holdout designs, ten fusion methods, experiments (coherence, weighting, invariance, support decay, species pool, observation-aware SDM, foundation benchmark), model families and the research ledger.
- **Methods**: data sources and roles, the 105 features, research pipeline, validation designs, limitations and terms.

## Files

- `index.html`, `assets/site.css`, `assets/site.js`: the whole site (no build step, no external scripts).
- `assets/hico/*.webp`: rendered map previews (`rsi/render_framework_maps.py` in the code repository).
- `data/model_benchmarks.json`: aggregate metrics only (`rsi/build_observatory_data.py`).

## Data policy

No raw occurrence or surveillance records, site coordinates, per-site or per-cell predictions, or credentials are published. Maps are rendered previews of relative suitability, not presence probabilities, abundance or disease risk.

Independent research prototype; not an official NASA product. Original datasets keep their licenses.

Deploy with GitHub Pages from branch `main`, folder `/ (root)`. All paths are relative, so the site also runs from any local static server.
