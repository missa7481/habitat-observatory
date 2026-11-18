"""Build data/research_handoff.json from the 2026-11-17 research handoff.

Usage:  python tools/build_handoff_data.py /path/to/handoff

Reads tables/Table_1_Dataset_Inventory.csv and tables/Table_2_Methods_Review.csv and
adds the evidence-status summary transcribed from docs/Report_Summary.txt,
docs/Research_Plan.txt and docs/Access_Gaps.txt. Only catalogue metadata and
aggregate counts are published: no observation records, coordinates or local paths.
"""
import csv
import json
import sys
from pathlib import Path

HANDOFF = Path(sys.argv[1] if len(sys.argv) > 1 else "handoff")
OUT = Path(__file__).resolve().parents[1] / "data" / "research_handoff.json"

INV_FIELDS = ["dataset_id", "dataset_name", "source_download_link", "data_type", "species_or_disease", "variables",
              "spatial_coverage_resolution", "temporal_coverage_resolution", "access_license", "limitations",
              "intended_use", "download_status", "access_verification", "priority"]
REV_FIELDS = ["method_id", "citation", "citation_link", "research_target", "datasets_variables",
              "feature_embedding_construction", "fusion_strategy", "learner", "validation_design_metrics",
              "key_findings_limitations", "code_availability", "relevance", "evidence_depth"]


def rows(name, fields):
    with open(HANDOFF / "tables" / name, encoding="utf-8-sig", newline="") as f:
        return [{k: (r.get(k) or "").strip() for k in fields} for r in csv.DictReader(f)]


def acquisition(status):
    """Coarse acquisition state for filtering; the full status text is published alongside."""
    s = status.lower()
    if "403" in s or "401" in s:
        return "blocked"
    if "report says" in s or "report read" in s:
        return "report"
    if s.startswith("downloaded") or "extract downloaded" in s:
        return "downloaded"
    if "catalog downloaded" in s or "config downloaded" in s:
        return "metadata"
    return "documented"


inventory = rows("Table_1_Dataset_Inventory.csv", INV_FIELDS)
for r in inventory:
    r["acquisition"] = acquisition(r["download_status"])
    # Internal project documents and folders are named but not linked on the public site.
    if "drive.google.com" in r["source_download_link"] or "docs.google.com" in r["source_download_link"]:
        r["source_download_link"] = ""
        r["internal"] = True
review = rows("Table_2_Methods_Review.csv", REV_FIELDS)

