// MET uses Malaysian local times when no offset is supplied.
export function malaysiaTime(value) {
  if (typeof value !== "string") return NaN;
  const local = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  const normalized = local
    ? `${local[3]}-${local[2]}-${local[1]}T${local[4]}:${local[5]}:${local[6] || "00"}+08:00`
    : /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value)
      ? value.replace(" ", "T") + "+08:00" : value;
  return Date.parse(normalized);
}

export function normalizeMetWeather(warnings, forecasts, now = Date.now()) {
  const validWarning = w => w && Number.isFinite(malaysiaTime(w.valid_from))
    && Number.isFinite(malaysiaTime(w.valid_to));
  const records = Array.isArray(warnings) ? warnings : [];
  const dated = records.filter(validWarning);
  const warningsKnown = Array.isArray(warnings) && dated.length === records.length;
  const active = dated.filter(w =>
    now >= malaysiaTime(w.valid_from) && now <= malaysiaTime(w.valid_to));
  const relevant = active.filter(w => /sarawak|kuching|padawan|batu kawa|serian|siburan|kota samarahan/i
    .test([w.heading_en, w.text_en, w.heading_bm, w.text_bm].join(" ")));
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  const forecast = Array.isArray(forecasts) ? forecasts
    .filter(f => /kuching/i.test(f?.location?.location_name || "") && f.date >= today
      && typeof f.summary_forecast === "string")
    .sort((a, b) => a.date.localeCompare(b.date))[0] : null;
  return {
    status: warningsKnown ? (relevant.length ? "live" : "clear") : dated.length ? "partial" : "unavailable",
    updatedAt: new Date(now).toISOString(),
    activeCount: warningsKnown || dated.length ? relevant.length : null,
    allActiveCount: warningsKnown || dated.length ? active.length : null,
    unknownValidityCount: records.length - dated.length,
    undatedItems: records.filter(w => !validWarning(w)).map(w => ({
      heading: w?.heading_en || w?.heading_bm || "MET Malaysia", text: w?.text_en || w?.text_bm || "",
      issued: w?.warning_issue?.issued || null,
    })),
    items: relevant.slice(0, 3).map(w => ({
      heading: w.heading_en || w.heading_bm || "MET Malaysia",
      text: w.text_en || w.text_bm || "", instruction: w.instruction_en || w.instruction_bm || "",
      headingBm: w.heading_bm || "", textBm: w.text_bm || "", instructionBm: w.instruction_bm || "",
      validFrom: w.valid_from, validTo: w.valid_to,
    })),
    forecast: {
      status: forecast ? "live" : "unavailable",
      date: forecast?.date || null, language: "ms",
      text: forecast?.summary_forecast || null,
      hasRain: forecast ? /hujan|ribut petir/i.test(forecast.summary_forecast) : null,
    },
  };
}
