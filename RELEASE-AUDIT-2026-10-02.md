# Kuching IOC release audit — 2 October 2026

## Decision

**Supervised demonstration only. Operational pilot and production readiness are not established.** A successful deployment and attractive branding do not establish dependable municipal decision support.

Audit baseline: clean `main`, commit `3d09be9`. Read-only inspection of current source/configuration and the deployed custom domain. No implementation changes or external writes were made. This report is an audit deliverable, not agency certification or a full penetration test.

## Findings, in priority order

### 1. P1 — Desktop readability regresses after the intended accessibility layer

High confidence, source-proven. `public/styles.css:3674` introduces an operational reading scale with 14px controls and 36px minimum height. The later one-screen desktop block overrides those same controls to 11px and 24px at `public/styles.css:4583`, and map controls to 11px/22px at line 4702. Smaller legacy information styles also remain. This directly conflicts with the repeated user requirement for readable text rather than packing everything into one viewport.

`tests/typography.test.mjs` checks that larger declarations exist, not which declarations win in the cascade. Its passing result does not prove readable computed styles.

Release gate: verify computed styles and keyboard/touch interaction at 1280, 768 and 375px, default and enlarged text, both themes and all languages. Permit document scrolling and progressive disclosure rather than shrinking critical content to fit. Add a regression test that fails for the current later overrides.

### 2. P1 — Refresh and freshness are insufficient for operational reliance

High confidence. `.github/workflows/cloudflare-pages.yml` deploys on main pushes or manual dispatch only; no scheduled refresh is declared. Production serves a baked snapshot. `public/data-health.js:3` assesses `generatedAt`, numeric coverage and classification, but does not assess each station's `observedAt`. A newly generated payload can therefore pass with old individual observations.

Live evidence: `/api/dashboard.json` returned `generatedAt=2026-10-02T09:27:55.263Z`, iHYDRO status `live`, and sampled station observation strings `02-10-2026 17:15`. Those strings require an explicit Malaysia timezone parser; payload generation age must not substitute for observation age. Source statuses describe acquisition at build time, not a continuously live feed.

Release gate: define agency-appropriate freshness limits, normalize observation timestamps, test mixed-age stations, and suppress reassuring conclusions when essential observations are stale. Establish refresh ownership, failure alerts and recovery evidence. Browser refresh alone is not a refresh pipeline.

### 3. P1 — Complete trilingual content has not been delivered

High confidence. `public/app.js:2539` filters news by original language and displays `i.title`; the ticker also displays original titles at line 4281. The sampled live news record has a Malay title and no translated summaries. This is multilingual intake, not translation of each relevant article into all three languages as requested.

Catchment estimates and historical narratives deliberately retain English with an original-language badge (`public/app.js:4119`, 4159, 4163). Honest labelling is useful, but does not satisfy complete trilingual comprehension.

Release gate: retain original links/text and provide independently reviewable English, Bahasa Melayu and Chinese summaries, with translation provenance and failure states. Test dynamic content, empty/error states, exports and manuals, not just translation-key parity. Native-speaker review remains outstanding.

### 4. P1 — Hydrological interpretation and exposure claims need validation

High confidence that validation is outstanding; this audit does not determine whether individual estimates are wrong. `server.mjs:1701` defines curated station narratives, exposure estimates and historical events. Examples include ~2,400 residents/340 properties and ~3,500 households. The records do not attach a survey citation, method or reference date to each estimate. The live payload incorporates these narratives beside agency observations.

Current catchment UI marks estimates as curated and not official surveys, and geometry as connectivity rather than flow direction or inundation. Preserve these safeguards. Connected OSM drainage length is not a validated upstream contributing catchment or flood travel-time model.

Live TimesFM output is marked `stale`, with `asOf=2026-06-13T17:14:02.621132Z`; its renderer has a stale badge. This is not evidence of a current forecast service. NASA FIRMS and APIMS are offline in the inspected snapshot. Citizen reports are explicitly `demo`, not verified municipal complaints.

Release gate: MPP/JPS review of thresholds, narratives, exposure and derived recommendations; per-record sources and uncertainty; validation of any predictive claims. Verify current satellite acquisition dates/cloud constraints and layer failure states before describing seamless coverage. Do not imply public CCTV coverage: none was verified by this audit.

