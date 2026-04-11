# Secretary Goh's Super Dashboard // V2.0 Liquid Glass

A mission-critical, high-fidelity Operational OS for the Padawan Municipal Council, transforming Greater Kuching's municipal data into a Red Dot-standard situational awareness workspace.

## Run

```bash
node server.mjs
```

Open [http://localhost:3000](http://localhost:3000).

## V2.0 "Liquid Glass" Stack

- **Zero-dependency Core**: Node 20 server providing cached, highly-available JSON telemetry. 
- **High-Fidelity UI**: Dark themed "Liquid Glass" interface using Manrope/Inter typography and backdrop-blur glassmorphism.
- **Data Density**: Real-time KPI strip with 24h sparklines and linear radar-sweep map.

## Intelligence Pipeline

- **NASA FIRMS**: Live satellite monitoring of thermal hotspots and fire anomalies in the Malaysia envelope.
- **USGS Seismic**: Regional earthquake tracking and magnitude monitoring.
- **OpenSky Network**: Live airspace tracking for KCH, classifying arrivals, departures, and holdings.
- **Open-Meteo**: Deep weather and air quality telemetry with 24h trend analysis.
- **NASA GIBS**: Orbital context via high-resolution satellite imagery layers.
- **Google News RSS**: Curated, deduped local news rail covering Kuching and Padawan sectors.

## Operational Features

- **Sitrep Export**: Instant generation of mission-readiness reports for executive sharing.
- **Resilient Fallback**: Designed to maintain operational continuity even during API rate-limits or outage scenarios.
- **Atomic Clocks**: Synchronized ASEAN time array for multi-regional coordination.