data = {
    "generated": "2026-11-17",
    "source": "Habitat Mapping research handoff, prepared 2026-11-17",
    "drive_folder": "https://drive.google.com/drive/folders/1BGxZ4w-XJ6B2Yb82ERhMquEp0ZB7QsZ6",
    "inventory": inventory,
    "review": review,
    "report": {
        "title": "Global habitat project report, 6 November 2026",
        "caveat": "Report-derived. These scores come from the project report; the frozen feature tables, split IDs and code behind them were not recovered in the handoff, so they have not been reproduced. They are not new runs.",
        "cohort": [
            ["1,601", "sites in the presence/background cohort", "625 iNaturalist positives, 114 Austrian survey-positive locations, 862 other-Culicidae background locations. Background is not confirmed absence."],
            ["313", "Austrian survey sites", "Separate survey endpoint, 114 detected."],
            ["504", "development fits", "3 outer spatial folds × seeds 42/202 (≈150 km blocks, ≥20 km separation), 3 inner folds, 12 configurations."],
            ["12", "global 2024 maps", "24 score rasters and 6 quality layers over 2,913 processed tiles. Only AlphaEarth was deployed globally among five encoders."],
        ],
        "neon": [
            ["AlphaEarth + logistic, NEON 2025 AP", "0.3445", "389 locations, 43 detected, 45 site clusters; 2024 features vs 2025 detections; >10 km from development candidates. A reused diagnostic, not a blind test."],
            ["Fusion − environment, fixed logistic ΔAP", "+0.196", "95% conditional cluster-bootstrap interval 0.024 to 0.395."],
            ["Fusion − environment, fixed RF ΔAP", "−0.030", "Interval −0.242 to 0.200: no demonstrated difference."],
            ["Climate19 + MaxNet, NEON AP", "0.4810", "Numerically highest on this diagnostic, but choosing it after inspecting NEON would invalidate a blind-selection claim."],
        ],
        "coverage": [["Environment / fusion", 76.97], ["AlphaEarth", 99.32], ["Climate", 100.0]],
        "notes": [
            "AP measures ranking under the sampling design: 0.8111 is not 81% global accuracy, occupancy or abundance.",
            "Near-ties among the top models do not establish superiority.",
            "Development prevalence (46.16%) and NEON prevalence (11.05%) differ, so APs cannot be subtracted to measure a loss of accuracy.",
            "Bootstrap intervals condition on trained models and omit training, selection and multiple-comparison uncertainty.",
            "An earlier 1,296-site cohort with a different recipe (environment + AE + RF, AP 0.8276) must not be combined with these rankings.",
            "Map disagreement is not a confidence interval; missing cells are not low risk.",
        ],
    },
    "checks": [
        {"value": "6,682", "label": "eligible AGES target events", "detail": "From 27,131 rows (6,801 Ae. albopictus) in the downloaded AGES 2024 archive, using a conservative adapter."},
        {"value": "336 ≠ 313", "label": "AGES site candidates vs report", "detail": "336 provider-location candidates (120 detected, 314 unique coordinate pairs) do not reproduce the report's 313 coordinate-aggregated sites. The site and co-location rules must be reconciled before modelling."},
        {"value": "29,540", "label": "OpenDengue V1.3.1 national rows", "detail": "128 country codes, 1924-01-20 to 2025-04-30. A profile of the national extract; disease counts are never used as mosquito labels."},
        {"value": "7 / 7", "label": "smoke and correctness tests passed", "detail": "Synthetic checks of buffered spatial folds across the dateline, monthly feature support, raster masking, occupancy and count likelihoods, paired cluster evaluation and the endpoint guard. They are not a benchmark."},
        {"value": "10", "label": "reference configurations implemented", "detail": "baseline.json: Climate 19 and Environment 41 with logistic, RF and BRT; AlphaEarth 64 and the 105-feature fusion with logistic and RF. The report's two MaxNet configurations need the official R implementation."},
        {"value": "42 · 25 · 254", "label": "datasets · methods · dictionary fields", "detail": "Structured source search and methods review, with evidence depth and access gaps recorded for each entry."},
    ],
    "matrix": {
        "rows": [
            {"id": "BioClim19", "label": "Climate 19", "group": "Explicit features"},
            {"id": "Environment41", "label": "Environment 41", "group": "Explicit features"},
            {"id": "AlphaEarth64", "label": "AlphaEarth 64", "group": "Embeddings"},
            {"id": "TESSERA128", "label": "TESSERA 128", "group": "Embeddings"},
            {"id": "TESSERA_PCA32", "label": "TESSERA PCA-32 (train-fold)", "group": "Embeddings"},
            {"id": "Environment_AlphaEarth105", "label": "Environment + AlphaEarth (early)", "group": "Fusion"},
            {"id": "Environment_TESSERA", "label": "Environment + TESSERA (early)", "group": "Fusion"},
            {"id": "Late_equal", "label": "Environment / AlphaEarth late, equal score", "group": "Fusion"},
            {"id": "Nonlinear_late_fusion", "label": "Nonlinear late fusion", "group": "Fusion"},
        ],
        "cols": [["GLM", "Logistic"], ["MaxNet", "MaxNet"], ["RF", "RF"], ["BRT", "BRT"], ["MLP", "MLP"]],
        "planned": {
            "BioClim19": {"GLM": "P1", "RF": "P1", "BRT": "P1", "MaxNet": "P1"},
            "Environment41": {"GLM": "P1 · P2", "RF": "P1", "BRT": "P1", "MaxNet": "P1"},
            "AlphaEarth64": {"GLM": "P1 · P2", "RF": "P1"},
            "Environment_AlphaEarth105": {"GLM": "P1 · P2", "RF": "P1"},
            "TESSERA128": {"GLM": "P2"},
            "TESSERA_PCA32": {"GLM": "P2"},
            "Environment_TESSERA": {"GLM": "P2"},
            "Late_equal": {"GLM": "P2"},
        },
    },
    "priorities": [
        {"id": "P0", "title": "Recovery and provenance gate", "state": "blocked",
         "question": "Can the reported cohort be reproduced exactly?",
         "items": ["Recover the 1,601-site feature cohort, the 313-site Austrian cohort, NEON diagnostics, frozen split IDs and protocol hashes.",
                   "Reconcile AGES co-located traps (336 candidates vs 313 sites) against the frozen code.",
                   "Recover the formal GBIF download DOI; freeze new confirmatory external data before expanding algorithms."],
         "blocker": "Frozen artifacts are on the original project drive and were not in the handoff."},
        {"id": "P1", "title": "Replicate the feature comparison", "state": "planned",
         "question": "Do the reported rankings hold under one locked protocol?",
         "items": ["Climate 19 and Environment 41 → regularised logistic, RF, BRT; AlphaEarth 64 → logistic, RF; Environment + AE → the same heads.",
                   "Add the two MaxNet configurations through the official R implementation (logistic regression is not MaxEnt).",
                   "Use original split IDs for direct reproduction; scores on new EPSG:6933 blocks are labelled a new analysis."],
         "blocker": "Needs P0 feature tables."},
        {"id": "P2", "title": "Representation study", "state": "planned",
         "question": "Does representation learning, or a complementary modality, improve transfer?",
         "items": ["Environment 41, AlphaEarth 64, TESSERA v1.1 128-D, early fusion with each, equal-score late fusion, train-fold PCA-32 TESSERA control.",
                   "Fixed logistic head (C 0.1 / 1) on one shared complete cohort; equal-dimension and matched-capacity controls."],
         "blocker": "TESSERA extraction needs Python 3.12 and an authorised environment."},
        {"id": "P3", "title": "Feature engineering and support ablations", "state": "planned",
         "question": "What do embeddings add beyond spectra, climate, human activity and coordinates?",
         "items": ["Radius point / 250 / 500 / 1,000 m; native vs 250 m working grid.",
                   "Raw Sentinel-2 / HLS quarterly statistics, seasonal dynamics, lagged weather; human-activity features removed or kept as bias covariates.",
                   "Coordinates only, coordinates + environment, SatCLIP; frozen Prithvi / SatMAE / CROMA / Clay with raw-input, metadata and random-init controls.",
                   "Training fractions 10 / 25 / 50 / 100%; single-source vs equal-N fusion."],
         "blocker": "Earth Engine, CDS and Earthdata accounts; encoder environments."},
        {"id": "P4", "title": "Observation-aware regional study", "state": "planned",
         "question": "Can repeat surveys separate occupancy from detection?",
         "items": ["Single-season occupancy with effort, trap and weather for detection (scripts/occupancy.py).",
                   "Negative-binomial counts with a log-effort offset (scripts/count_model.py); sdmTMB for residual structure.",
                   "Eggs, adult captures and larval indices stay separate targets."],
         "blocker": "NEON trap tables (HTTP 403 in the handoff session) and new survey data."},
        {"id": "P5", "title": "Disease branch", "state": "planned",
         "question": "Do habitat summaries help explain dengue counts once the vector question is locked?",
         "items": ["OpenDengue / WHO / PAHO by admin region and period; count model with a population offset and lagged weather.",
                   "Hold out regions and forecast future periods; never assign country cases to centroids."],
         "blocker": "Waits for P1–P2; WHO and PAHO exports untested."},
    ],
    "gaps": [
        {"title": "Project artifacts not recovered", "items": [
            "Frozen 1,601-site feature package, protocol.json, fold IDs, checkpoints and original execution code.",
            "Formal GBIF frozen-download DOI (a free account is needed to request a new one).",
            "Past performance on this site is report-derived until these are recovered."]},
        {"title": "Downloads that failed or were not tested", "items": [
            "Dryad historical Aedes data: metadata 200, CSV route 403, API 401.",
            "NEON mosquito trap tables: product metadata 200, sample month manifest 403.",
            "WHO dashboard export (not tested), PAHO portal (fetch 403), VectorByte bulk export, current Mosquito Alert and GLOBE archives."]},
        {"title": "Accounts and compute", "items": [
            "Earth Engine project, Copernicus CDS, Earthdata; encoder-specific environments.",
            "No authentication, terms acceptance, large download or paid computation was run in the handoff."]},
        {"title": "Independent evidence", "items": [
            "New tropical surveys with explicit trap effort and repeat detection are the main validation priority.",
            "NEON and Austrian labels have been inspected and cannot be rebranded as blind tests.",
            "The methods review is a structured search, not a PRISMA systematic review."]},
    ],
}

OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"wrote {OUT} · {len(inventory)} datasets · {len(review)} methods")