### 5. P2 — Public identity and collaboration wording need approval

High confidence. Template description/footer identify Secretary Daniel Goh (`public/index.template.html:15`, 389). MPP's official staff directory lists **Ir. Ts. Goh Thiam Ho**, Municipal Secretary: https://mpp.sarawak.gov.my/web/subpage/staffcontact_view/72 . Confirm the approved display name rather than assuming a familiar name is the formal public name.

The footer says “in collaboration with” multiple organizations. Code and logos do not prove endorsement. Confirm permission and the precise relationship, and make the demo/decision-support status prominent. This is a credibility gate, not an accusation that the relationships are false.

### 6. P1 — Release automation does not enforce the available tests

High confidence. All **15 tests passed** with `node --test tests/*.test.mjs`. They cover data-health edge cases, council ledger/catalog consistency, selected translation-key parity, CSS declaration presence, icon dimensions and offline navigation. The deployment workflow runs dependency installation and build but no test command. `npm ci || npm install` can also mask a lockfile/install failure with a different dependency-resolution path.

Release gate: run these tests before deployment, fail on install/test/build errors, and add integration/browser checks for ingestion, freshness, maps, language switching and operator handover. Current tests are not whole-system acceptance tests.

### 7. P1 for shared operations — Task tracking is browser-local

The existing operator audit and `public/app.js` confirm localStorage task marks and expiration. There is no demonstrated shared dispatch, crew acknowledgement, durable municipal audit trail or role-based workflow. A completed mark on one browser is not proof that another administrator or a field crew saw it.

Release gate: either explicitly limit the pilot to personal decision support, or agree and implement the shared operational workflow with council ownership, retention and recovery requirements. Do not present current marks as dispatch completion.

## Security and release boundaries

### 8. P1 — Stale forecasts still generate current directives and cascade claims

High confidence, source and live-browser confirmed. `server.mjs:3299` checks only `forecast?.series`, then creates “River rising — p90 82 m³/s in 7d” and air-quality directives without excluding `status=stale` or validating the forecast origin date. The live dashboard displayed both directives under “Do this today” while the forecast card carried a STALE badge. `public/app.js:3815` excludes offline forecasts but not stale ones from the rain/river cascade, which displayed TODAY and future risk bands. A stale badge on a separate panel does not protect downstream action advice.

The live flood panel simultaneously displayed “Verify river conditions — data incomplete or outdated” and “No flood action required”; the latter originates in the normal-band checklist at `server.mjs:2379`. These messages are contradictory when data validity is unresolved.

Release gate: enforce validity before creating or presenting directives, suppress all-clear instructions when essential evidence is unknown, and propagate the same freshness envelope through every forecast consumer, including cascades, insights, exports and actions. Add stale/missing-observation regression cases, not just badge tests.

### 9. P2 — Map provenance exists in JSON but is not consistently visible

High confidence. `public/app.js:1232` disables Leaflet attribution; line 1249 creates tile layers without passing their configured attribution. The 3D path hides Cesium's credit container at line 4729. Visible attribution and provider-credit requirements need review before professional delivery; this audit does not assert a legal conclusion.

The live flood-risk GeoJSON contains 34 band-scaled circular buffers and explicitly says “Visual proxy only”. The UI button says “Flood Risk”; the generic feature tooltip at `public/app.js:1676` displays name/kind but not the collection's method note. Land-use JSON likewise identifies OSM as a zoning proxy, not authoritative I-Plan zoning. The mock fallback function currently returns an **empty collection**, not fabricated polygons; the surrounding fallback wording is stale and should not be mistaken for current fabricated output.

Release gate: expose method, source, age and non-authoritative status when activating each layer, and retain appropriate provider credits in both dimensions. Compare legend, layer and source-panel descriptions to the actual delivered data.

### 10. P1 — External map names enter HTML tooltips without escaping

