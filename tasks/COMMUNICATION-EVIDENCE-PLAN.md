# Evidence-to-decision communication — 23 October 2026

Status: owner approved; implementation and local verification complete; release
verification in progress. Owner clarified that “research” means applied research on
intelligent operations centres, not a single paper. Taipei DOIT is the first
requested benchmark. No paper attachment is needed.

## Verified current work

- Clean, up-to-date main `6bda3fa`; latest inspected Actions run 39808252208
  succeeded. Re-ran the suite: 171 passed, zero failed, about20 seconds.
- Claude-signed eec0af2 adds readiness and measurement-time freezing;
  12b2a1b supplies a fixed fixture;6bda3fa makes Linux measurement advisory.
- MCode-signed0b0ec8d adds the MSH law, geometry instrument and reasoned baseline.
  Preserve those repairs; do not reintroduce the layout defects they addressed.
- The existing Research tab already has source/pipeline/dictionary/recipes and
  evidence copying. Extend it, do not add another competing documentation panel.
- Code inspection confirms eleven baseline reasons and advisory Linux CI. This
  session has not executed a rendered spatial sweep; unit tests/CI success are
  not a new visual pass or a measurement-gate exit-code confirmation.

## Corrections that matter to communication

1. Owner-defined SH means invented spatial demand in interface design.
   Coordinate validity is a separate geographic quality check. Both matter;
   neither should be presented as proof of the other.
2. The blueprint says inverted coordinates are rejected, but
   sanitizeMarkerCoord() auto-corrects them; this helper has no app call sites.
   Server intake does not import spatial-guard.js. Existing app bounds checks
   do run, and regional viewport sampling uses filterViewportSamples(). State
   each actual boundary; do not claim universal intake enforcement.
3. The blueprint calls citizen reports verified, although the committed feed
   is not-connected. It promises zero downtime/immutable snapshots and direct
   responsible-desk protocols for every alert. These guarantees are not supplied
   by a mutable JSON bake or browser-local task marks.
4. Dictionary source IDs existing is weaker than being the correct dependency:
   “River forecast” describes TimesFM but maps to DID/flood-action; satellite
   growth maps to NASA imagery rather than the actual change artifact. Separate
   independent evidence products instead of merging their status glyphs.
5. Readiness is currently set in boot() finally, including render failure.
   Frozen mode skips climate completion but not rain-regime completion. Therefore
   do not claim that readiness proves useful content or all network mutation is
   frozen. The global Date override also affects third-party code; bound it.
6. Hover/title access is not enough for phone or keyboard readers. Critical
   qualifiers need an explicit accessible detail action beside their reading.

## Task and invariant

Task: a citizen or council officer can understand what is happening at a place,
check why the board says so, see its limitations, and find the appropriate human
next step without reading implementation jargon.

Invariant: **every decision-facing claim has inspectable source evidence,
transformation, time, place/coverage and uncertainty; no interpretation becomes
an observation or an official instruction merely by being visualized.**

## Proposed implementation

### A. A plain-language evidence funnel, inside Research

MODIFY public/research-data.js, public/app.js renderResearch(), public/data.js
and narrowly public/reading.css. Preserve existing research content and maps.

Use five connected stages, not another equal-card grid:

Public evidence → quality checks → interpretation → readable view → human decision

- Public evidence: distinguish sensor observations, model estimates, satellite
  imagery, official notices, journalism and citizen accounts. Name missing feeds.
- Checks: timestamp/unit/location, duplicates, source coverage and privacy.
- Interpretation (“cooked data”): name formula/rule/version, inputs, spatial
  assumptions, comparison and uncertainty. Never label it a truth engine.
- View: explain why this map, trend or comparison helps the reader's task.
- Decision: suggested check/action, responsible published agency channel,
  confirmation needed and limitations. Do not invent an assignee or dispatch.

Add one computed water example from the actual selected/available gauge and
linked inputs, with missing dependencies explicit. Do not infer a continuous
water path, drainage direction or flood depth from proximity alone.

### B. Evidence detail where the decision happens

