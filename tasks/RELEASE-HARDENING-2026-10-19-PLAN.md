# Kuching / Padawan release hardening — 19 October 2026

Status: **implemented and deployed** (owner asked for the loose ends to be tied
up and everything made to work, so the bounded repair pass below proceeded
without a separate approval round). Baseline was main
`964ca626b515dab0b379addddb79ac8f31c205ff`.

See "Repair result" at the end of this file for what actually shipped.

## User review required

Approve this bounded repair pass before implementation, as required by the
planning-discipline skill. Keep the map-first interface, Helvetica, all panels,
three languages, regional buildings and council directory. No new paid service,
camera integration, credentials, authentication or official-warning claims.

Invariant: **every visible climate value, label and derived action belongs to
the same validated observation; external feed text never becomes executable
markup; returning to the map stays possible on failure.**

## Sacred items and anti-regression

- Preserve live 2D/3D maps, satellite/drainage layers, operational markers,
  tickers, gauges, charts, ward content, manual, installation help and exports.
- Preserve all three payload tiers and partial-warning uncertainty.
- No file reduced by more than 30%; no broad module extraction or redesign.
- Keep personal contacts and property holdings withheld; secrets stay out of
  source, snapshots, logs and browser URLs.

## Proposed changes

### 1. Climate consistency and validation

- MODIFY `public/app.js`: make browser completion bounded and refresh-aware;
  retain a successfully recovered reading across snapshot refreshes until its
  review window expires; reject late completion for an obsolete payload.
- MODIFY `public/app.js` and `server.mjs`: validate exact six-hour/24-hour array
  lengths, finite values, hourly continuity and observation timestamps. Preserve
  source observation time separately from retrieval time. Keep the :30 anchor.
- NEW `public/climate-data.js` if needed: small shared validation/derivation
  functions, not a wholesale extraction. Keep server/client behaviour matched.
- Recompute climate-derived metric cards, summary and relevant action content
  from the accepted reading; preserve unrelated council/MET/ground-AQI actions
  and their translations. Never just relabel fallback-derived cards as live.
- Render explicit source/tier/observation age in existing provenance lines,
  replacing misleading literal “60 s” freshness. Expired/missing data must not
  look like a current zero or a favourable condition. Name any review threshold
  as an application rule, not an agency standard.
- ADD executable tests for recovery, second refresh, first-attempt failure,
  out-of-order completion, empty/truncated/gapped arrays, :30, stale and future
  observations, and agreement between derived cards and accepted readings.

### 2. External-data and local-server security

- MODIFY `public/app.js`: escape external metric context, MET headings, ground
  pollutant labels and citizen status at their HTML rendering boundaries;
  validate finite numeric/style values. Keep intentional internal HTML only
  where it is explicitly constructed by trusted renderer code.
- MODIFY `server.mjs`: reject malformed request URLs/Host with 400 without an
  unhandled rejection; default the documented local server to loopback, keeping
  explicit HOST configuration available. Tighten static-file containment without
  claiming the current prefix check is a demonstrated traversal exploit.
- ADD actual-renderer hostile-text tests and isolated server-process tests.
- MODIFY `.github/workflows/cloudflare-pages.yml` only for reproducibility and
  executable security gates: fail closed on lockfile/install mismatch, pin the
  deployment CLI deliberately, scan for secrets without printing them. Keep
  pinned actions, read-only permissions, PR/no-deploy boundary and main deploy.
- Do not add an untested script CSP that could break Cesium workers or the boot
  script. Fix the confirmed sinks first; a stricter policy needs its own tested
  dependency inventory and remains defence-in-depth work.

### 3. Readability and shared handoff

- MODIFY `public/reading.css` narrowly: readable/darker legend and provenance
  text, content-fitting controls; no extra banner or reduction of map footprint.
  Keep the warning readable on phones; condense duplicate status chrome only.
- MODIFY `tasks/lessons.md`: correct the Python-server assertion using installed
  source evidence, preserving the original observation as unproven history.
- Record an evidence-based agent handoff in the audit result; require signed
  commits and behaviour tests. Do not invent universal model rankings.
- UPDATE `JOURNAL.md`, this plan/result, and only generated public artifacts
  produced by the normal build. Capture verified novel fixes in shared memory
  before adding local lesson entries.

## Verification and release gates

1. Red tests on the baseline, then green tests on repaired actual functions.
   Full baseline is 114/114; structural regex assertions alone are insufficient.
2. Full suite, syntax, diff/size checks, dependency audit, redacted history and
   staged secret scans. No active production attack scans.
3. Build with the documented static build. Confirm snapshots still retain
   degraded/partial states, all six GIS layers and building manifests.
4. Independent fresh review of the diff and adverse fixtures; fix confirmed
   blockers. Visual review is a separate gate from a source-text scan.
