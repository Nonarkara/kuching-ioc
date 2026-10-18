import test from "node:test";
import assert from "node:assert/strict";

// CLAUDE.md: three languages, and the en/ms/zh key sets must match. Nothing
// enforced that, so a translation added to one locale shipped silently and
// the board fell back to English for two of its three audiences. The 18 Oct
// 2026 pass added weatherUnverified/weatherClear, which is what surfaced it.
const { TRANSLATIONS } = await import("../public/data.js");

test("every locale defines the same translation keys as English", () => {
  const locales = Object.keys(TRANSLATIONS);
  assert.deepEqual(locales.sort(), ["en", "ms", "zh"], "the board ships exactly three locales");

  const en = TRANSLATIONS.en;
  assert.ok(Object.keys(en).length > 100, "English must be the reference locale and be populated");

  for (const loc of locales.filter((l) => l !== "en")) {
    const t = TRANSLATIONS[loc];
    const missing = Object.keys(en).filter((k) => !(k in t));
    assert.deepEqual(missing, [],
      `${loc} is missing ${missing.length} key(s) that English defines: ${missing.slice(0, 12).join(", ")}`);
  }
});

test("the verdict status tokens exist in all three languages", () => {
  // These are the tokens the command bar's chips read. A chip that renders
  // raw English inside a BM or CN board is worse than a missing chip.
  for (const key of ["weatherUnverified", "weatherClear", "weatherUnknown", "verifyReading"]) {
    for (const loc of ["en", "ms", "zh"]) {
      const v = TRANSLATIONS[loc][key];
      assert.equal(typeof v, "string", `${loc}.${key} must be defined`);
      assert.ok(v.trim().length > 0, `${loc}.${key} must not be empty`);
    }
  }
});

test("no translation falls through to printing its own key", () => {
  // The signature of a failed lookup is `value === key`. Only keys that are
  // identifiers can prove it: some keys are genuine English words that happen
  // to be keys ("of", "wards"), so comparing every key produces false alarms.
  // An identifier containing "_" is never a natural-language word, so a value
  // equal to such a key is unambiguously the UI printing "weather_unverified".
  for (const loc of ["en", "ms", "zh"]) {
    const t = TRANSLATIONS[loc];
    const fell = Object.entries(t)
      .filter(([k, v]) => k.includes("_") && typeof v === "string" && v.trim() === k)
      .map(([k]) => k);
    assert.deepEqual(fell, [], `${loc} prints raw identifier keys for: ${fell.slice(0, 10).join(", ")}`);
  }
});

test("no translation is an empty string", () => {
  for (const loc of ["en", "ms", "zh"]) {
    const empty = Object.entries(TRANSLATIONS[loc])
      .filter(([, v]) => typeof v === "string" && v.trim() === "")
      .map(([k]) => k);
    assert.deepEqual(empty, [], `${loc} has empty strings for: ${empty.slice(0, 10).join(", ")}`);
  }
});