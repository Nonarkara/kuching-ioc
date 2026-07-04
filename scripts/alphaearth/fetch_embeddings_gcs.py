#!/usr/bin/env python3
"""
Fetch AlphaEarth Satellite Embeddings for the Kota Padawan growth ring AOI
directly from the public GCS bucket — bypasses Earth Engine entirely.

Each year is a global 8192×8192-pixel tile collection at 10 m resolution in
the file's native UTM zone (UTM 49N for Kuching). The tile files are 1.5–3.4 GB
each but they're COGs (Cloud Optimized GeoTIFFs), so rasterio + /vsigs/ pulls
only the AOI's byte ranges via HTTP — typically 5–20 MB per year per AOI.

Auth uses gcloud Application Default Credentials. Billing uses
`GS_USER_PROJECT` (requester-pays).

Usage:
    scripts/alphaearth/.venv/bin/python scripts/alphaearth/fetch_embeddings_gcs.py \
        --aoi kuching_padawan --years 2017 2024 --user-project airdnd-488809
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import pyarrow.parquet as pq
    import pandas as pd
    import rasterio
    from rasterio.windows import Window
    from rasterio.warp import transform_bounds
except ImportError as e:
    print(f"missing dep: {e}. uv pip install pyarrow pandas rasterio", file=sys.stderr)
    sys.exit(2)


AOIS = {
    "kuching_padawan": (110.27, 1.39, 110.40, 1.49),  # west, south, east, north
}


def adc_path() -> str:
    p = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"
    if not p.exists():
        raise SystemExit(f"no ADC at {p}. Run: gcloud auth application-default login")
    return str(p)


def find_tiles(index_parquet: Path, year: int, bbox: tuple) -> list[str]:
    """Return GCS paths for the tile(s) covering the AOI in the given year.
    Picks the southernmost tile when the AOI straddles a tile boundary —
    keeps the pipeline one-tile-per-year (we lose at most a ~1 km strip on
    the north edge, which is acceptable for the growth-ring story)."""
    w, s, e, n = bbox
    df = pq.read_table(index_parquet).to_pandas()
    mask = (
        (df.year == year)
        & (df.wgs84_west < e) & (df.wgs84_east > w)
        & (df.wgs84_south < n) & (df.wgs84_north > s)
    )
    hits = df[mask].sort_values("wgs84_south")
    if hits.empty:
        raise RuntimeError(f"no AlphaEarth tile for year {year} bbox {bbox}")
    return [hits.iloc[0].path]


def vsigs(gcs_path: str) -> str:
    """Convert gs://bucket/key → /vsigs/bucket/key for GDAL."""
    return "/vsigs/" + gcs_path.removeprefix("gs://")


def fetch_window(tile_path: str, bbox_wgs84: tuple, out_path: Path) -> None:
    w, s, e, n = bbox_wgs84
    with rasterio.open(vsigs(tile_path)) as src:
        # Translate AOI WGS84 bbox to the dataset's UTM CRS.
        utm_w, utm_s, utm_e, utm_n = transform_bounds("EPSG:4326", src.crs, w, s, e, n, densify_pts=21)
        # Clip to the tile's UTM bounds. AOI may extend beyond a single tile
        # at the edges; we keep the intersection (the growth-ring story
        # tolerates ~1 km truncation at the north). Normalize axis order —
        # rasterio's bottom/top reflect the affine direction, not necessarily
        # south/north values.
        b = src.bounds
        tw, te = min(b.left, b.right), max(b.left, b.right)
        ts, tn = min(b.bottom, b.top), max(b.bottom, b.top)
        utm_w, utm_s = max(utm_w, tw), max(utm_s, ts)
        utm_e, utm_n = min(utm_e, te), min(utm_n, tn)
        if utm_w >= utm_e or utm_s >= utm_n:
            raise RuntimeError(f"AOI does not intersect tile bounds {(tw,ts,te,tn)}")
        # Compute pixel window directly via inverse affine — robust to whichever
        # y-direction the tile's transform uses. Map all four AOI corners and
        # take the row/col extent.
        inv = ~src.transform
        corners = [(utm_w, utm_s), (utm_w, utm_n), (utm_e, utm_s), (utm_e, utm_n)]
        cols, rows = zip(*[inv * c for c in corners])
        c0, c1 = max(0, int(round(min(cols)))), min(src.width, int(round(max(cols))))
        r0, r1 = max(0, int(round(min(rows)))), min(src.height, int(round(max(rows))))
        win = Window(col_off=c0, row_off=r0, width=c1 - c0, height=r1 - r0)
        # Read in chunks of 8 bands — avoids HTTP timeout on a 64-band COG.
        import numpy as np
        chunks = []
        for start in range(1, src.count + 1, 8):
            end = min(start + 7, src.count)
            chunks.append(src.read(list(range(start, end + 1)), window=win))
        arr = np.concatenate(chunks, axis=0)
        win_transform = rasterio.windows.transform(win, src.transform)
        profile = src.profile.copy()
        profile.update({
            "height": int(win.height),
            "width": int(win.width),
            "transform": win_transform,
            "compress": "lzw",
            "tiled": True,
        })
        with rasterio.open(out_path, "w", **profile) as dst:
            dst.write(arr)
        print(f"    ✓ {out_path.name}  {arr.shape}  ({out_path.stat().st_size/1024:.0f} KB)")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--aoi", choices=sorted(AOIS), required=True)
    p.add_argument("--years", nargs="+", type=int, required=True)
    p.add_argument("--user-project", required=True,
                   help="GCP project ID with active billing (requester-pays)")
    p.add_argument("--index", type=Path,
                   default=Path(__file__).resolve().parent / "raw" / "aef_index.parquet")
    p.add_argument("--out", type=Path,
                   default=Path(__file__).resolve().parent / "raw")
    args = p.parse_args()

    bbox = AOIS[args.aoi]
    args.out.mkdir(parents=True, exist_ok=True)

    # GDAL/VSI env: requester-pays billing + ADC auth (no bearer header — GDAL
    # picks up the refresh token from GOOGLE_APPLICATION_CREDENTIALS itself).
    os.environ["GS_USER_PROJECT"] = args.user_project
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = adc_path()
    os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")
    os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "YES")

    if not args.index.exists():
        raise SystemExit(f"index not found at {args.index}. Download with:\n"
                         f"  gsutil -u {args.user_project} cp gs://alphaearth_foundations/satellite_embedding/v1/annual/aef_index.parquet {args.index}")

    for yr in args.years:
        out_path = args.out / f"alphaearth-{args.aoi}-{yr}.tif"
        if out_path.exists():
            print(f"  {yr} already exists at {out_path}, skipping")
            continue
        print(f"  {yr}: finding tile...")
        tile = find_tiles(args.index, yr, bbox)[0]
        print(f"  {yr}: window-reading {tile.split('/')[-1]}")
        fetch_window(tile, bbox, out_path)

    print(f"\nDone → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
