# Re-audit of the SIC release

25 October 2026. Scope: the shipped contextual research feature in Padawan, Globalmonitor, AsiaWatch and MEM. This is a bounded feature audit, not a penetration test or a review of every upstream feed.

## Confirmed findings and repairs

1. **Supplied event dates were lost.** Both React adapters ignored the `properties.date` field produced by the actual EONET service. MEM reconstructed marker selections from display text and conflict cards supplied only a label. Event dates now travel as `eventAt`, separately from observation and publication times. MEM registers structured metadata against the real Leaflet popup objects using its public `getPopup()` API. Valid Date objects normalize to ISO; invalid dates stay absent.
2. **Close could leave the screen.** In the shipped dialog, scrolling put Close at y=-93px. The dialog header now stays pinned. At 390×844, after scrolling 132px, Close remained at y=23px with a 44px target and no horizontal overflow. Seven reverse-Tab steps also kept focused controls below the pinned header. Clicking Close restored focus to Tools. The live returning Padawan session subsequently confirmed a scrolled Close at y=25px.
3. **Returning browsers could run the previous module graph.** This was reproduced on the live MEM session: updated HTML/entry URL, but the dialog still identified itself as the original catalog and omitted the selected event date. Versioned the full native chain: HTML → app/entry → research tools → catalog, plus the CSS URL. Rotated all keys to `sic-2026-10-25-r3` because the partially updated r2 entry could itself already be cached. A regression contract now ties the native dependency URLs to the catalog version.
4. **A burst test depended on host speed.** The global rate-limit test issued 100 requests against a 90-token bucket that refills at three tokens/second. On this loaded host the loop took 10.6 seconds, so a 200 response was legitimate. The isolated test now pins its clock before instantiating a fresh router. The 429 and Retry-After assertions remain; production limiter code is unchanged. The existing injected-clock limiter test still checks refill behavior.

The earlier 384-test total was a sum of suites, including repeated shared tests; it was not 384 distinct UI scenarios. The 26 spatial measurements cover the normal, closed dashboard, not the open research dialog. That distinction is retained below.

## Verification

- Fresh independent reviewer confirmed the timestamp defects, then independently ran 31 focused checks through actual adapters, marker producers, popup and card handlers. No remaining confirmed source blocker in the bounded review. Root performed the native-browser checks.
- MEM tests now execute the actual marker-producing code, not just synthetic consumer metadata, so removing a registration fails the regression. React tests pass the real EONET feature shape through adapter and export. Shared tests cover Date-valued input, separate event/publication/observation fields and cache-chain revision consistency.
- Final suites: Padawan **197**, Globalmonitor **80**, AsiaWatch **111**, MEM **9**. Shared cases run in each host, so these counts are not independent coverage measures. Globalmonitor's corrected burst check passed locally with the focused suite and in the full final CI run.
- Both React production builds pass. The latest CI runs below pass test/lint/build/audit. Padawan CI passes its normal 26-width populated-board spatial checks. No baseline was changed to hide a finding.
- Same returning MEM browser, **without clearing cache**: select the first conflict card, return to Map layers → Investigate. It now identifies catalog r3 and displays `Event date supplied by dashboard: 2026-03-28`. This is the supplied historical event date, not a new observation or confirmation.
- Existing returning Padawan browser: reload → Tools → Investigate → scroll. Catalog r3 loads and Close stays visible. Local phone checks additionally measured the open dialog at 390×844; body text remains 16px and its width is 366px.
- All four public hosts serve the r3 catalog/bundle. The React bundles also include the new event-date label. No new data adapter, provider request or feed-health count was introduced.

## Released sources

| System | Code revision | Receipt |
|---|---|---|
| [Padawan](https://kuching.nonarkara.org/) | `83707a4` | [CI 40178404361](https://github.com/Nonarkara/kuching-ioc/actions/runs/40178404361), success |
| [Globalmonitor](https://globalmonitor.nonarkara.org/) | `ae95f9ff` | [Deployment](https://3f9f885a.globalmonitor.pages.dev), [CI 40180063007](https://github.com/Nonarkara/globalmonitor/actions/runs/40180063007), success |
| [AsiaWatch](https://asia.nonarkara.org/) | `02c0aad0` | [Run 40179870809](https://github.com/Nonarkara/globalmonitor/actions/runs/40179870809), [run 40179870700](https://github.com/Nonarkara/globalmonitor/actions/runs/40179870700), both success |
| [MEM](https://mem.nonarkara.org/) | `a9756fd` | [Deployment](https://01bb8a12.mem-by-non.pages.dev), public runtime files only |

Live screenshot evidence is local and gitignored: `tmp/sic-ui/re-audit-mem-live-date.png`. Original work-in-progress checkouts were preserved; fixes use the existing isolated release worktrees.

## Limits

No fluent-reader review of the new translations is claimed. Provider availability and API rights remain explicitly unverified research-link metadata. Live date verification used the available historical conflict card; EONET/thermal/news-specific transport was exercised with the actual source handlers and fixtures, not a claim that every upstream feed was live during this audit.
