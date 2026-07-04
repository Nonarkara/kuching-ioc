#!/usr/bin/env python3
"""
compute_impervious.py — Extract impervious surface fraction from AlphaEarth embeddings.

Uses the 2024 AlphaEarth GeoTIFF (64-band, 10m resolution) to classify each
pixel as urban/impervious vs vegetated/permeable using reference-pixel cosine
similarity. Outputs:

  public/data/alphaearth/impervious-2024.png   — RGBA overlay (transparent=permeable,
                                                   red=impervious) for the map
  public/data/alphaearth/impervious.json        — per-zone aggregate statistics

Reference pixel selection:
  Urban:  Kuching South commercial core (1.542°N, 110.336°E) — dense impervious
  Forest: Western Padawan interior   (1.420°N, 110.275°E) — primary forest, permeable

Zones for JSON output match the 6 hydro-station sub-catchments (simplified
bounding boxes within our AOI: west=110.27, south=1.39, east=110.40, north=1.49).

Usage:
    scripts/alphaearth/.venv/bin/python scripts/alphaearth/compute_impervious.py \\
        --tif scripts/alphaearth/raw/alphaearth-kuching_padawan-2024.tif
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("numpy missing. uv pip install -r scripts/alphaearth/requirements.txt", file=sys.stderr)
    sys.exit(2)
try:
    import rasterio
    from rasterio.warp import transform_bounds as rasterio_transform_bounds
except ImportError:
    print("rasterio missing.", file=sys.stderr)
    sys.exit(2)
try:
    from PIL import Image
except ImportError:
    print("Pillow missing.", file=sys.stderr)
    sys.exit(2)

# ── Reference pixel coordinates (WGS84) ───────────────────────────────────

# Urban reference: MBKS commercial zone along Jalan Song / Stutong
# — dense shophouse/commercial belt, virtually 100% impervious
URBAN_REFS = [
    (1.542, 110.336),   # Sg. Maong corridor (Stutong commercial)
    (1.535, 110.330),   # BDC industrial zone
    (1.530, 110.340),   # Batu Kawa commercial strip
]

# Forest/permeable reference: western Padawan interior forest
# — old-growth forest, >95% permeable
FOREST_REFS = [
    (1.420, 110.275),   # Western Padawan forest
    (1.410, 110.280),   # Ulu Padawan
    (1.430, 110.270),   # Forest reserve edge
]

# ── Sub-catchment zones (within our AOI) ──────────────────────────────────
# Bounding boxes cropped to AOI (west=110.27, south=1.39, east=110.40, north=1.49).
# Only zones with meaningful overlap are included.
ZONES = [
    {
        "id":      "maong",
        "name":    "Sg. Maong Urban Core",
        "station": "maong",
        "bounds":  {"south": 1.480, "north": 1.490, "west": 110.300, "east": 110.400},
        "note":    "MBKS commercial/residential belt draining to Sg. Maong",
    },
    {
        "id":      "batu-kawa",
        "name":    "Batu Kawa Growth Zone",
        "station": "batu-kitang",
        "bounds":  {"south": 1.430, "north": 1.490, "west": 110.270, "east": 110.330},
        "note":    "Padawan peri-urban expansion draining to Sg. Sarawak Kiri",
    },
    {
        "id":      "padawan-core",
        "name":    "Padawan Rural Core",
        "station": "siniawan",
        "bounds":  {"south": 1.390, "north": 1.430, "west": 110.270, "east": 110.370},
        "note":    "Mixed agriculture/forest, lower impervious baseline",
    },
    {
        "id":      "kota-padawan",
        "name":    "Kota Padawan Township",
        "station": "batu-kitang",
        "bounds":  {"south": 1.460, "north": 1.490, "west": 110.350, "east": 110.400},
        "note":    "Emerging township in the Padawan growth ring",
    },
]

# Impervious → RGBA ramp: transparent (permeable) → amber → red (impervious).
# Matches Visual-DNA rule #1 (one amber accent only).
RAMP = [
    (0.00, (245, 158, 11,   0)),   # 0% impervious: transparent
    (0.30, (245, 158, 11,  30)),   # 30%: faint amber glow
    (0.60, (245, 100,  0, 120)),   # 60%: mid amber-red
    (0.85, (220,  40,  0, 200)),   # 85%: strong red
    (1.00, (200,  20,  0, 240)),   # 100% impervious: full red
]


def ramp_color(t: float) -> tuple:
    for (t0, c0), (t1, c1) in zip(RAMP, RAMP[1:]):
        if t <= t1:
            k = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(int(round(c0[i] + k * (c1[i] - c0[i]))) for i in range(4))
    return RAMP[-1][1]


def latlon_to_pixel(src: rasterio.DatasetReader, lat: float, lon: float) -> tuple[int, int]:
    """Convert WGS84 lat/lon to pixel (col, row) in the UTM raster, with clamp."""
    from pyproj import Transformer
    tf = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
    x, y = tf.transform(lon, lat)
    col, row = ~src.transform * (x, y)
    col = int(max(0, min(src.width  - 1, round(col))))
    row = int(max(0, min(src.height - 1, round(row))))
    return col, row


def latlon_box_to_pixel_box(
    src: rasterio.DatasetReader,
    south: float, north: float, west: float, east: float
) -> tuple[int, int, int, int]:
    """Convert WGS84 bounding box to pixel row/col range."""
    from pyproj import Transformer
    tf = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
    corners = [
        tf.transform(west,  south),
        tf.transform(east,  south),
        tf.transform(west,  north),
        tf.transform(east,  north),
    ]
    cols = [~src.transform * c for c in corners]
    col_min = int(max(0, min(c[0] for c in cols)))
    col_max = int(min(src.width,  max(c[0] for c in cols)))
    row_min = int(max(0, min(c[1] for c in cols)))
    row_max = int(min(src.height, max(c[1] for c in cols)))
    return col_min, col_max, row_min, row_max


def extract_reference_embedding(arr: np.ndarray, src: rasterio.DatasetReader,
                                  coords: list[tuple]) -> np.ndarray:
    """Mean embedding vector over a list of (lat, lon) reference points."""
    vecs = []
    for lat, lon in coords:
        col, row = latlon_to_pixel(src, lat, lon)
        vecs.append(arr[:, row, col])
    v = np.mean(vecs, axis=0)
    norm = np.linalg.norm(v)
    return v / norm if norm > 0 else v


def cosine_similarity_map(arr: np.ndarray, ref: np.ndarray) -> np.ndarray:
    """Per-pixel cosine similarity to a reference embedding vector."""
    # arr: [64, H, W];  ref: [64]
    ref_norm = ref / (np.linalg.norm(ref) + 1e-9)
    flat = arr.reshape(arr.shape[0], -1)                   # [64, H*W]
    norms = np.linalg.norm(flat, axis=0, keepdims=True)    # [1, H*W]
    flat_normed = flat / (norms + 1e-9)
    sim = (ref_norm @ flat_normed).reshape(arr.shape[1], arr.shape[2])
    return sim.astype(np.float32)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--tif", type=Path, default=Path("scripts/alphaearth/raw/alphaearth-kuching_padawan-2024.tif"))
    args = p.parse_args()

    if not args.tif.exists():
        print(f"ERROR: TIF not found: {args.tif}", file=sys.stderr)
        print("Run fetch_embeddings_gcs.py --years 2024 first.", file=sys.stderr)
        return 1

    out_dir = Path("public/data/alphaearth")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_png  = out_dir / "impervious-2024.png"
    out_json = out_dir / "impervious.json"

    print(f"Loading {args.tif} ...", flush=True)
    with rasterio.open(args.tif) as src:
        print(f"  {src.width}×{src.height} px, {src.count} bands, CRS={src.crs}", flush=True)
        arr = src.read().astype(np.float32)   # [64, H, W]

        # WGS84 bounds for Leaflet placement
        wgs84_w, wgs84_s, wgs84_e, wgs84_n = rasterio_transform_bounds(
            src.crs, "EPSG:4326",
            src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top,
            densify_pts=21,
        )

        print("  Extracting reference embeddings...", flush=True)
        try:
            urban_ref  = extract_reference_embedding(arr, src, URBAN_REFS)
            forest_ref = extract_reference_embedding(arr, src, FOREST_REFS)
        except Exception as e:
            print(f"ERROR extracting references: {e}", file=sys.stderr)
            return 1

        print("  Computing similarity maps...", flush=True)
        sim_urban  = cosine_similarity_map(arr, urban_ref)   # high = urban-like
        sim_forest = cosine_similarity_map(arr, forest_ref)  # high = forest-like

        # Impervious fraction: fraction of urban similarity in the urban+forest total.
        # Values near 1 = impervious; near 0 = permeable/vegetated.
        denom = sim_urban + sim_forest + 1e-9
        impervious = np.clip(sim_urban / denom, 0.0, 1.0)

        print(f"  impervious: min={impervious.min():.3f}  "
              f"mean={impervious.mean():.3f}  max={impervious.max():.3f}", flush=True)

        # ── Zone statistics ──────────────────────────────────────────────
        print("  Computing per-zone statistics...", flush=True)
        zone_stats = []
        for zone in ZONES:
            b = zone["bounds"]
            c0, c1, r0, r1 = latlon_box_to_pixel_box(
                src, b["south"], b["north"], b["west"], b["east"]
            )
            if c1 <= c0 or r1 <= r0:
                print(f"  [{zone['id']}] outside AOI — skip")
                continue
            patch = impervious[r0:r1, c0:c1]
            mean_if = float(patch.mean())
            p75_if  = float(np.percentile(patch, 75))
            zone_stats.append({
                "id":                  zone["id"],
                "name":                zone["name"],
                "station":             zone["station"],
                "note":                zone["note"],
                "impervious_fraction": round(mean_if, 3),
                "impervious_p75":      round(p75_if,  3),
                "pixel_count":         int(patch.size),
            })
            print(f"  [{zone['id']}] mean={mean_if:.3f}  p75={p75_if:.3f}  "
                  f"pixels={patch.size}")

        # ── PNG output ───────────────────────────────────────────────────
        print(f"  Writing {out_png} ...", flush=True)
        table = np.array([ramp_color(i / 255.0) for i in range(256)], dtype=np.uint8)
        idx   = (impervious * 255).astype(np.uint8)
        rgba  = table[idx]
        Image.fromarray(rgba, mode="RGBA").save(out_png, "PNG", optimize=True)
        print(f"  {out_png.stat().st_size / 1024:.0f} KB written")

        # ── JSON sidecar ──────────────────────────────────────────────────
        sidecar = {
            "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "year": 2024,
            "dataset": "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL",
            "method": "cosine-similarity reference-pixel classification",
            "image": "impervious-2024.png",
            "bounds": {
                "west": round(wgs84_w, 6), "south": round(wgs84_s, 6),
                "east": round(wgs84_e, 6), "north": round(wgs84_n, 6),
            },
            "stats": {
                "mean":  round(float(impervious.mean()),  3),
                "p50":   round(float(np.percentile(impervious, 50)), 3),
                "p75":   round(float(np.percentile(impervious, 75)), 3),
                "p90":   round(float(np.percentile(impervious, 90)), 3),
                "max":   round(float(impervious.max()), 3),
            },
            "zones": zone_stats,
        }
        out_json.write_text(json.dumps(sidecar, indent=2))
        print(f"  {out_json} written — {len(zone_stats)} zones")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