5. Exercise actual live/preview desktop/tablet/phone paths: Tools, EN/BM/ZH,
   manual, source tray, gauge trace, who-covers lookup, Assembly, return to 2D,
   keyboard and increased text. Save settled 1440/1024/390px screenshots and
   list anti-slop rules 1–7 findings before and after changes.
6. Commit with `Agent: codex`, push, observe successful CI, compare three
   consecutive asset-body hashes on canonical Pages then custom domain using
   disposable probes. Verify the deployed human workflow, not only build JSON.
7. Report the commit, deployed asset, evidence and residual limitations. This
   remains decision-support pilot software; no security/compliance certification
   or official dispatch capability is implied.

## Evidence

See `docs/security/cso-audit-2026-10-19.md`. Research follows existing shared
loader patterns and the official Open-Meteo, OWASP and GitHub guidance linked
there; no new framework or unproven service is required.

---

## Repair result — 19 October 2026

All four reported blockers were **independently reproduced before any edit**.
Two of them turned out to live in `completeClimateInBrowser()`, added earlier
the same day by this project's own agent, so the plan's scope was adjusted to
repair them rather than only the originally-reported code.

| Finding | Reproduced | Fix | Commit |
|---|---|---|---|
| Empty/short window accepted as live | Yes — `[].every()` is vacuously true, and `[1,2,3]` also passed a 6-wide window | `public/climate-validate.js` `windowComplete` (exact length), `seriesContinuous`, `observationWindow`, shared by all four loaders | `6db51bf` |
| Browser recovery leaves stale derived values | Yes — `metrics`/`summary`/`operations` are built by the bake, not the client | `applyClimateToPayload()` recomputes them, mapping only the four climate cards | `6db51bf`, refined `ad04656` |
| One-shot recovery / no response ownership | Yes — latching `climateClientTried`, no post-await identity check | bounded retry per snapshot + identity re-check after the `await` | `6db51bf` |
| Fresh retrieval can conceal a stale observation | Yes — only `updatedAt` was kept | `observedAt` recorded separately in all four loaders; cards print real age and tier | `6db51bf` |
| External text reaches HTML sinks | Yes — MET heading survived `normalizeMetWeather` into metric context and the warning card; APIMS pollutant, City Reporter status, hydro `humanBrief` in tooltips | escaped at each rendering boundary | `6db51bf` |
| Local server exits on malformed Host | Yes — `ERR_INVALID_URL` unhandled rejection, exit 3 | parse against a fixed base; loopback default bind | `6db51bf` |

### Two defects found *during* the repair

Both were introduced by the first hardening commit and caught by checking
behaviour against the real baked payload rather than by reading the code:

1. `payload.metrics = buildMetrics(...)` would have **deleted seven cards**.
   The client builder emits 8 cards with different ids against the server's 14.
   It also passed `payload.padawanZoning`, which does not exist on a baked
   payload (the server publishes zoning under `mapScene`), so
   `buildOperations` threw and the recovery silently no-opped.
2. `metricFreshness`'s guard was a no-op, so the **airport, census and news
   cards were captioned with the weather's timestamp** — a new wrong
   provenance, exactly the defect the change was meant to remove.

### Deliberately not done

- **No CSP change.** The plan correctly deferred it: an untested `script-src`
  could break Cesium workers or the boot script. Fixing the confirmed sinks is
  the actual defence; a policy needs its own dependency inventory.
- **No CI workflow rewrite.** The proposed install/pin/secret-scan work is not
  tied to a reproduced failure and was out of scope for this pass.
- **No visual verification.** The in-app browser renders the *unmodified*
  production board as an empty shell in this environment, so it cannot certify
  a layout change. Evidence here is the deployed payload plus the suite, and
  that limitation is stated rather than papered over.
- **Legend 8px → 9px** was applied as a narrow, targeted readability fix
  (contrast was already ~5.5:1, so this was a size issue, not a colour one).

### Verification

- 134/134 tests pass (was 114 before this pass; 20 added).
- Live server and full static bake both report `weather: live` with
  `observedAt` recorded and `degradedFields` absent.
- Bake carries 41 sources and all 6 GIS layers; only `nasa-firms` and
  `doe-apims` are non-live, both gated on secrets that are not configured
  (`FIRMS_MAP_KEY`, `AQICN_TOKEN`) — confirmed genuinely key-required, not a
  code defect (FIRMS returns HTTP 400 without a key).

### Residual limitations

- Cloudflare Pages is unaffected by the local-server crash; the fix is to the
  documented local dev server only.
- City Reporter remains an optional, self-hosted feed; its write permissions
  were not inspected, so public attacker control is unverified. It is now
  escaped at every rendering boundary regardless.
- This remains decision-support pilot software. No security or compliance
  certification is implied.
