# Metric provenance MSH repair — 23 October 2026

Owner requested audit, fixes, MSH, merge and shipping of MiniMax's findings.
Invariant: an evidence action never paints over a reading's provenance, and
observation age never comes from a retrieval clock.

Scope: app.js metric heading and provenance; reading.css normal-flow evidence
button; evidence.js explicit NREB observation formatter; measurement.js and
spatial-check.mjs targeted rendered guard; portable gate and regression tests;
fresh spatial baseline after fixes. No upstream instrument replacement.

Preserve map, 3D, charts, ticker, fonts, metric values, original NREB timestamp,
all prior content and source attribution. No file reduced by 30%.

MiniMax's pending baseline is preserved at
`/tmp/kuching-minimax-pending-baseline.json`; it describes pre-repair geometry.
Do not bless the NREB clipping merely because its signature has an old reason.

Verification: reproduce old geometry; fail overlap and NREB clipping mutations;
test observation/retrieval disagreement, malformed and future timestamps;
render 390/1024/1440 and breakpoint neighbours; independent review; two frozen
measurements; bounded enforcing gate; tests, CI, deploy and live byte/flow proof.
Full upstream settle/re-vendoring remains a separate deliberately scoped task.

## Verified repairs

- Reproduced freshness glyph overlap at 390–1024 and NREB clipping128px at
  1041 /75px at1440. Normal-flow heading now keeps the 24px action separate.
  Desktop band68→77px is the action's earned height; map stays dominant.
- Observation age parses only NREB's known English Malaysian clock. It never
  reads fetchedAt. Unknown/future clocks do not become fresh. Full raw observation
  and separate retrieval time remain in the trilingual evidence dialog.
- Independent review closed impossible-ISO-date and zero-geometry detector
  findings. Pixel review passed390/1024/1440. Test startup limit15s accommodates
  machine load while detecting the old45s retained-watchdog defect.
- Actual rendered mutations: restoring positioned button detects108px² glyph
  overlap; restoring raw timestamp detects122px clipping. Neither can be blessed
  by an inherited baseline reason.
- 187 tests passed. Complete frozen reports A and C are byte-identical (61,948 bytes);
  incomplete B (last two pages timed out) is explicitly excluded from approval.
- Scoped hang repair: clear the watchdog timer in finally. The45-minute Promise
  race timer previously survived successful work; only report/update forcibly
  exited. Deadline tests cover timeout, rejection and actual child exit.
- Follow-up: the full enforcing run printed PASS but retained browser output
  pipes even after the browser parent died. Explicitly destroy this audit's
  stdout/stderr streams and unref its killed child; no unrelated browser is
  touched. Process completion is verified separately from the geometry verdict.
- Final plain enforcing run completed all26 widths, printed PASS and exited0
  after the stream teardown fix. The earlier PASS-with-open-process run was
  terminated only by its exact audit PID and is not claimed as an exit pass.
