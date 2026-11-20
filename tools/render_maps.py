"""Render the rebuilt 2024 relative-suitability surfaces as PNG previews for the Plan page.

Usage: python tools/render_maps.py /path/to/handoff/runs/maps
Each 0.05 deg surface is averaged to 0.25 deg and shown as its within-map percentile (scores of
different models are not on one calibrated scale), with a one-hue blue ramp, no-data transparent.
No observation, coordinate or site is drawn.
"""
import sys
from pathlib import Path

import numpy as np
import rasterio
from matplotlib.colors import LinearSegmentedColormap
from PIL import Image
from scipy.stats import rankdata

RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
CMAP = LinearSegmentedColormap.from_list('blue', RAMP)
MAPS = {'ae2024_AlphaEarth64__GLM': 'map_ae_glm.png', 'clim2024_BioClim19__RF': 'map_clim_rf.png',
        'clim2024_BioClim19__BRT': 'map_clim_brt.png', 'ae2024_AlphaEarth64__RF': 'map_ae_rf.png'}


def main(src):
    out = Path(__file__).resolve().parents[1]/'assets'/'maps'
    out.mkdir(parents=True, exist_ok=True)
    for stem, name in MAPS.items():
        with rasterio.open(Path(src)/f'{stem}.tif') as r:
            a = r.read(1).astype(np.float64)
        a[a < 0] = np.nan
        h, w = a.shape[0] // 5, a.shape[1] // 5
        with np.errstate(all='ignore'):
            b = np.nanmean(a[:h * 5, :w * 5].reshape(h, 5, w, 5), axis=(1, 3))
        ok = np.isfinite(b)
        pct = np.full(b.shape, np.nan)
        pct[ok] = (rankdata(b[ok], method='average') - 1) / max(ok.sum() - 1, 1)   # ties share one percentile
        rgba = (CMAP(np.nan_to_num(pct)) * 255).astype(np.uint8)
        rgba[~ok, 3] = 0
        Image.fromarray(rgba[:600]).save(out/name, optimize=True)   # rows to 65 S; Antarctica has no surface
        print(name, b.shape, int(ok.sum()), 'cells at 0.25 deg')


if __name__ == '__main__':
    main(sys.argv[1])
