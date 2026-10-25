# SIC research tools: implementation evidence

25 October 2026. Approved scope: contextual research links in Padawan, Globalmonitor, AsiaWatch and MEM. No new API feeds, scraping or subscriptions.

## Changed

- Added one on-demand native research dialog, a curated catalog and source credits. Padawan offers six relevant tools with EN/Bahasa Malaysia/Chinese copy; the geopolitical sites offer eight with EN/Thai/Chinese copy. Method, access and credits expand only when requested.
- Existing Tools menus open the dialog in Padawan and React apps. Locality evidence and React country/event surfaces also offer contextual actions. MEM uses its existing Map layers disclosure and carries selected card/marker labels.
- Research URLs are exact allowlisted HTTPS destinations. Selection text and coordinates never become outbound query parameters. Rendering uses textContent; there are no provider requests, scripts or frames on opening. Manual links remain outside feed-health counts.
- Explicitly distinguish observation/publication/recording times. Missing data, imagery resolution, thermal detection ambiguity, AIS coverage, syndication and documentary limitations are explained.
- Kept the maps, 3D, authored Papers, feeds and source-health logic. MEM retains its Source Sans 3/dark presentation; other hosts retain their existing Helvetica presentation.

## Review findings repaired

Independent reviewer found host Escape shortcuts could close MEM's underlying drawer, and a shared font could overwrite its deliberate type. The dialog now stops keyboard-event propagation while native dismissal remains available, and MEM uses host-specific font/background tokens.

More importantly, old panel state could select the wrong research subject. Padawan now tracks the latest explicit gauge/locality/ward selection separately from background rendering; DID timestamps retain MYT (UTC+08). React country/theater changes clear previous events, and marker selections clear country state. Independent reviewer rechecked these fixes and ran the selection suites without remaining blockers.

## Local verification

- Padawan: 195/195 tests; Globalmonitor: 77/77; AsiaWatch: 107/107; MEM: 4/4 new catalog/dialog tests.
- Both React production builds pass. New research source scan: zero Non-Slop findings. Existing bundle-size advisories remain.
- Padawan frozen spatial gate exits successfully; portable floor reports 26 populated boards, no overflow or evidence-button overlap. Baseline unchanged. This measures the normal dashboard, not the new open dialog.
- Root exercised actual browser flows in all four local previews: menus/disclosures, task changes, language changes, Escape and return path. Padawan selection carried “8th Mile” into research. Phone and tablet checks show 16px body text, content-sized controls and no dialog horizontal overflow. Screenshots are local evidence in `/tmp/sic-ui/`; capture dimensions must be confirmed in the DOM, not inferred from filenames or a stale compositor frame.
- Independent appearance review used screenshots and source. Its separate browser session was unavailable; root performed the actual interactions. No fluent-speaker review of the newly written translations is claimed.

## Release routing and unfinished work preserved

Cloudflare deployment history, rather than branch names alone, identifies the current production lineage:

| Site | Starting deployed revision | Isolated checkout |
|---|---|---|
| Padawan | e1d4f58 | Existing clean project checkout |
| Globalmonitor | 69642b12 | `/Users/nonarkara/.codex/worktrees/sic-globewatch` |
| AsiaWatch | a9d05dc1 | `/Users/nonarkara/.codex/worktrees/sic-asiawatch` |
| MEM | 60fc849 | `/Users/nonarkara/.codex/worktrees/sic-mem` |

Globalmonitor's newer deployed lineage is on `origin/codex/oracle-openrouter-fallback`, not the older `v3/main` snapshot; release must preserve that deployed lineage. AsiaWatch's original checkout has a separate unpushed commit and dirty work, and MEM has dirty app.js changes. These original checkouts were not modified. A later agent should merge the released research additions into those working copies without resetting or discarding their work.

Production deployment and live interaction evidence will be appended after publishing. This document does not claim that a local pass is a completed release.
