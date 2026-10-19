# Kuching / Padawan release hardening — 19 October 2026

Status: **audit complete; repair plan awaiting owner approval**. No application
source changed, no new commit pushed, and no new deployment made in this audit.
Baseline: main `964ca626b515dab0b379addddb79ac8f31c205ff`, clean and up to date.

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
