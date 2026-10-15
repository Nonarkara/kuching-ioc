# Regional loader follow-up audit — 15 October 2026

## Scope and authorization

User requested audit, fixes, merge, clean release and live verification of
MiniMax commit b499991. It is already on origin/main; no duplicate merge needed.
No new public API, dataset, architecture or visual design is proposed.

## Conservation law / preserved surfaces

Only the current, enabled 3D view may publish building geometry; choosing 2D
must remain possible while data is pending. Preserve every operational map,
pilot, satellite layer, source record, language, guide and map-first layout.
No file collapse over30%; no new dependency.

## Proposed surgical changes

- public/regional-buildings.js: separate activation ownership from viewport
  refresh; cancel pending activation on 2D/pilot switches; make request deadlines
  and retry waits abortable; retry network/timeouts/408/429/5xx, not malformed or
  integrity-invalid data; stop canceled workers before another request.
- tests/regional-loader.test.mjs: controlled deferred responses, real loader
  calls, camera events, exact request counts, cancellation, stale-view ownership,
  old-runtime abort fallback, partial-globe viewport and permanent errors.
- tests/building-tiles.test.mjs: retain existing coverage; correct misleading
  test names/comments or replace copied-algorithm assertions with real-loader
  evidence. Preserve extract reconciliation and layout assertions.
- JOURNAL.md and result note: record confirmed findings and evidence after tests.

## Verification

Failing regression tests first; targeted suite, all tests, static build, fresh
independent reviewer. Commit with Agent trailer, push, wait for Pages workflow.
Three matching disposable asset probes on canonical then custom domain; live
desktop/phone 3D/Assembly/2D controls and screenshot. Unchanged regional data
already exhaustively verified; verify manifest and representative live tiles.

## Timing correction

400ms+1200ms is backoff only. Three20s tile attempts can take61.6s, and
three15s manifest attempts46.6s. Never report total request time as under2s.
