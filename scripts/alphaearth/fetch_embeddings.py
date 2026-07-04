#!/usr/bin/env python3
"""
Fetch AlphaEarth Satellite Embedding rasters for the Kota Padawan growth ring
and export them to local GeoTIFFs. Cloned from the Chonburi pipeline; only the
AOI and output paths differ.

Auth (one-time, interactive — Dr Non runs this):
    scripts/alphaearth/.venv/bin/python -m ee.cli.eecli authenticate
    export EE_PROJECT=<your-earth-engine-project-id>

Usage:
    scripts/alphaearth/.venv/bin/python scripts/alphaearth/fetch_embeddings.py \
        --aoi kuching_padawan --years 2017 2024
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

try:
    import ee
except ImportError:
    print(
        "earthengine-api not installed. Run:\n"
        "  uv pip install -r scripts/alphaearth/requirements.txt\n"
        "Then authenticate:\n"
        "  scripts/alphaearth/.venv/bin/python -m ee.cli.eecli authenticate",
        file=sys.stderr,
    )
    sys.exit(2)

EMBEDDING_DATASET = "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL"

# west, south, east, north — the Kota Padawan growth frontier: Batu Kawa /
# Kota Sentosa / Kota Padawan / Penrissen corridor, the arc where the metro
# story changes. ~14 × 11 km.
AOIS: dict[str, tuple[float, float, float, float]] = {
    "kuching_padawan": (110.27, 1.39, 110.40, 1.49),
}


def init_ee() -> None:
    """Service-account key if present, else the browser-auth credentials."""
    svc_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    project = os.environ.get("EE_PROJECT")
    if svc_json:
        with open(svc_json) as fh:
            email = json.load(fh)["client_email"]
        ee.Initialize(ee.ServiceAccountCredentials(email, svc_json), project=project)
    else:
        ee.Initialize(project=project)


def fetch_year_geotiff(bbox, year: int, out_path: Path, scale: int) -> None:
    west, south, east, north = bbox
    region = ee.Geometry.Rectangle([west, south, east, north])
    img = (
        ee.ImageCollection(EMBEDDING_DATASET)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
        .filterBounds(region)
        .first()
    )
    if img is None:
        raise RuntimeError(f"No embedding image for {year} in bbox {bbox}")
    img = ee.Image(img).clip(region)
    url = img.getDownloadURL(
        {"scale": scale, "region": region, "format": "GEO_TIFF", "crs": "EPSG:4326"}
    )
    print(f"  fetching {year} → {out_path.name}")
    urllib.request.urlretrieve(url, out_path)
    print(f"    {out_path.stat().st_size / 1024:.0f} KB")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--aoi", choices=sorted(AOIS))
    g.add_argument("--bbox", nargs=4, type=float,
                   metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    p.add_argument("--years", nargs="+", type=int, required=True)
    p.add_argument("--out", type=Path,
                   default=Path(__file__).resolve().parent / "raw")
    # 30 m keeps the ~14×11 km AOI under EE's 50 MB single-download limit while
    # staying visually crisp at city-map zoom (12–15). Bump to 40 if rejected.
    p.add_argument("--scale", type=int, default=30)
    args = p.parse_args()

    bbox = AOIS[args.aoi] if args.aoi else tuple(args.bbox)
    args.out.mkdir(parents=True, exist_ok=True)
    init_ee()
    print(f"AOI: {args.aoi or bbox}  scale: {args.scale} m")
    for year in args.years:
        out_path = args.out / f"alphaearth-{args.aoi or 'custom'}-{year}.tif"
        if out_path.exists():
            print(f"  {year} exists, skipping")
            continue
        fetch_year_geotiff(bbox, year, out_path, args.scale)
    print(f"\nDone → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
