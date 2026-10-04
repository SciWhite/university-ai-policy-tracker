# V4 expansion: reviewed-snapshot cohort, 3 October 2026

Local candidate for the combined student-plugin/site release. Existing 33 V4 pages and their artwork remain intact. Adds Aalto, Cornell and Melbourne: the only effective strong snapshots not already in the V4 cohort. All 17 effective strong snapshots now have a V4 presentation. This is a presentation change, not a policy-data release, new secondary review, or production deployment.

Seven other indexed snapshots remain `needs_review` (Jagiellonian, SNU, Sultan Qaboos, Tsinghua, Tokyo, Innsbruck, Zhejiang); none is promoted. Other published claim-only schools remain queryable through MCP and their website records. Absence of an authored V4 guide is not evidence that a school lacks AI policy.

## Policy-to-image mapping

| School | Image / exact heading | Evidence and scope | Native boundary |
|---|---|---|---|
| Aalto | Hero: CHECK THIS TASK | claim-aalto-001 / #snapshot-coursework | Course/task teacher restrictions control use. |
| Aalto | Do: DO / MARK AI CONTENT | claim-aalto-004 / #snapshot-disclosure | Generated content is marked; attribution does not override restrictions. |
| Aalto | Don't: DON'T / NO SECRET DATA | claim-aalto-005 / #snapshot-privacy_data | Secret/sensitive personal data excluded from Aalto AI Assistant; confidential data is not universally prohibited. |
| Cornell | Hero: FIND YOUR COURSE POLICY | claim-cornell-university-20 / #snapshot-coursework | Faculty choices and example syllabus policies, not one universal policy. |
| Cornell | Do: DO / ATTRIBUTE PERMITTED USE | claim-cornell-university-5 / #snapshot-disclosure | Attribution for permitted use; verify output (claim-6). |
| Cornell | Don't: DON'T / UPLOAD RESTRICTED DATA | claim-cornell-university-19 / #snapshot-privacy_data | Sensitive/restricted Cornell information excluded from public AI tools. |
| Melbourne | Hero: CHECK YOUR SUBJECT | claim-university-of-melbourne-1 / #snapshot-coursework | Subject Coordinator authorisation before assessment use. |
| Melbourne | Do: DO / ASK BEFORE ASSESSMENT | claim-university-of-melbourne-1, -4 | Ask about assessment, produce assessed skills yourself. |
| Melbourne | Don't: DON'T / ASSUME PERMISSION | claim-university-of-melbourne-1, -6 | Other subjects and learning support do not authorise this assessment. |

The school-specific guidance is pinned to reviewed claim fingerprints and also requires an effective strong snapshot. Substantive reviewed-data changes or downgraded snapshots suppress the illustrated guide. Seven-language controls retain English policy prose and original source evidence.

## Official-source check

On 3 October, Aalto teaching/learning guidance, student tips and AI Assistant data limits and Cornell CTI academic-integrity / IT guidelines corroborated the depicted actions. Cornell sample syllabus language now includes assignment-by-assignment examples; artwork deliberately does not freeze a category count. All three snapshots have no retained exam-specific rule; absence is not exam permission.

Melbourne's student source redirects from `/academic-skills/resources/study-skills/...` to `/academic-skills/study-skills/...`. The current student page corroborates Subject Coordinator authorisation and assessed skills. Its retained privacy section was not found in the moved page; the CSHE teaching source could not be reverified (web timeout and HTTP error). New images cover only the corroborated assessment checks. A visible source supplement and scope detail identify the older snapshot's citation/privacy/tool sections as dated evidence. No source URL, claim, review status, snapshot timestamp, or public API data was silently rewritten.

## Image provenance

User-authorised gateway: `https://api.apexamkit.com/v1`, models `gemini-3.1-flash-image` and `muse-image`. Credentials stay in a mode-0600 file outside the repository. Gemini uses the existing project chat-completions caller with Stanford style/character references. Muse uses image generations with the written character/style brief (no image-reference upload). The gateway returned an Aalto Do timeout and Cornell Do HTTP 524; these unsuccessful attempts are not assets. Muse returned 502 for the Cornell Do and Don't attempts; the remaining four panels use the built-in image model fallback. A targeted Cornell Don't edit changes the action phrase to UPLOAD RESTRICTED DATA, so DON'T negates the prohibited upload rather than the protective action.

Prompts are retained alongside this brief. Raw candidates remain local; only selected, visually checked JPEGs are copied under public assets and reduced to at most 1280px width without crop. Asset hashes, sizes and selected models are recorded in `selected-assets.json`. Neither HTTP 200 nor static rendering substitutes for browser or policy-source acceptance.

## Acceptance

- 105 targeted tests passed, covering the existing 36-school scene contract, source links, preserved images, new fail-closed snapshot/fingerprint gates, and the visible Melbourne source limitation.
- Web typecheck passed. No production build was run for this batch.
- 21/21 HTTP routes (3 schools x 7 locales) passed V4, three-image and native claim/snapshot anchor checks; 9/9 image responses passed.
- Actual in-app browser: 18 combinations (3 schools x 1440/390/720px x light/dark), no horizontal overflow, all three images loaded, two action columns on desktop and one in narrow windows. Screenshots saved locally. The 21 seven-language routes also rendered with translated action controls and English policy prose, checked at 390px.
- English to Chinese switch on Aalto preserved the V4 guide. Cornell's claim-6 keyboard link opened its enclosing reviewed-claims disclosure. A first automated pointer click did not navigate; keyboard activation confirmed the link/reveal path. This does not claim every pointer interaction or official-source link was browser-tested.
- No live deployment, public release activation, directory submission or policy-data change is implied by these local results.
