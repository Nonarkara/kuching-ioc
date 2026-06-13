"""
forecast_runner.py — TimesFM probabilistic forecasts for Greater Kuching IOC.

Runs locally on Dr Non's M5 Max. Output is committed to
public/api/forecast.json and served statically (3-tier loader, tier 2/3).

Flood-focused additions (IOC 2.1):
  • 14-day horizon (was 7) — monsoon events build over weeks
  • Per-station rainfall at each of the 6 hydro-station locations
  • Antecedent Moisture Condition (AMC) per station from 14-day history
  • Catchment load index combining p90 forecast + AMC
  • Flood risk band per station × time horizon (6h / 24h / 72h)

Series produced:
  river_discharge  — GloFAS m³/s, aggregate Sarawak River
  rainfall         — daily precipitation, basin centroid
  aqi              — US AQI daily max
  pm25             — PM2.5 µg/m³ daily mean
  station_{id}_rainfall  — per-station daily precipitation (6 stations)

Run:  scripts/forecast/.venv/bin/python scripts/forecast/forecast_runner.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

# ── Configuration ──────────────────────────────────────────────────────────

LAT, LON = 1.5533, 110.3592            # Sarawak River @ Kuching (basin centroid)
HORIZON  = 14                           # days ahead (was 7; monsoon needs 2 weeks)
MODEL_ID = "google/timesfm-2.0-500m-pytorch"
OUTPUT_PATH = (
    Path(__file__).resolve().parents[2] / "public" / "api" / "forecast.json"
)
HTTP_TIMEOUT = 30

# Hydro stations — same coords as SARAWAK_HYDRO_STATIONS in server.mjs
HYDRO_STATIONS = [
    {"id": "batu-kitang", "name": "Batu Kitang",       "lat": 1.485, "lon": 110.295,
     "basin": "Sg. Sarawak Kiri",    "lag_h": 0,  "drain_area_km2": 245},
    {"id": "buntal",      "name": "Buntal",             "lat": 1.717, "lon": 110.385,
     "basin": "Sg. Sarawak (tidal)", "lag_h": 6,  "drain_area_km2": 1200},
    {"id": "siniawan",    "name": "Siniawan",           "lat": 1.395, "lon": 110.215,
     "basin": "Sg. Sarawak Kanan",   "lag_h": 2,  "drain_area_km2": 180},
    {"id": "kpg-git",     "name": "Kpg. Git",          "lat": 1.336, "lon": 110.196,
     "basin": "Sg. Sarawak Kanan",   "lag_h": 5,  "drain_area_km2": 95},
    {"id": "maong",       "name": "Sg. Maong",         "lat": 1.539, "lon": 110.336,
     "basin": "Sg. Maong (urban)",   "lag_h": 0,  "drain_area_km2": 42},
    {"id": "bedup",       "name": "Sg. Bedup",         "lat": 1.211, "lon": 110.553,
     "basin": "Sg. Sadong trib.",    "lag_h": 3,  "drain_area_km2": 320},
]

# AMC thresholds (adjusted for tropical Kuching, ~4000mm/yr average).
# Standard CN-method thresholds are too low for a region averaging 77mm/week.
AMC_I_MAX  = 100   # mm/14d  dry: catchment can absorb rain
AMC_II_MAX = 200   # mm/14d  normal: standard monsoon moisture
# > 200mm/14d = AMC III: saturated, 2-3x normal flood response

REF_AMC    = 200.0  # mm/14d normalisation denominator
REF_6H_MM  =  40.0  # mm in 6h that is "heavy" on a fresh catchment
REF_24H_MM =  80.0
REF_72H_MM = 160.0

LOAD_BANDS = [
    (0.30, "normal"),
    (0.50, "watch"),
    (0.70, "alert"),
    (1.00, "warning"),
]


# ── HTTP helpers ───────────────────────────────────────────────────────────

def _get(url: str, params: dict, retries: int = 4) -> dict:
    last = None
    for attempt in range(retries):
        r = requests.get(url, params=params, timeout=HTTP_TIMEOUT)
        if r.status_code == 429:
            wait = 5 * (attempt + 1)
            print(f"    429 — backing off {wait}s (attempt {attempt+1}/{retries})", flush=True)
            time.sleep(wait)
            last = r
            continue
        r.raise_for_status()
        return r.json()
    if last is not None:
        last.raise_for_status()
    raise RuntimeError("unreachable")


# ── History fetchers ───────────────────────────────────────────────────────

def fetch_river_discharge() -> list[float]:
    j = _get(
        "https://flood-api.open-meteo.com/v1/flood",
        {"latitude": LAT, "longitude": LON,
         "daily": "river_discharge",
         "past_days": 92, "forecast_days": 0,
         "models": "seamless_v4"},
    )
    vals = j.get("daily", {}).get("river_discharge", []) or []
    return [float(x) for x in vals if x is not None]


def fetch_archive_rainfall(lat: float, lon: float, days: int = 120) -> list[float]:
    """Daily precipitation from archive API (lags ~5d; more reliable than forecast past_days)."""
    end   = date.today() - timedelta(days=6)
    start = end - timedelta(days=days)
    j = _get(
        "https://archive-api.open-meteo.com/v1/archive",
        {"latitude": lat, "longitude": lon,
         "daily": "precipitation_sum",
         "start_date": start.isoformat(), "end_date": end.isoformat(),
         "timezone": "Asia/Kuching"},
    )
    vals = j.get("daily", {}).get("precipitation_sum", []) or []
    return [float(x) for x in vals if x is not None]


def _hourly_to_daily(times: list[str], vals: list, agg: str) -> list[float]:
    buckets: dict[str, list[float]] = {}
    for t, v in zip(times, vals):
        if v is None:
            continue
        buckets.setdefault(t[:10], []).append(float(v))
    out = []
    for day in sorted(buckets):
        series = buckets[day]
        out.append(max(series) if agg == "max" else sum(series) / len(series))
    return out


def fetch_aqi() -> list[float]:
    j = _get(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {"latitude": LAT, "longitude": LON,
         "hourly": "us_aqi",
         "past_days": 60, "forecast_days": 0,
         "timezone": "Asia/Kuching"},
    )
    h = j.get("hourly", {})
    return _hourly_to_daily(h.get("time", []), h.get("us_aqi", []), "max")


def fetch_pm25() -> list[float]:
    j = _get(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {"latitude": LAT, "longitude": LON,
         "hourly": "pm2_5",
         "past_days": 60, "forecast_days": 0,
         "timezone": "Asia/Kuching"},
    )
    h = j.get("hourly", {})
    return _hourly_to_daily(h.get("time", []), h.get("pm2_5", []), "mean")


# ── AMC + flood risk ───────────────────────────────────────────────────────

def compute_amc(history: list[float]) -> dict:
    """Antecedent Moisture Condition from last 14 days of rainfall."""
    window = [v for v in history[-14:] if v is not None]
    total  = round(sum(window), 1)
    if total < AMC_I_MAX:
        cls, label = "I",   "Dry"
        note = "Low runoff risk; catchment can absorb rain."
    elif total < AMC_II_MAX:
        cls, label = "II",  "Normal"
        note = "Moderate runoff; standard drainage performance."
    else:
        cls, label = "III", "Saturated"
        note = "High runoff risk — soil near field capacity. Same storm causes 2–3× normal flood response."
    return {"total_mm14d": total, "class": cls, "label": label, "note": note}


def _load_to_band(load: float) -> str:
    for threshold, band in LOAD_BANDS:
        if load <= threshold:
            return band
    return "warning"


def load_to_pct(load: float) -> int:
    """Sigmoid approximation: load=0→5%, 0.5→30%, 1.0→70%, 1.5→90%."""
    p = 1 / (1 + 2.718 ** (-5.0 * (load - 0.5)))
    return min(99, max(1, round(p * 100)))


def compute_flood_risk(station: dict, amc: dict, forecast_p90: list[float]) -> dict:
    """
    Per-station flood risk at 6h / 24h / 72h horizons.

    Load index (dimensionless):
        load = 0.40 × (p90_cumulative_mm / REF_MM) + 0.60 × (amc14d / REF_AMC)

    AMC weight is higher because catchment saturation is the primary driver
    of flash floods in Kuching — a storm on a saturated basin produces 3×
    the peak flow of the same storm on a dry basin.
    """
    amc_mm   = amc["total_mm14d"]
    amc_frac = min(amc_mm / REF_AMC, 1.5)    # cap at 1.5 for extreme saturation

    p90 = [max(0.0, v) for v in (forecast_p90 or [])]
    cum1 = sum(p90[:1])
    cum4 = sum(p90[:4])

    rain_6h  = cum1 * (6 / 24)
    load_6h  = 0.40 * (rain_6h / REF_6H_MM)  + 0.60 * amc_frac
    load_24h = 0.40 * (cum1    / REF_24H_MM)  + 0.60 * amc_frac
    # Upstream stations (lag > 0) get a small additional risk at 72h because
    # their runoff arrives at downstream gauges with a delay.
    lag_boost = min(station["lag_h"] / 24.0 * 0.05, 0.15)
    load_72h  = 0.40 * (cum4    / REF_72H_MM) + 0.60 * amc_frac + lag_boost

    return {
        "cumulative_p90_mm": {
            "day1": round(cum1, 1),
            "day4": round(cum4, 1),
        },
        "risk_6h":  {"band": _load_to_band(load_6h),  "load": round(load_6h, 2),  "pct": load_to_pct(load_6h)},
        "risk_24h": {"band": _load_to_band(load_24h), "load": round(load_24h, 2), "pct": load_to_pct(load_24h)},
        "risk_72h": {"band": _load_to_band(load_72h), "load": round(load_72h, 2), "pct": load_to_pct(load_72h)},
    }


# ── TimesFM ────────────────────────────────────────────────────────────────

def load_model():
    try:
        import timesfm
    except ImportError:
        print("ERROR: pip install -r scripts/forecast/requirements.txt", file=sys.stderr)
        sys.exit(1)
    print(f"Loading {MODEL_ID} (first run downloads ~2GB)...", flush=True)
    return timesfm.TimesFm(
        hparams=timesfm.TimesFmHparams(
            backend="cpu",
            per_core_batch_size=32,
            horizon_len=HORIZON,
            num_layers=50,
            use_positional_embedding=False,
            context_len=2048,
        ),
        checkpoint=timesfm.TimesFmCheckpoint(huggingface_repo_id=MODEL_ID),
    )


def forecast_one(tfm, series: list[float], decimals: int) -> dict:
    point_forecast, quantile_forecast = tfm.forecast(inputs=[series], freq=[0])
    qf = quantile_forecast[0]

    def col(q: float) -> list[float]:
        if q in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
            idx = int(round(q * 10))
            return [round(float(row[idx]), decimals) for row in qf]
        lo, hi = (0.2, 0.3) if q == 0.25 else (0.7, 0.8)
        lo_i, hi_i = int(round(lo * 10)), int(round(hi * 10))
        return [round(float(row[lo_i] + (row[hi_i] - row[lo_i]) * 0.5), decimals)
                for row in qf]

    clamp = lambda arr: [max(0.0, v) for v in arr]
    median = col(0.5)
    return {
        "median":    clamp(median),
        "quantiles": {
            "p10": clamp(col(0.1)), "p25": clamp(col(0.25)),
            "p50": clamp(median),   "p75": clamp(col(0.75)), "p90": clamp(col(0.9)),
        },
    }


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> int:
    tfm = load_model()

    BASIN_TARGETS = [
        {"key": "river_discharge", "label": "River Discharge", "unit": "m³/s",
         "fetch": fetch_river_discharge, "decimals": 1},
        {"key": "rainfall",        "label": "Rainfall",        "unit": "mm/day",
         "fetch": lambda: fetch_archive_rainfall(LAT, LON), "decimals": 1},
        {"key": "aqi",             "label": "Air Quality (US AQI)", "unit": "AQI",
         "fetch": fetch_aqi,     "decimals": 0},
        {"key": "pm25",            "label": "PM2.5",           "unit": "µg/m³",
         "fetch": fetch_pm25,    "decimals": 1},
    ]

    series_out: dict[str, dict] = {}
    basin_rainfall_history: list[float] = []

    # ── Basin series ──────────────────────────────────────────────────────
    for t in BASIN_TARGETS:
        key = t["key"]
        print(f"  [{key}] fetching...", flush=True)
        try:
            series = t["fetch"]()
        except Exception as e:
            print(f"  [{key}] skip — {e}")
            continue
        if len(series) < 24:
            print(f"  [{key}] skip — only {len(series)} pts")
            continue
        if key == "rainfall":
            basin_rainfall_history = series
        time.sleep(2)
        print(f"  [{key}] forecasting {len(series)} pts → {HORIZON}d...", flush=True)
        result = forecast_one(tfm, series, t["decimals"])
        result["label"]     = t["label"]
        result["unit"]      = t["unit"]
        result["lastValue"] = round(series[-1], t["decimals"])
        result["history"]   = [round(v, t["decimals"]) for v in series[-21:]]
        result["source"]    = "timesfm"
        series_out[key] = result
        print(f"  [{key}] ✓  now={result['lastValue']}  "
              f"p50@{HORIZON}d={result['quantiles']['p50'][-1]}  "
              f"p90@{HORIZON}d={result['quantiles']['p90'][-1]}")

    # ── Per-station series + flood risk ───────────────────────────────────
    station_flood: dict[str, dict] = {}
    print("\n  [stations] fetching rainfall at 6 hydro-station locations...", flush=True)

    for stn in HYDRO_STATIONS:
        sid = stn["id"]
        print(f"  [{sid}] fetching...", flush=True)
        try:
            stn_history = fetch_archive_rainfall(stn["lat"], stn["lon"], days=21)
        except Exception as e:
            print(f"  [{sid}] skip — {e}")
            continue
        if not stn_history:
            print(f"  [{sid}] skip — empty history")
            continue
        time.sleep(2)
        print(f"  [{sid}] forecasting {len(stn_history)} pts → {HORIZON}d...", flush=True)
        result = forecast_one(tfm, stn_history, 1)
        result["label"]     = f"{stn['name']} Rainfall"
        result["unit"]      = "mm/day"
        result["lastValue"] = round(stn_history[-1], 1)
        result["history"]   = [round(v, 1) for v in stn_history[-21:]]
        result["source"]    = "timesfm"
        series_out[f"station_{sid}_rainfall"] = result

        amc        = compute_amc(stn_history)
        flood_risk = compute_flood_risk(stn, amc, result["quantiles"]["p90"])
        station_flood[sid] = {
            "id":             sid,
            "name":           stn["name"],
            "basin":          stn["basin"],
            "lag_h":          stn["lag_h"],
            "drain_area_km2": stn["drain_area_km2"],
            "amc":            amc,
            **flood_risk,
        }
        print(f"  [{sid}] ✓  AMC={amc['class']} ({amc['total_mm14d']}mm/14d)  "
              f"risk 6h={flood_risk['risk_6h']['band']}  "
              f"24h={flood_risk['risk_24h']['band']}  "
              f"72h={flood_risk['risk_72h']['band']}")

    # ── Write ─────────────────────────────────────────────────────────────
    payload = {
        "asOf":      datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "model":     MODEL_ID,
        "horizon":   HORIZON,
        "frequency": "D",
        "site":      "Greater Kuching · Sarawak River @ Kuching",
        "series":    series_out,
        "stations":  station_flood,
        "basin_amc": compute_amc(basin_rainfall_history) if basin_rainfall_history else None,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"\nwrote {OUTPUT_PATH}  ({len(series_out)} series, {len(station_flood)} stations)")
    return 0 if series_out else 1


if __name__ == "__main__":
    sys.exit(main())
