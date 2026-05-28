"""
forecast_runner.py — TimesFM probabilistic forecasts for Greater Kuching IOC.

Runs locally on Dr Non's M5 Max. Output is committed to
public/api/forecast.json and served statically by the dashboard (3-tier
loader, tier 2/3). No model inference at request time — GitHub CI cannot
load the 2 GB model, so this is a local-only nightly job.

What it forecasts (the rain-soaked, haze-prone municipality story):
  • river_discharge  — GloFAS river discharge at Sarawak River (m³/s)
  • rainfall         — daily precipitation sum (mm)
  • aqi              — US AQI (daily max)
  • pm25             — PM2.5 (daily mean, µg/m³)

All series come from Open-Meteo's keyless, CORS-free archive+forecast APIs,
which return ~90 days of real history — enough context for TimesFM zero-shot.
Each forecast carries p10/p50/p90 bands; p90 is the worst case, surfaced
alongside the headline (Nonism §12.5).

Run:  scripts/forecast/.venv/bin/python scripts/forecast/forecast_runner.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# Sarawak River at Kuching — same point the dashboard's GloFAS loader uses.
LAT, LON = 1.5533, 110.3592
HORIZON = 7  # days ahead
MODEL_ID = "google/timesfm-2.0-500m-pytorch"
OUTPUT_PATH = (
    Path(__file__).resolve().parents[2] / "public" / "api" / "forecast.json"
)
HTTP_TIMEOUT = 30


# ── Open-Meteo history fetchers (keyless, CORS-free) ───────────────────────

def _get(url: str, params: dict, retries: int = 4) -> dict:
    """GET with exponential backoff — Open-Meteo's free tier 429s on bursts."""
    last = None
    for attempt in range(retries):
        r = requests.get(url, params=params, timeout=HTTP_TIMEOUT)
        if r.status_code == 429:
            wait = 5 * (attempt + 1)
            print(f"    429 — backing off {wait}s (attempt {attempt + 1}/{retries})", flush=True)
            time.sleep(wait)
            last = r
            continue
        r.raise_for_status()
        return r.json()
    if last is not None:
        last.raise_for_status()
    raise RuntimeError("unreachable")


def fetch_river_discharge() -> list[float]:
    """GloFAS daily river discharge, ~90 days history."""
    j = _get(
        "https://flood-api.open-meteo.com/v1/flood",
        {
            "latitude": LAT, "longitude": LON,
            "daily": "river_discharge",
            "past_days": 92, "forecast_days": 0,
            "models": "seamless_v4",
        },
    )
    vals = j.get("daily", {}).get("river_discharge", []) or []
    return [float(x) for x in vals if x is not None]


def fetch_rainfall() -> list[float]:
    """Daily precipitation sum (mm), ~115 days history via the archive API
    (purpose-built for history; lags ~5 days, which is fine for context)."""
    from datetime import date, timedelta
    end = date.today() - timedelta(days=6)
    start = end - timedelta(days=115)
    j = _get(
        "https://archive-api.open-meteo.com/v1/archive",
        {
            "latitude": LAT, "longitude": LON,
            "daily": "precipitation_sum",
            "start_date": start.isoformat(), "end_date": end.isoformat(),
            "timezone": "Asia/Kuching",
        },
    )
    vals = j.get("daily", {}).get("precipitation_sum", []) or []
    return [float(x) for x in vals if x is not None]


def _hourly_to_daily(times: list[str], vals: list, agg: str) -> list[float]:
    """Collapse hourly values to one value per calendar day."""
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
    """US AQI, daily max from hourly, ~60 days history."""
    j = _get(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {
            "latitude": LAT, "longitude": LON,
            "hourly": "us_aqi",
            "past_days": 60, "forecast_days": 0,
            "timezone": "Asia/Kuching",
        },
    )
    h = j.get("hourly", {})
    return _hourly_to_daily(h.get("time", []), h.get("us_aqi", []), "max")


