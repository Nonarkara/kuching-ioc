# SIC: contextual research across Padawan and geopolitical dashboards

Date: 2026-10-25. Status: approved and released; see [implementation evidence](SIC-OSINT4ALL-RESULT-2026-10-25.md) for checks and remaining verification limits.

## Question and finding

Which public investigation tools and directory patterns help people check a locality or event without introducing clutter, spatial hallucination or unsupported certainty?

The supplied screenshot shows OSINT4ALL at https://start.me/p/L1rEYQ/osint4all. Its public repository explicitly identifies itself as the GitHub version of that collection. Borrow its task categories and source discovery; improve them with contextual selection, provenance and limitations. Bellingcat's toolkit supplies a useful complementary pattern: tool descriptions and guides with explicit caveats. This is a design recommendation, not evidence that either directory's linked tools are reliable or currently connected to our dashboards.

## Review required

Approve a first release comprising a small, curated research-link catalog and one contextual entry point in each dashboard's existing tools/evidence interface. No new scraping, paid subscriptions, live feed adapters or framework changes in this release. API integration is a separate pass after provider terms, credentials, coverage and latency have been verified.

AsiaWatch and MEM contain existing uncommitted work. Before implementation, inspect those diffs and coordinate around them; never overwrite, stage or ship another agent's unrelated work. Globalmonitor and Padawan were clean during this research pass.

## Proposed experience

1. A person selects a place or event and opens **Investigate** from an existing tools/evidence surface. With no selection, explain how to select a place and allow browsing the catalog.
2. Show only relevant tasks: locate a place; compare imagery; check an original report/photo/video; inspect civil transport context; consult published organizational records; recover publication history.
3. Each tool states what question it helps answer, geographic coverage, access requirements, limitations and original provider. Label outbound links **Open research tool**. A link is never counted as a live/healthy data feed.
4. Keep the claim's observation/publication time distinct from retrieval time. Where available, retain original URL/language, translated summary, coordinates and location precision, source lineage and unresolved uncertainty.
5. Explain the funnel beside the evidence: raw observation/report → validation and normalization → comparison with independent evidence → visualization → a suggested administrative check. A suggestion is not an emergency order or an automatically verified fact.

No new permanent header row, card wall or default iframe. The map retains visual priority; the panel scrolls without covering selected-place controls. Preserve established readable typography and each project's visual language. Padawan's controls and explanatory copy must be English/Bahasa Malaysia/Chinese, with original sources retained.

## Initial catalog: candidates, not connected feeds

Directory entries are discovery leads. Only the collection/license and Bellingcat overview were directly verified sufficiently for reuse planning; provider-specific integration rights remain unverified unless already established by a project's existing adapter contract.

| Candidate | User task / relevant systems | First-release treatment and constraint |
|---|---|---|
| OpenStreetMap | Check place names, roads and geographic context; all four | External research link; use existing map attribution. Map geometry alone does not verify an event location or municipal boundary. |
| NASA Worldview / FIRMS | Compare dated imagery or thermal observations; all four | Research links alongside existing imagery/feed evidence. Keep acquisition date, resolution and coverage visible; thermal anomaly does not establish cause or flood depth. No new adapter implied. |
| Mapillary | Inspect available street-level context; primarily Padawan | Candidate external link after coverage check. A historical image cannot establish current road conditions. |
| InVID-WeVerify | Help an operator inspect public media; all four | Link to reviewed guidance/tool after direct availability check; no automatic verification badge and no citizen-media upload. |
| Internet Archive / Wayback Machine | Recover a source's publication history; all four | Manual link; an archived page establishes what was published, not whether it was true. Do not archive private reports. |
| VesselFinder / MarineTraffic | Civil shipping/port context; geopolitical sites, Padawan only if locally useful | Manual links only until API access/reuse terms are verified. Missing AIS is missing coverage, not proof of an empty sea. |
| Published company registries / OpenCorporates | Research an organization relevant to a public claim; geopolitical sites | Manual contextual lookup, no bulk personal profiles or automatic identity matches. Verify jurisdiction and record date. |
| ICIJ Offshore Leaks | Historical documentary context; geopolitical sites | Optional advanced research link with source limitations. ICIJ says these are leaked records, not a standardized registry, and duplicates may exist. A listing is not a finding of wrongdoing. |

Each adopted catalog record must contain `id`, original provider, canonical HTTPS URL, task, applicable systems/geographies, access mode, cost/auth status, reuse/attribution status, last link check, limits and discovery credit. Use explicit `not verified` values rather than inventing terms. An adapter, if later approved, additionally needs observed/published/retrieved timestamps, refresh policy, failure state and a tested data contract.

