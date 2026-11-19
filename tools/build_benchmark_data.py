"""Merge the 18 November 2026 benchmark into data/research_handoff.json.

Usage:  python tools/build_benchmark_data.py /path/to/handoff/runs/matrix_v1/summary

Reads site_benchmark.json (aggregate fold metrics and paired comparisons written by
handoff/scripts/summarize_matrix.py) and interpretation.json (findings, caveats and
priority status written after inspecting the completed runs). Publishes aggregates only:
the script refuses any key that could carry site IDs, coordinates or predictions.
"""
import json
import sys
from pathlib import Path

SUMMARY = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[1] / "data" / "research_handoff.json"
FORBIDDEN = {"site_id", "sample_id", "longitude", "latitude", "lon", "lat", "score", "block_id", "coordinates"}


def check(o, path="benchmark"):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in FORBIDDEN:
                raise ValueError(f"refusing to publish {path}.{k}")
            check(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            check(v, f"{path}[{i}]")


bench = json.loads((SUMMARY / "site_benchmark.json").read_text())
interp = json.loads((SUMMARY / "interpretation.json").read_text())
bench.update({k: interp[k] for k in ["figures", "findings", "caveats", "paired_spatial", "region_rows", "not_run", "reproducibility"]})
bench["n_experiments"] = len(bench["designs"]["spatial"]["summary"])
check(bench)

data = json.loads(OUT.read_text())
data["benchmark"] = bench
for p in data["priorities"]:
    upd = interp["priorities"].get(p["id"])
    if upd:
        p.update(upd)
data["checks"] = interp.get("checks_prepend", []) + data["checks"]
data["generated"] = bench["generated"]
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes); designs: {', '.join(bench['designs'])}")