High confidence in the unsafe data path; exploitability has not been exercised against live sources. `server.mjs:2688` copies `tags.name` from Overpass into feature properties. `public/app.js:1676` interpolates `p.name`, `p.kind`, `p.ref` and other properties directly into tooltip HTML before `bindTooltip`. Ward tooltips also interpolate properties directly. Other feed renderers already use `escapeHtml`, so a repository-native mitigation exists. A local extraction of the actual tooltip-builder block confirmed that an image tag with an event-handler attribute remains intact in the resulting HTML. No browser payload was executed and no external data was altered.

Release gate: treat all external properties as text or escape them at the HTML boundary, validate link schemes where applicable, and regression-test adversarial feature properties locally. Do not inject test payloads into public OSM or the deployed system. The absence of CSP increases the need to close this boundary; a CSP is not a replacement for output escaping.

### 11. P1 — Missing weather/air values are accepted as live zeros

High confidence, locally reproduced using the real loader functions with substituted response fixtures. `loadWeather()` accepts a valid empty JSON object, defaults current temperature and precipitation to zero, and returns `status=live` with a new `updatedAt`. `loadAirQuality()` does the same for AQI and particulate readings. A syntactically valid but incomplete upstream response can therefore become apparently favourable environmental evidence. The parser rejects malformed JSON, but successful parsing is not schema validation.

Release gate: validate required response fields, numeric ranges and observation times before classification. Preserve null/unknown separately from valid zero. Add incomplete, null, malformed and out-of-range response fixtures and verify how each consumer handles them. Do not rely only on upstream HTTP status or JSON parsing.

### 12. P2 — Forecast and gauge coordinates have drifted

High confidence in the mismatch, not a determination of its hydrological impact. The forecast runner's `HYDRO_STATIONS` uses Batu Kitang (1.485, 110.295), Siniawan (1.395, 110.215), and Kampung Git (1.336, 110.196). The inspected live gauge records use (1.452416667, 110.2822778), (1.446611111, 110.2185833), and (1.35551, 110.26669), respectively. These differ despite the runner comment saying they use the same coordinates as the server. Forecast rainfall might legitimately use a contributing-area centroid rather than a gauge location, but no explicit such distinction is recorded here.

Release gate: define gauge versus rainfall-sampling coordinates, their source, purpose and version; reconcile IDs and methods with JPS; add a consistency test for fields intended to match. Do not blindly move forecast points without understanding the intended catchment model.

### 13. P2 — The build contract can accept old or semantically invalid artifacts

Source-proven risk, not an observed failed deployment. GIS fetches use `Promise.allSettled`; failed layers log warnings but do not automatically fail the build. Required-artifact checks verify only readable, nonempty files. Existing committed layer JSON can satisfy that check after a fetch failure. The layer-fetch block writes the body before parsing it, so invalid JSON can also remain on disk when parsing rejects. The manifest records failures, but the contract does not establish that each required layer is valid, fresh or consistent with the new dashboard snapshot.

Release gate: validate before writing, write atomically, and explicitly choose either a failed release or a clearly labelled last-known-good layer with its own observation/build age. Test this contract in an isolated temporary output tree. The public source matrix's 32 inspected records lack their own `updatedAt`/`observedAt`/`fetchedAt` fields, although nested source payloads can carry timestamps; the evidence UI must resolve those nested times rather than infer them from a status word.

## Security review follow-up

The live homepage returned HTTP 200 with nosniff, DENY framing, strict-origin referrer policy and the configured permissions policy. No CSP was returned. This confirms deployed headers, not complete browser protection.

A streaming known-prefix/private-key-pattern scan examined 113 locally reachable commits (61,053 patch lines). Three commits produced candidate matches, all in news/trend URL fields. Classification showed all 13 matching fields were publisher article-path matches, not credential parameters; no actual secret was established. This limited scan does not prove absence of arbitrary-format secrets, remote-only refs or retained logs. An initial buffered attempt hit ENOBUFS; the streaming pass completed. No suspected credential values are included in the report.

CI uses version-tagged third-party actions rather than immutable SHAs. The Node package manifest declares no runtime dependencies; browser CDN dependencies and local Python/model environments still require separate supply-chain review. No advisory-based dependency pass or credential revocation check is claimed.