## Targeted changes after approval

Paths below are scoped starting points; read current project instructions and source contracts before edits. Additive components/catalogs should carry the new behavior rather than expanding already large application files.

| Live system | Checkout and existing integration points | Proposed surgical addition |
|---|---|---|
| kuching.nonarkara.org | This repository: `public/evidence.js`, `public/research-data.js`, `public/app.js` (`renderResearch`) | Add a translated contextual research section to existing evidence/Research surfaces; preserve locality evidence and raw-to-decision explanation. |
| globalmonitor.nonarkara.org | `../conflict-tracker/v3-classic`: `src/App.jsx`, `src/components/SourceHealthModal.jsx`, `src/components/SourceStack.jsx`, `src/data/dataSources.json` | Add a small research catalog/component, expose through existing Tools and selected-context surfaces. Do not append manual tools to feed-health counts. |
| asia.nonarkara.org | `../conflict-tracker/v3-global`: corresponding Tools, source-health and country-news surfaces | Reuse the catalog schema with Asia-relevant coverage; preserve theater filters and ongoing map/operational-shell work. Deploy only to the AsiaWatch target. |
| mem.nonarkara.org | `../conflict-tracker/v2-standalone`: `index.html`, `app.js`, `style.css` | Add a compact vanilla-JS research disclosure in existing information surfaces; retain maps, tabs and the distinction between authored Papers and source evidence. |

Do not confuse globalmonitor with MEM's separate `global.nonarkara.org/api` backend. Do not deploy AsiaWatch into Globalmonitor's Pages project. No shared backend modification is proposed.

## Evidence and security boundaries

- Render source text as text; never inject scraped markup. Allowlist outbound HTTPS destinations and validate coordinate/query construction. New-tab links use opener/referrer protection.
- No automatic external requests when the panel opens. No sending private report content, identity information or precise citizen locations to third parties. Queries are operator initiated and explain what context leaves the dashboard.
- Missing/ambiguous locations remain unlocated or explicitly approximate. Do not snap a national report to a city center and present it as a measured event.
- Preserve original sources under translations. Syndicated stories, mirrors and translations of one report are one lineage, not independent corroboration.
- Keep forecasts, estimates, sensor observations and citizen/news reports distinguishable. No unsupported composite confidence percentage.
- Do not import the directory wholesale: credential-cracking, leak-search and personal-profiling tools do not serve the proposed civic workflow.

## Sacred items and verification

- Preserve live maps, 3D buildings, charts, tickers, source status, manuals, existing content and layout guards. No file reduction beyond 30%.
- Test context selection, no-selection guidance, geography filters, missing timestamps/locations, duplicate lineage, safe URLs, hostile source strings and translations. A manual research link must never increase connected-feed counts.
- Exercise keyboard opening/closing, focus return and screen-reader labels; inspect 390/719/1024/1440 widths and 200% zoom. Selected map location and evidence must agree, and no panel may obscure freshness text or critical map controls.
- Run each repository's documented checks/build and Padawan's populated-board spatial/portable checks. Do not rebaseline to hide a new overlap, unreadable text or clipped evidence.
- Ship one system at a time, starting with Padawan; then Globalmonitor, AsiaWatch and MEM. Isolate commits from existing work. Verify the intended domain's deployed revision, real loaded panel, links and data-source counts before calling that system complete.
- This research pass has not executed those application checks, changed source code or deployed anything.

## SIC credit and primary sources

Proposed visible credit: “Research-tool discovery informed by OSINT4ALL. Verification workflow informed by Bellingcat's Online Investigation Toolkit. Data and tools remain credited to their original providers.” Do not imply endorsement or authorship by the screenshot's social-media account.

- OSINT4ALL collection and provenance: https://github.com/osint4all/osint4all.github.io and https://osint4all.github.io/
- Directory license checked 2026-10-25: https://raw.githubusercontent.com/osint4all/osint4all.github.io/main/LICENSE — CC0 1.0. It does not grant rights over the independently linked services or their data.
- Bellingcat's task categories, reviews and inclusion caveat: https://bellingcat.gitbook.io/toolkit — write our own concise explanations and link to guidance; no wholesale copying of its reviews.
- ICIJ database provenance and duplicate-record limitations: https://offshoreleaks.icij.org/pages/about

Direct fetches of the proposed NASA documentation page, VesselFinder API page and individual InVID guide were blocked/timed out during this pass. They are unresolved access/terms checks, not verified integrations or evidence that those services are offline.
