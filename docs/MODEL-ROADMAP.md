# Kuching flood + haze twin — model roadmap

Written 14 Oct 2026. The board today is a **monitoring and decision surface**, not a hydraulic or air-quality model. This file records what is live, what each recommended model would add, and what data it needs before it can run honestly. Nothing in this list is shown on the board as if it exists.

## What makes Kuching different

| | Flood driver | Haze driver | Priority |
|---|---|---|---|
| Kuching | Intense equatorial rain, Sarawak River + tributaries, tide, steep upland runoff, low-lying urban drains | Transboundary Kalimantan peat-fire smoke (2015, 2019 episodes) | Rainfall–runoff, river/tide hydraulics, regional source attribution |

Haze is **regional first, local second**.

## Live on the board now (proxies, labelled as such)

| Need | What the board shows | Source | Limit |
|---|---|---|---|
| Upstream rain | Gauge rainfall, 14-day forecast | DID iHYDRO, Open-Meteo, TimesFM | No runoff routing |
| River state | 31 gauges with DID thresholds; Batu Kitang intake 7-day trend | DID iHYDRO | Observations, not a hydraulic model |
| Tide | Sea level at the Sarawak River mouth; "rain on a high tide" directive | Open-Meteo marine model | Model grid point, not the JUPEM gauge |
| Sealed ground | Impervious fraction per catchment | AlphaEarth 2024 | No drain capacity data |
| Rain type | Monsoon / tropical system / local convection, rule-based | MetMalaysia, JMA, Open-Meteo | Not an official classification |
| Haze sources | VIIRS fire detections, Kalimantan vs Sarawak (24 h) | NASA FIRMS keyless file | Detections, approximate border |
| Haze arrival | 48 h kinematic 925 hPa back-trajectory from Kuching + detections along it | Open-Meteo winds (browser) | No vertical motion; not HYSPLIT |
| Air quality | APIMS / NREB / modelled AQI | DOE, NREB, Open-Meteo | Station coverage |

## Recommended pilot (in order)

1. **One urban flash-flood catchment: Sg. Maong (EPA SWMM + PySWMM).** Pipes, culverts, detention, pumps, surcharge.
   - *Needs:* MPP/DBKU drainage asset inventory (inverts, sizes, outfalls), DID design storms (IDF curves), a 1–5 m DEM (LiDAR ideal; Copernicus GLO-30 too coarse for streets), and an observed flood (e.g. 3 Sep 2024) for calibration.
   - *Board output:* modelled street flooding for the forecast storm, shown as "model scenario" next to the gauges.
2. **Sarawak River corridor with tide (Delft3D FM 1D-2D).** Barrage, tributaries, tidal boundary, floodplain.
   - *Needs:* DID river cross-sections and barrage operating rules, JUPEM tide-gauge series, a floodplain DEM.
3. **City-scale flood-extent scenarios (LISFLOOD-FP).** Rain, tide and sea-level-rise combinations; GPU solvers make scenario sweeps cheap.
   - *Needs:* the same DEM, plus boundary flows from steps 1–2 or GloFAS.
4. **Upstream inflow (LISFLOOD, SWAT+ or HEC-HMS).** Rainfall–runoff from the Bengoh and upper Sarawak catchments.
   - *Needs:* soil and land-cover maps, gauged flows for calibration.
5. **Haze forecast + attribution (WRF-Chem or CMAQ for PM2.5; FLEXPART or HYSPLIT for trajectories).**
   - Daily loop: VIIRS/MODIS hotspots → FRP-based emissions with peat maps → 1–5 day PM2.5 → back-trajectories for attribution, forward for arrival → blend with DOE CAQMS / NREB / AOD.
   - *Needs:* a compute host (WRF-Chem is HPC-class; HYSPLIT alone runs on a workstation), GFS/ERA5 met inputs, a peatland map.
   - *First practical step:* run HYSPLIT back-trajectories nightly on the M5 and replace the browser kinematic estimate.

## Shared data layer (when models exist)

PostGIS for assets and zones, Zarr/NetCDF for model fields, STAC for catalogue, and GeoServer or static COG/PMTiles for the board. The map stays Leaflet/Cesium; outputs arrive as labelled scenario layers.

## Rules that carry over

- A model run is labelled as a scenario with its inputs, date and calibration status, never as an observation.
- Model output never generates a "Do this today" directive without a matching observation or official warning.
- Missing inputs mean no layer, not a plausible-looking one.
