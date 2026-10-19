Date: 2026-10-15
What: Expanded the regional building model beyond the609-footprint pilot and made the phone map precede controls and briefing panels. Release remains pending native-language review.
Why: The live phone masthead measured411px despite a30px shipping claim; a city model needs bounded visible geometry and traceable assumptions, not a larger upfront payload.
Diff: tasks/GREATER-KUCHING-3D-RESULT.md; public/regional-buildings.js; scripts/arnis/bake-area.mjs; public/reading.css.
Tags: city-model · map-first · open-data · multilingual-review

Date: 2026-10-15
What: User confirmed native-language review, clearing the regional-model release gate.
Why: The public civic interface needed a human language check in addition to automated parity tests.
Diff: tasks/GREATER-KUCHING-3D-RESULT.md; release verification in the associated Codex chat.
Tags: city-model · release · multilingual-review

Date: 2026-10-15
What: Audited MiniMax's regional-loader release and corrected cancellation, retry and control-ownership failures; added real deferred-response regression coverage.
Why: A passing suite did not prove users could leave3D during slow requests or prevent late activations from overriding their selected mode.
Diff: tasks/REGIONAL-LOADER-REVIEW-RESULT.md; public/regional-buildings.js; tests/regional-loader.test.mjs.
Tags: city-model · audit · cancellation · regression-tests

Date: 2026-10-19
What: Fixed the Open-Meteo hourly anchor. Every weather and AQI loader located "now" with an exact-match lookup against a coarser-resolution series, so it returned -1 half the time, failed a single check, and discarded good readings in favour of the fallback stub. The board showed 30.8 °C during actual rain; the truth was 24.1 °C.
Why: The forecast endpoint reports `current` at 30-minute granularity while `hourly` is hourly. A single-entry `degradedFields` is the whole diagnosis: upstream answered fine, the anchor was wrong.
Diff: public/open-meteo-anchor.js; server.mjs; public/app.js; tests/open-meteo-anchor.test.mjs.
Tags: data-honesty · anchor · provenance

Date: 2026-10-19
What: Closed four release blockers from the CSO audit against a tree with 114/114 passing tests, then found and fixed two more defects my own repair introduced.
Why: `.slice(a,b).every()` is vacuously true on an empty slice; a recovery path that swaps a payload slice without recomputing its derived consumers leaves the board showing two readings; and a test asserting `payload.metrics = buildMetrics(` passes while the behaviour deletes seven metric cards.
Diff: public/climate-validate.js; public/app.js; server.mjs; tests/climate-validation.test.mjs; tests/release-hardening.test.mjs; tests/fixtures/; docs/security/; tasks/RELEASE-HARDENING-2026-10-19-PLAN.md.
Tags: release · security · data-honesty · regression-tests
