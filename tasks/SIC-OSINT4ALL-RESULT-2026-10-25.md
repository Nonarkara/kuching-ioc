# SIC research tools: implementation evidence

Subsequent audit: [confirmed defects, corrections and current release receipts](SIC-RE-AUDIT-2026-10-25.md). The original report below is historical; its test total does not establish open-dialog coverage.

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

- Padawan: 195/195 tests; Globalmonitor: 77/77; AsiaWatch: 108/108 (including the release repair below); MEM: 4/4 new catalog/dialog tests.
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

## Published and verified

| Site | Released revision | Deployment / CI receipt |
|---|---|---|
| [Padawan](https://kuching.nonarkara.org/) | `0a753c8` | [CI 40163972674](https://github.com/Nonarkara/kuching-ioc/actions/runs/40163972674), success; build manifest carries `0a753c8f8e7a9d94afb955e4ed9f0a42` |
| [Globalmonitor](https://globalmonitor.nonarkara.org/) | `95a60db1` | [Deployment](https://129f1313.globalmonitor.pages.dev), [CI 40165127965](https://github.com/Nonarkara/globalmonitor/actions/runs/40165127965), success |
| [AsiaWatch](https://asia.nonarkara.org/) | `82d97283` | [Deployment](https://ee952173.asiawatch.pages.dev), [CI](https://github.com/Nonarkara/globalmonitor/actions/runs/40165105530) and [deployment workflow](https://github.com/Nonarkara/globalmonitor/actions/runs/40165105521), both success |
| [MEM](https://mem.nonarkara.org/) | `da5c6c2` | [Deployment](https://26481386.mem-by-non.pages.dev); staged only the eight public runtime files, excluding Git metadata, docs and tests |

Padawan and MEM serve catalog bytes matching the local SHA-256 hashes. The live React entry bundles contain both the research workflow and `sic-2026-10-25` catalog identifier; Cloudflare confirms the released source revisions. Globalmonitor's entry also matched the locally built bytes. AsiaWatch's release is built in CI, so local bundle-byte identity is not claimed. The three common source assets are byte-identical across all four checkouts.

Local browser reproduction after the selection repair: chose PANGKALAN EMPAT (A001), closed evidence, chose 8th Mile, then Tools → Investigate. The panel showed 8th Mile, not the old locality, and retained the supplied observation time with MYT (UTC+08).

The browser bridge initially disconnected, then recovered during the final audit. Actual **live** workflows subsequently passed in all four systems: Globalmonitor Tools → shipping research → Escape and focus return; AsiaWatch Tools → organization records; MEM Map layers → research → Chinese → Escape; Padawan Tools → Bahasa imagery research and Chinese. A visible live Padawan tab was checked at actual DOM dimensions of 390×844 (366px dialog) and 1440×900 (660px dialog), both with 16px body text and no dialog horizontal overflow. Final live screenshots: `tmp/sic-ui/padawan-live-phone.png` and `tmp/sic-ui/padawan-live-desktop.png` (local, gitignored).

**Verification boundary:** no fluent-speaker review is claimed for the newly written translations. Some earlier screenshot filenames describe the requested size, not the actual size: the browser viewport capability affects the active visible tab, and a background-tab capture can retain a different viewport or stale compositor frame. The final live captures used the visible tab and checked DOM dimensions before capture. Do not infer a viewport from a filename alone.

## Release-check repairs

AsiaWatch's independent CI exposed pre-existing lint errors in the starting revision: a CityWall initial probe invoked from an effect and two unused source-label values. The initial probe now uses a cancellable zero-delay timer (with a behavioral unmount test); the existing labels appear as source tooltips without changing layout or removing provenance. Lint passes with one pre-existing unused-disable warning.

The subsequent audit found GHSA-mrhx-c7xc-m3w5 in Zod. Both React lockfiles now pin the compatible development dependency to 4.6.7. Each update changes only the package version, resolved tarball and integrity entry; npm reports zero vulnerabilities. Fresh CI test/lint/build/audit passes for both release revisions. This development-only patch does not change Globalmonitor's runtime bundle, so its re-deployment uploaded zero changed static files while recording the patched source revision.

The live MEM check also found its depa logo pointed to the retired `Logo%20depa-01.png` asset and disappeared on error. Both header/About references now use the existing `depa-logo.png` asset, verified HTTP 200; no logo or attribution was removed.

Verified selection lesson: [shared Markdown source](</Users/nonarkara/Documents/SecondBrain/Scars/Debug-Logs/2026-10-25-contextual-research-must-follow-the-latest-explicit-selection-not-panel-state-priority.md>).
