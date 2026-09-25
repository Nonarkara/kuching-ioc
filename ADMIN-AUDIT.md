# Padawan operator audit — 25 September 2026

## Scope

Targeted audit of operator entry points, water-status interpretation, task interaction and handover. Not a certification of hydrological accuracy, ingestion completeness or emergency readiness. Existing uncommitted server, template and satellite-script changes are excluded from this release.

## Findings addressed

- Missing river readings previously produced “Rivers OK · 0 gauges”. Coverage is now computed from actual numeric readings in the selected scope. Missing, partial, offline, unclassified and old-payload conditions require verification. A zero-metre reading is retained as a valid number.
- The interface unconditionally announced “SYS: OPERATIONAL”. It now asks operators to check source times or flags missing readings / payload time problems.
- A six-hour payload review threshold is a UI convention, not an agency guarantee. Individual observation times must still be checked; a new payload does not prove every source is current.
- Forecast rainfall was labelled as observed in the catchment narrative. It is now explicitly forecast rainfall.
- Action cards accepted unescaped feed text and lacked keyboard operation. Text is escaped; Enter/Space cycles browser-local status. The age indicator describes when the task was first seen, not source freshness.
- A native-dialog guide provides English, Bahasa Melayu and Simplified Chinese instructions, collapsible sections, language controls and keyboard close/focus restoration. Main shortcuts open enclosing disclosures before navigating.
- Key action text is enlarged. The map, satellite layers, geometry, historical content and existing panels are preserved.
- Exported briefs include the payload timestamp and local-task limitation. Missing warning item arrays no longer break the export.

## Remaining operational limits

- Task status is localStorage, not a shared work-order system. Existing marks expire 24 hours after first seen. No crew dispatch, acknowledgement, audit trail or access control was added.
- Production is a baked snapshot. The deployment workflow examined runs on push or manual dispatch; no scheduled refresh is declared in that workflow. Reloading the browser does not regenerate it.
- No verified public CCTV stream was added. Do not imply camera coverage.
- Drainage connectivity is not validated flow direction, flood travel time or inundation modelling. Satellite dates, clouds and reference risk layers constrain interpretation.
- Existing exposure estimates, station narratives, alert thresholds and suggestions require validation with MPP/JPS before operational reliance. This pass does not certify them.
- Translation is authored for plain-language use but has not had independent native-speaker review.
- No changes to the upstream ingestion adapters or full penetration/security test are included.

## Checks

`node --test tests/data-health.test.mjs` covers missing/null, zero, jurisdiction, timestamps, unclassified and partial/offline data. JavaScript syntax and diff whitespace checks pass. Deployed browser checks are recorded in the delivery report, not implied by these unit tests.