def fetch_pm25() -> list[float]:
    """PM2.5 µg/m³, daily mean from hourly, ~60 days history."""
    j = _get(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {
            "latitude": LAT, "longitude": LON,
            "hourly": "pm2_5",
            "past_days": 60, "forecast_days": 0,
            "timezone": "Asia/Kuching",
        },
    )
    h = j.get("hourly", {})
    return _hourly_to_daily(h.get("time", []), h.get("pm2_5", []), "mean")


TARGETS = [
    {"key": "river_discharge", "label": "River Discharge", "unit": "m³/s",
     "fetch": fetch_river_discharge, "decimals": 1},
    {"key": "rainfall", "label": "Rainfall", "unit": "mm/day",
     "fetch": fetch_rainfall, "decimals": 1},
    {"key": "aqi", "label": "Air Quality (US AQI)", "unit": "AQI",
     "fetch": fetch_aqi, "decimals": 0},
    {"key": "pm25", "label": "PM2.5", "unit": "µg/m³",
     "fetch": fetch_pm25, "decimals": 1},
]


# ── TimesFM ────────────────────────────────────────────────────────────────

def load_model():
    try:
        import timesfm
    except ImportError:
        print("ERROR: pip install -r scripts/forecast/requirements.txt", file=sys.stderr)
        sys.exit(1)
    print(f"Loading {MODEL_ID} (first run downloads ~2GB)...", flush=True)
    tfm = timesfm.TimesFm(
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
    return tfm


def forecast_one(tfm, series: list[float], decimals: int) -> dict:
    """Run TimesFM on one daily series → median + p10/p25/p50/p75/p90 bands."""
    point_forecast, quantile_forecast = tfm.forecast(inputs=[series], freq=[0])
    qf = quantile_forecast[0]  # shape [horizon, 10]: col 0 = mean, 1..9 = deciles

    def col(q: float) -> list[float]:
        if q in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
            idx = int(round(q * 10))
            return [round(float(row[idx]), decimals) for row in qf]
        lo, hi = (0.2, 0.3) if q == 0.25 else (0.7, 0.8)
        lo_i, hi_i = int(round(lo * 10)), int(round(hi * 10))
        return [round(float(row[lo_i] + (row[hi_i] - row[lo_i]) * 0.5), decimals)
                for row in qf]

    median = col(0.5)
    # discharge/rain/aqi/pm can't be negative — clamp the lower band at 0.
    clamp = lambda arr: [max(0.0, v) for v in arr]
    return {
        "median": clamp(median),
        "quantiles": {
            "p10": clamp(col(0.1)), "p25": clamp(col(0.25)),
            "p50": clamp(median), "p75": clamp(col(0.75)), "p90": clamp(col(0.9)),
        },
    }


def main() -> int:
    tfm = load_model()
    series_out: dict[str, dict] = {}

    for t in TARGETS:
        key = t["key"]
        print(f"  fetching {key}...", flush=True)
        try:
            series = t["fetch"]()
        except Exception as e:  # noqa: BLE001
            print(f"  skip {key}: fetch failed — {e}")
            continue
        if len(series) < 24:
            print(f"  skip {key}: only {len(series)} points (<24)")
            continue

        time.sleep(2)  # stagger upstream calls to stay under Open-Meteo's burst limit
        print(f"  forecasting {key} ({len(series)} pts → {HORIZON})...", flush=True)
        result = forecast_one(tfm, series, t["decimals"])
        result["label"] = t["label"]
        result["unit"] = t["unit"]
        result["lastValue"] = round(series[-1], t["decimals"])
        result["history"] = [round(v, t["decimals"]) for v in series[-21:]]
        result["source"] = "timesfm"
        series_out[key] = result
        print(f"  ✓ {key}: now {result['lastValue']} → median {result['median'][-1]} "
              f"[p10 {result['quantiles']['p10'][-1]} · p90 {result['quantiles']['p90'][-1]}]")

    payload = {
        "asOf": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "model": MODEL_ID,
        "horizon": HORIZON,
        "frequency": "D",
        "site": "Greater Kuching · Sarawak River @ Kuching",
        "series": series_out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"wrote {OUTPUT_PATH}  ({len(series_out)} series)")
    return 0 if series_out else 1


if __name__ == "__main__":
    sys.exit(main())
