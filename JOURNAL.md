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

Date: 2026-10-20
What: Benchmarked the board against the Jakarta and Ho Chi Minh City atlases and added a Research tab: the public blueprint for people who want to change this board rather than only read it.
Why: Both siblings ship a research guide in the repository and neither has one on screen. Kuching had neither, and no data dictionary a reader could see beside the number it qualifies.
Diff: public/research-data.js; public/app.js renderResearch(); public/index.template.html; public/reading.css; public/styles.css; public/data.js; tests/research-tab.test.mjs.
Tags: research · blueprint · provenance · data-dictionary · trilingual

Date: 2026-10-20
What: Found that headless Chrome renders this board correctly while the in-app browser shows it as an empty shell — including on unmodified production.
Why: Two sessions were spent diagnosing an empty board that did not exist. `python3 -m http.server` deadlocks on parallel ES-module imports, and the in-app Browser in this environment does not capture or render the board. Neither is a defect in the product.
Diff: tasks/lessons.md.
Tags: harness · verification · false-alarm

Date: 2026-10-20
What: Removed the white plane at the bottom left of the board. The News digest printed three headlines out of fourteen already in the payload, inside a panel that never grew into the column the layout had reserved for it.
Why: The cap and the flex rule together, not a styling accident: 330px of panel in a 554px rail left 174px of empty warm paper. Measured with a geometry probe in headless Chrome at 2560x1440, and A/B'd against the pre-fix build at five viewport sizes.
Diff: public/app.js renderNewsIntake(); public/reading.css; public/data.js; tests/news-rail.test.mjs.
Tags: layout · data-honesty · measurement · regression-test

Date: 2026-10-20
What: Stopped the left column eating its own height. The News digest rendered fourteen headlines into a zero-height box on any laptop, because the brief strip was `flex: 0 0 auto` and refused to yield.
Why: flex-shrink: 0 on a content-sized block in a fixed-height column is a claim that the column is always tall enough. At 1440x900 the brief took 736px of an 813px column, the insights bar 69px, and the rail computed to 0px — with no page scroll that would ever reach it.
Diff: public/reading.css (.col-now .brief-strip / .col-now .news-rail); tests/news-rail.test.mjs.
Tags: layout · flex · measurement · regression-test
