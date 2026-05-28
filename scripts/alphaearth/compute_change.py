#!/usr/bin/env python3
"""
Compute per-pixel L2 distance between two AlphaEarth GeoTIFFs (year A vs year B)
and write a colourised PNG + bounds JSON sidecar that the dashboard renders as a
Leaflet imageOverlay. Cloned from the Chonburi pipeline (generic — only paths
differ).

Usage:
    scripts/alphaearth/.venv/bin/python scripts/alphaearth/compute_change.py \
        --year-a scripts/alphaearth/raw/alphaearth-kuching_padawan-2017.tif \
        --year-b scripts/alphaearth/raw/alphaearth-kuching_padawan-2024.tif \
        --out public/data/alphaearth/growth-padawan-2017-2024.png
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("numpy missing. uv pip install -r scripts/alphaearth/requirements.txt", file=sys.stderr)
    sys.exit(2)
try:
    import rasterio
except ImportError:
    print("rasterio missing. uv pip install -r scripts/alphaearth/requirements.txt", file=sys.stderr)
    sys.exit(2)
try:
    from PIL import Image
except ImportError:
    print("Pillow missing. uv pip install -r scripts/alphaearth/requirements.txt", file=sys.stderr)
    sys.exit(2)

# Amber → red ramp on the dashboard's --amber token; low change transparent so
# the basemap reads through. One accent family only (Visual-DNA rule #1).
RAMP = [
    (0.00, (245, 158, 11, 0)),
    (0.50, (245, 158, 11, 60)),
    (0.75, (245, 158, 11, 140)),
    (0.90, (234, 124, 0, 200)),
    (1.00, (220, 60, 0, 240)),
]


def ramp_color(t: float):
    for (t0, c0), (t1, c1) in zip(RAMP, RAMP[1:]):
        if t <= t1:
            k = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(int(round(c0[i] + k * (c1[i] - c0[i]))) for i in range(4))
    return RAMP[-1][1]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--year-a", type=Path, required=True)
    p.add_argument("--year-b", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--p-low", type=float, default=50.0)
    p.add_argument("--p-high", type=float, default=99.0)
    args = p.parse_args()

    with rasterio.open(args.year_a) as sa, rasterio.open(args.year_b) as sb:
        if sa.shape != sb.shape:
            raise SystemExit(f"Shape mismatch: {sa.shape} vs {sb.shape}")
        bounds = sa.bounds
        a = sa.read().astype(np.float32)
        b = sb.read().astype(np.float32)

    diff = a - b
    l2 = np.sqrt(np.einsum("bij,bij->ij", diff, diff))
    p_lo = float(np.percentile(l2, args.p_low))
    p_hi = float(np.percentile(l2, args.p_high))
    t = np.clip((l2 - p_lo) / max(p_hi - p_lo, 1e-9), 0.0, 1.0)

    table = np.array([ramp_color(i / 255.0) for i in range(256)], dtype=np.uint8)
    rgba = table[(t * 255).astype(np.uint8)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(args.out, "PNG", optimize=True)

    ya = int((re.search(r"(\d{4})", args.year_a.stem) or [0, 0])[1]) if re.search(r"(\d{4})", args.year_a.stem) else 0
    yb = int((re.search(r"(\d{4})", args.year_b.stem) or [0, 0])[1]) if re.search(r"(\d{4})", args.year_b.stem) else 0

    sidecar = args.out.with_suffix(".json")
    sidecar.write_text(json.dumps({
        "image": args.out.name,
        "bounds": {"west": bounds.left, "south": bounds.bottom,
                   "east": bounds.right, "north": bounds.top},
        "years": {"a": ya, "b": yb},
        "stats": {"p_low": p_lo, "p_high": p_hi, "max_l2": float(l2.max()),
                  "median_l2": float(np.median(l2)), "pixel_count": int(t.size)},
        "dataset": "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL",
    }, indent=2))

    print(f"wrote {args.out} ({args.out.stat().st_size / 1024:.0f} KB) + {sidecar.name}")
    print(f"  L2 0 → {l2.max():.3f}  median {np.median(l2):.3f}  ramp p{args.p_low:.0f}={p_lo:.3f}→p{args.p_high:.0f}={p_hi:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
