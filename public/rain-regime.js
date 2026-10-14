// Rain regime classifier — rule-based and labelled as such on the board.
// Not an official MetMalaysia product. Thresholds (13 Oct 2026):
//   tropical system: MetMalaysia TC advisory active, or a JMA-tracked cyclone
//     within 1500 km (west of 130°E, south of 25°N), or Kuching 24 h mean
//     pressure < 1007 hPa with a 24 h fall of 3 hPa or more;
//   NE monsoon: 24 h mean 850 hPa wind >= 8 m/s from 0–90° (cold-surge proxy);
//   SW monsoon: >= 5 m/s from 200–270°;
//   local convection: < 5 m/s at both points; otherwise "unknown".
// Season (Nov–Mar NE, May–Sep SW) only sets confidence, never the label.
export function classifyRainRegime({ month, cyclones = [], mmdAdvisory = null, kuching = null, scs = null }) {
  const evidence = [];
  const near = cyclones.filter((c) => c.distanceKm != null && c.distanceKm <= 1500 && c.lon <= 130 && c.lat <= 25);
  if (mmdAdvisory && !/no advisory/i.test(mmdAdvisory)) evidence.push(`MetMalaysia tropical-cyclone advisory: ${mmdAdvisory}`);
  near.forEach((c) => evidence.push(`${c.name} (${c.category}) ${c.distanceKm} km from Kuching — JMA`));
  const lowPressure = kuching?.mslMean24 != null && kuching.mslMean24 < 1007 && kuching.mslChange24 <= -3;
  if (lowPressure) evidence.push(`Kuching pressure ${kuching.mslMean24} hPa, ${kuching.mslChange24} hPa in 24 h`);
  if ((mmdAdvisory && !/no advisory/i.test(mmdAdvisory)) || near.length || lowPressure) {
    return { label: "depression", confidence: near.length || mmdAdvisory ? "high" : "low", evidence };
  }
  const ne = [kuching, scs].some((p) => p?.wind850 != null && p.wind850.speedMean >= 8 && p.wind850.dirMean >= 0 && p.wind850.dirMean <= 90);
  const sw = [kuching, scs].some((p) => p?.wind850 != null && p.wind850.speedMean >= 5 && p.wind850.dirMean >= 200 && p.wind850.dirMean <= 270);
  const season = [11, 12, 1, 2, 3].includes(month) ? "ne" : month >= 5 && month <= 9 ? "sw" : "inter";
  if (scs?.wind850) evidence.push(`South China Sea 850 hPa wind ${scs.wind850.speedMean} m/s from ${scs.wind850.dirMean}°`);
  if (kuching?.wind850) evidence.push(`Kuching 850 hPa wind ${kuching.wind850.speedMean} m/s from ${kuching.wind850.dirMean}°`);
  if (ne) return { label: "monsoon_ne", confidence: season === "ne" ? "medium" : "low", evidence, season };
  if (sw) return { label: "monsoon_sw", confidence: season === "sw" ? "medium" : "low", evidence, season };
  const calm = [kuching, scs].every((p) => p?.wind850 != null && p.wind850.speedMean < 5);
  if (calm) return { label: "local", confidence: "medium", evidence, season };
  return { label: "unknown", confidence: null, evidence, season };
}
