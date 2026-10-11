# Reading and source trust — 11 October 2026

Approved scope: trust fixes and a readable three-language morning brief.
Baseline: origin/main 7bb51ba, isolated worktree; original checkout's pending work untouched.

## Changes

- MET warning failure is unavailable, not zero warnings. Mixed validity dates are partial; dated warnings and undated notices are preserved.
- Official Kuching forecast fields and Malaysia UTC+8 warning times are normalized.
- Every gauge shows its observation timestamp and age. Missing, future or older-than-two-hour observations require review even in a new payload. This window is a UI guardrail, not an agency standard.
- Three primary actions are authored in English, Bahasa Melayu and Chinese. Original directives remain in expandable evidence. Long-range stale charts retain their content but explicitly show an archive warning.
- Default brief text is 16px, TEXT + is 20px, main controls are at least 44px tall. Narrow desktop uses a full-width lower situation rail; the map is preserved.
- Watch, evidence and insights are expandable. The action shortcut opens the morning brief. The trilingual manual explains source-age checks.

## Evidence before release

- 32 tests pass; syntax and whitespace checks pass.
- Static build completed in 43.3 seconds; eight required artifacts passed.
- Browser preview exercised at 1280, 768 and 375px: no document horizontal overflow; default brief computed 16px; enlarged brief 20px; main controls 44px default.
- EN/BM/CN brief switching, summary Enter key expansion, manual open/close by keyboard, and gauge selection to catchment map card succeeded.
- Live MET response probe: three dated regional alerts and one undated notice retained as partial.

## Boundaries

External article summaries remain original-language content; this pass translates the operational brief, not the whole news archive. No shared dispatch, complaint-system access or CCTV feed was added. Hydrology validation and native-speaker review remain outstanding. No accessibility certification is claimed.