MODIFY relevant metric/gauge renderers and research-data dependency contracts.
Use source/tier/observation age/coverage plus an accessible “Why this?” detail.
Show original notice/headline links, distinguish translated summary from source
text, and separate official records from unverified public accounts. Do not
publish resident identities or precise private addresses. No new scraping or
report collection is required for this communication pass.

### C. Applied research embedded in the working system

Map operational question → cited design principle → implemented component →
test/evidence → limitation. Supply source project/publication, version/date and
original URL. Separate cited features, this project's hypotheses and measured
evaluation results. Do not invent study outcomes or imply publication, peer
review or council endorsement. Keep methods expandable and the first screen
operational. Translate summaries and retain original citations.

First application: extend the existing locality/ward interaction into one
locality brief: known place identity and area, relevant dated observations,
change/comparison only when history exists, related public reports, responsible
published service channel and the next verification. Keep map/list selection
synchronized. Reuse existing panels rather than adding another permanent bar.

The525-entry directory has codes for all525 records, ward codes for514, and no
coordinate fields in any record. Keep the11 missing ward links unknown.
Preserve administrative joins;
never invent centroids or claim a nearby gauge measures that locality. Explicit
geometry/alias evidence is required before a precise spatial join. Distinguish
“inside this ward”, “nearby”, “same catchment”, “model grid” and “location unknown”.

### D. A spatial gate that cannot pass an empty board

MODIFY app.js readiness/measurement boundary, scripts/spatial measurement setup,
tests and .github/workflows/cloudflare-pages.yml. Replace document-global clock
mutation with a scoped application clock or a harness-owned controlled context;
freeze every content-changing completion in the fixture run. Separate settled,
render-success and render-failure signals and assert real critical content.

Keep Mac reference checks and add a reviewed Linux-font baseline with the font
recorded; enforce platform-independent emptiness, overlap, inaccessible controls
and missing content in CI. A baseline explanation is review evidence, not a way
to excuse a new failure. Do not install hooks or change user-wide git settings
silently. Keep normal visitor clocks and network completion unchanged.

## Sacred items and scope

Preserve maps/canvas/charts/tickers/HUDs, regional and pilot3D, manual/install,
all earned data, public contacts, locality directory, Helvetica and EN/BM/ZH.
No file shrinkage over30%; no replacement dashboard, paid services, account
permission changes, new personal-data capture or military/cockpit branding.
Do not rewrite the verbatim owner law docs/MSH-LAW.md.

## Acceptance and shipping

- Behaviour tests for correct evidence dependency, missing/old/conflicting data,
  geographic mismatch, accessible details, readiness failure and frozen mutation.
- Two identical frozen sweeps plus adversarial long-label/error/enlarged-text
  fixtures. Test EN/BM/ZH; render390×844,1024 and1440×900 and open relevant panels.
- Independent review of actual pixels and evidence claims. Retain map dominance;
  geometry metrics alone cannot establish that a person understands the screen.
- Ask a real administrator and a nontechnical reader to identify what happened,
  why, uncertainty and next step. Until performed, report comprehension untested.
- Full tests/security/build, signed commit, push/deploy, canonical/custom asset
  verification and live human-flow check. Record remaining limits honestly.

## Prior art

## Implementation receipt — 23 October 2026

- Added `public/evidence.js` with explicit directory joins, source-specific
  artifact contracts, dated station evidence and EN/BM/ZH explanation text.
  The 11 unknown ward links remain unknown; no locality coordinates were added.
- Research now exposes five evidence-to-decision stages, an actual gauge
  example and cited Taipei/W3C design references. Existing technical content
  remains expandable. A Read method action opens the same content in the
  existing evidence dialog rather than taking permanent map space.
- Locality evidence buttons and metric Why this actions work with keyboard,
  phone and all three languages. Source and time stay with the reading.
- Measurement time is module-local. Readiness requires rendered metric and
  brief structures, five evidence stages and a Leaflet pane; failures cannot
  become ready merely because boot ended. CI now enforces a populated-board,
  full-width-sweep and overflow/overlap floor before deployment.
