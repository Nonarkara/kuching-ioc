# Lessons · Greater Kuching IOC (kuching.nonarkara.org)

Corrections log. Updated after every mistake. **Read at the start of every session.**
Per §13: the same mistake never happens twice.

---

## 2026-05-26 · Bootstrap: §13 adopted

- **What went wrong:** n/a — first entry
- **Correct behaviour:** Log every correction here. Read before each session.
- **How to recognise:** Any time you repeat a fix you've already made.

---

## 2026-05-26 · Never break the 3-tier data loader

- **What went wrong:** n/a — reminder
- **Correct behaviour:** Data always flows: (1) fetch("/api/dashboard") → live server; (2) fetch("./api/dashboard.json") → static snapshot; (3) buildFallbackDashboard() → data.js constants. All three tiers must remain functional. Breaking tier 1 is OK if tier 2 works. Breaking all three = dashboard dark.
- **How to recognise:** Dashboard shows "Loading..." indefinitely = tier 3 (data.js) is broken.

---

## 2026-05-26 · public/api/ must NOT be in .gitignore

- **What went wrong:** n/a — reminder
- **Correct behaviour:** `public/api/*.json` are the baked static snapshot files. They MUST be committed. If they're in .gitignore, the Cloudflare Pages static deploy serves empty data.
- **How to recognise:** kuching.nonarkara.org shows stale/empty data after deploy = check .gitignore.

---

## 2026-05-26 · Static build command is npm run build:static, not npm run build

- **What went wrong:** n/a — reminder
- **Correct behaviour:** `npm run build:static` runs `node build.mjs` which boots an ephemeral server on :9876, fetches all API data, and writes JSON to `public/api/`. Use this for Cloudflare Pages. `npm run build` may not exist.
- **How to recognise:** `public/api/*.json` empty after running `npm run build`.

---

<!-- FORMAT for future entries:
## YYYY-MM-DD · [short title of the mistake]
- **What went wrong:** ...
- **Correct behaviour:** ...
- **How to recognise this pattern:** ...
-->
