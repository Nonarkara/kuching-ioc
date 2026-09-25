# MPP reference and language review — 25 September 2026

## Delivery status

The Helvetica-style CSS is a separate production change, commit `fb586ba`.
The MPP directory and expanded language layer are a **review draft**, not a claim of complete trilingual coverage. Do not merge this branch into production until the items below are resolved.

## Implemented in the draft

- A collapsible directory links to MPP-listed complaint, drain, road, tree, councillor, payment and booking channels. It does not submit anything or dispatch crews.
- Public office number, messaging-only hotline, counter hours and the Secretary's formal name are sourced below. No photograph is published.
- 147 additional English / Bahasa Melayu / Simplified Chinese phrase triples, plus numeric message patterns, supplement the existing translation keys.
- Text-node translation preserves map nodes and event handlers. Source text, article links and identifiers are not translated by arbitrary word substitution.
- Language selection is persisted; manual language buttons now update the dashboard language too.
- Fourteen exact-source news entries have three-language headline summaries, original URLs, source dates and a machine-draft label. These are **headline-based summaries**, not summaries of an article body that was never fetched.
- Missing or changed-source translations remain explicitly pending. The translation script uses only a loopback Ollama endpoint and is not part of cloud CI.

## Required before “completely trilingual”

1. Finish coverage of generated operational narratives, deeper forecast/satellite/locality explanations, popups, and exported briefs. A phrase catalogue passing its unit tests does not prove the entire rendered dashboard is translated.
2. Have Bahasa Melayu and Chinese readers review terminology and safety-related wording. The `multilingual-type` skill requires native-reader review before public civic release.
3. Review each draft news summary. Local-model output initially mistranslated Kanowit, convenience stores, haze and “unhealthy”; these observed errors were corrected, but no independent human review has occurred.
4. Choose and document a reliable translation refresh process. New articles will be labelled pending until a new translation bake is reviewed. Do not advertise automatic complete news translation.
5. Run final browser regression against the actual deploy, not only this local preview. Local preview uses the pre-existing uncommitted server/template work; those files are intentionally excluded from this branch's commits.

## Official sources checked

- [MPP home and public-service links](https://mpp.sarawak.gov.my/web/home/index/)
- [Contact details and counter hours](https://mpp.sarawak.gov.my/web/subpage/webpage_view/225)
- [Staff directory: Ir. Ts. Goh Thiam Ho, Municipal Secretary, extension 302](https://mpp.sarawak.gov.my/web/subpage/staffcontact_view/72)
- [Drain-clearing contractors, 2026](https://mpp.sarawak.gov.my/web/subpage/webpage_view/258)
- [Road and minor civil-engineering contractors, 2026](https://mpp.sarawak.gov.my/web/subpage/webpage_view/259)
- [Tree and landscape maintenance, 2026](https://mpp.sarawak.gov.my/web/subpage/webpage_view/257)
- [Councillors and responsibilities, 2025–2028](https://mpp.sarawak.gov.my/web/subpage/webpage_view/175)

These are checked reference links, not a live contractor availability feed. Maintenance zones must not be silently equated to councillor wards.

## Evidence

`node --test tests/*.test.mjs`: 13 tests pass (coverage checks, language catalogue, numeric preservation, exact article matching, font tokens).

Local browser at 375px: body width 372px; BM selection set document language to `ms`; manual Chinese selection set it to `zh-Hans` and updated the council directory. Twelve source/contact links rendered; verified Secretary name present; computed heading font begins with Helvetica Neue. Refresh retained language selection. Full edge verification remains pending for this review draft.