- Two browser DOM sweeps at all 26 breakpoint widths: 6 metrics, 3 brief items,
  5 stages, map pane present, no page-width overflow. These checks are not a
  replacement for the full spatial instrument or a human comprehension test.
- Independent review exercised hostile locality/gauge/news/metric text through
  actual renderer functions; markup was escaped and javascript links blocked.
  Phone and tablet funnel screenshots passed; desktop gets the focused dialog.
- Local build succeeded with 8 required artifacts. Unit suite: 181 passed.
  Release CI and live verification are recorded separately after deployment.

Remaining limits: no real administrator/nontechnical comprehension study,
physical-device test or native-language review of newly added text yet. No
new citizen-report collection, precise directory geocoding or historical
archive is claimed. The existing font-dependent Mac geometry baseline remains;
a reviewed Linux geometry baseline is deferred, not silently accepted. The
portable safety floor is enforced on Linux. Existing narrative/dispatch-like
wording outside the new evidence surfaces still needs a separate source-by-source
review; this release is not a blanket certification of every legacy claim.

Use the existing blueprint instead of introducing a framework. W3C PROV's
entity/activity/agent distinction is a useful lightweight lineage model, not a
requirement to install an ontology stack:
https://www.w3.org/TR/prov-primer/ and https://github.com/w3c/prov .
Open-Meteo describes its weather product as model output:
https://open-meteo.com/en/docs . Preserve that distinction in the funnel.

## Taipei DOIT benchmark — inspected23 October2026

Scope: official repository/docs and selected schema source, not a live usability
test, security certification or evidence of measured municipal outcomes.

Pinned inspected heads: Taipei-City-Dashboard develop
`1c54abfee77b88fbcb276df5efb35e7cc135ff5d`; Documentation main
`fa1e3a6dc83a5b13dbcc26c7a466ec2272126fdb`.

| Verified Taipei pattern | Proposed Padawan adaptation |
|---|---|
| Component configuration carries source, cadence, descriptions, use case, links, map and history settings. Selected backend schema confirms these fields. | One evidence contract per indicator, not detached prose that can contradict the displayed value. |
| Charts filter map data by matching properties or layer names. | Selecting a ward/locality/category updates the same evidence and map context; visible reset and known join method. |
| Dataset metadata distinguishes snapshot/new events/moving windows/full history; maintenance can append/replace/current+history. | Name whether a view is current or historical, retain dated snapshots for real comparisons; do not infer change from a single bake. |
| Documentation names coordinate conversion, timezone-aware dates and district-qualified village names. | Canonical locality ID plus aliases, source CRS, observation time and validated ward membership; flag ambiguous names. |
| Component information views expose description, available history, data download and issue reporting. | Accessible “Why this?” plus inspectable evidence/export; public correction channel distinct from a dispatched work order. |

Sources:
- https://github.com/taipei-doit/Taipei-City-Dashboard
- https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/front-end-en/introduction-to-components.md
- https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/front-end-en/map-filtering.md
- https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/front-end-en/data-sources-and-cleaning.md
- https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/data-end-en/dag-metadata.md
- https://github.com/taipei-doit/Taipei-City-Dashboard-Documentation/blob/main/src/assets/articles/front-end-en/user-interface.md
- https://github.com/taipei-doit/Taipei-City-Dashboard/blob/develop/Taipei-City-Dashboard-BE/app/models/componentConfig.go

Limits on transfer:
- The UI documentation describes restricted phone functionality; that is not a
  model for Padawan's phone-first requirement. Runtime mobile behaviour was not
  tested in this research pass.
- The data-end documentation says GeoServer configuration is not open-sourced.
  A public repo does not prove the complete municipal deployment is reproducible.
- Taipei's own pipeline docs keep ETL separable from Airflow. Borrow the source/
  validation/history contracts without importing its whole infrastructure stack.
- TownPass is a separate citizen-services project. Do not claim that borrowing
  dashboard patterns connects Padawan service submission or case tracking.
- No third-party code copied or installed. GitHub reports NOASSERTION for the
  dashboard licence, so inspect actual terms before any code reuse; no licence
  compatibility conclusion is made here.
