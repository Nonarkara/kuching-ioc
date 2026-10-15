# Regional loader audit — 15 October 2026

MiniMax commit b499991 was already merged and deployed. Its63 tests passed,
but an independent read-only review and deferred-response real-loader tests
confirmed additional issues. No map, dataset, geometry or visual layout removed.

## Confirmed and corrected

- P1: shared busy flag disabled Return to2D during fetches; stale finalizers
  could unlock newer work or leave controls disabled after a2D switch.
- P1: pending manifest activation ignored2D/pilot cancellation and could fly
  the camera after the user had changed modes.
- P2: permanent404, invalid JSON and SHA/geometry failures retried needlessly;
  cancellation during retry delay still invoked another fetch.
- P2: the double-click test fixed dimension at2D, so it failed before fetching;
  the partial-globe test repeated arithmetic without exercising the loader.

Activation now has its own controller. Viewport work never owns the2D escape
control. Manifest, fetch deadlines and retry waits inherit cancellation; checks
also guard non-cooperative late responses before caching or rendering. Request
timers/listeners are cleaned up. There is no static AbortSignal.any/timeout
requirement. Transient network errors,408,429 and5xx retry twice; invalid data
and other4xx fail immediately. Sticky error wording remains in all3 languages.

400ms+1200ms is only1.6s of backoff, not total network time. Per-attempt deadlines
remain15s for manifest and20s for tiles: worst-case network attempts plus backoff
can reach46.6s/61.6s, excluding parsing/render work. User cancellation interrupts
fetches and waits. Off-globe samples mean sky beyond horizon, not sea; sea still
intersects the ellipsoid. Partial sampled bounds remain approximate.

## Evidence before release

- b499991 failed6 of9 initial new regression tests; corrected source passed9/9.
- Added13 real-loader regressions; removed2 misleading tests: full suite74/74.
- Independent reviewer reran22 targeted tests and a shortened-clock timeout
  harness:3 timed-out attempts, then2D+error. No confirmed blockers remained.
- Preserved extract reconciliation across all696 unchanged regional tiles.
- Static build, secrets scan, release and live browser evidence follow in the
  associated release chat. Do not infer those passed from unit-test results.

## Limits

This is a focused loader audit, not a security certification, surveyed digital
twin, complete-building inventory, physical-phone test or native-Cesium proof
from fixtures alone. Heights remain source attributes or explicit estimates.