Fetch helpers enforce timeouts and HTTP error checks. News/service aggregation uses settled promises in some adapters, while dashboard assembly uses `Promise.all` and depends on every loader converting its own errors into a usable state. Citizen-report fetch errors and empty result arrays both produce a labelled demo dataset. This preserves display continuity but conflates unavailable, unconfigured and genuinely empty live intake. A pilot should keep those states distinct.

Recommended owners: application maintainer for escaping, schema validation, CI and artifact contract; data steward/JPS reviewer for coordinate/threshold/model provenance; council product owner for public naming, endorsements, translation acceptance and pilot boundaries. These are proposed responsibilities, not evidence of appointed owners.

Inspected: GET/HEAD-only local server routing; selected escaped feed renderers; Leaflet integrity attributes; public response-header configuration; worker behaviour. `_headers` sets nosniff, frame denial, referrer and permissions policies, but explicitly omits CSP. No full route/input audit, credential-history scan, rate-limit/load test or penetration test was performed. Paid-key endpoint controls must be reviewed before exposing the local live server publicly. These observations do not constitute a security pass or a proven exploit.

Recovery, ingestion failure monitoring, support ownership, service obligations and restoration drills were not demonstrated by inspected evidence. Establish these before upgrading the maturity label.

## Verification ledger

- **Succeeded:** 15/15 existing tests; live snapshot retrieval; live manifest retrieval; deployed `brand.css` SHA-256 matches local bytes. Transparent logo assets and platform icon variants exist. New web-app instructions have EN/MS/ZH copies. Existing missing/partial-data, curated-estimate, stale-forecast and demo-report labels are present in source.
- **Succeeded, follow-up browser pass:** native Chrome fallback loaded the deployed dashboard, switched 3D to 2D, exercised BM/CN language buttons and opened/closed the Chinese operator guide. Satellite imagery and drainage vectors appeared in 2D. Responsive previews were inspected at widths 375, 768 and 1280px, and mobile document scrolling worked. English/3D were restored and DevTools closed after inspection. This is Chromium emulation, not physical-device proof.
- **Failed then recovered:** the initial browser inventory was empty; a later Chrome connector appeared but tab creation timed out. Native Chrome accessibility provided the verified fallback. An initial responsive-stepper operation failed; click/select/type then confirmed the intended widths in the accessibility tree.
- **Skipped:** code remediation, commit/push/deploy, paid services and external communications: this request is an audit. No public data or live features were removed.
- **Unverified:** complete whole-dashboard interaction/focus and cross-theme flows; physical Android/iPhone installation; full 3D camera/layer behaviour, satellite acquisition freshness and every layer failure path; every ingestion adapter/failure boundary; independent translation review; hydrological accuracy; endorsement permissions; security and recovery readiness. Partial browser checks cannot prove these broader requirements.

Browser findings: BM/CN translated headings/manual content but left action bodies, flood checklists, map buttons and many status explanations in English. At 375px the masthead consumes substantial first-screen space before actions; insight cards remain side-by-side and wrap Chinese into narrow columns. At 1280px metric contexts and layer controls are clipped/truncated. No universal overflow-free or readability pass is claimed.

Saved screenshot evidence (absolute paths):

- `/Users/nonarkara/.codex/visualizations/2026/09/22/01a0c73b-9f78-7901-84ae-39be01aa6a8a/audit-mobile-375.png`
- `/Users/nonarkara/.codex/visualizations/2026/09/22/01a0c73b-9f78-7901-84ae-39be01aa6a8a/audit-tablet-768.png`
- `/Users/nonarkara/.codex/visualizations/2026/09/22/01a0c73b-9f78-7901-84ae-39be01aa6a8a/audit-desktop-1280.png`

## Acceptance order

1. Resolve readability/cascade and complete translations; verify with real browser flows.
2. Establish observation-level freshness and automated ingestion/deployment safeguards.
3. Obtain source/interpretation and public identity/relationship approval.
4. Agree a bounded pilot and its owner, support, monitoring and handover procedures.
5. Run council-admin acceptance exercises with recorded evidence before making an operational-readiness claim.

The source and live-response review is documented. The full audit remains open until the browser and operational verification gaps are resolved. The system is **not** certified ready; missing checks must remain visible rather than being converted into passes.
