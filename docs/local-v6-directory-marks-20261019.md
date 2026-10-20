# V6 directory marks — local integration only

The user authorized connecting the later frozen mark package to the existing local preview. Work is isolated in the existing `v6-core-pages-local` worktree; no accepted mark registry, production service, pointer, policy text or publication state is changed.

## Input and merge

- The frozen original-role baseline is `accepted-role-registry.json` under the primary checkout’s `.local/university-marks-top200-20261018T194605Z/`, SHA256 `230bfb47023da38e8b23d8995d40f5401123dfd3f3db485e2ff0b4f01bb1c5a4`.
- The 211-role delta uses `.local/university-marks-external-fill-20261019T015011Z/handoff/manifest.json`, SHA256 `1b78097f130c9ada84311df68436956a3c32ef43b37890d50d2e6fd79fbe37e9`. All 1,423 handoff files and the frozen ZIP/artifact-manifest hashes were verified. The delta is not a whole-site public registry.
- The prior local diagnosis binds 244 missing compact roles: 192 from the preserved original-role baseline and 52 from the delta, using canonical slugs, exact names/countries or already-reviewed name aliases. The selected objects must match the frozen inputs exactly.
- Existing accepted resources for 525 catalog universities remain first choice and unchanged. The other 59 catalog identities remain explicit unresolved gaps, with generic university icons; no fuzzy identity or system/campus merge was introduced.

## Local presentation contract

`scripts/prepare-v6-local-directory-marks.py` copies the selected original WebP bytes into a private local export. It verifies original/variant hashes, native raster caps, duplicate roles and unsafe paths. It does not recrop, recolor, resize, download alternatives, alter original acceptance or approve publication. Full source records, restrictions and selected file hashes remain in the private selection receipt.

`university-marks-local.json` is separate from the accepted registry. New images use the allowlisted development-only `/api/local/university-marks/<sha256>.webp` route, which checks loopback hostname, file allowlist and the returned bytes' hash. It serves no originals, arbitrary paths, private provenance or unselected files. Production mode returns 404 and ignores local candidate marks. Public-use approval remains false.

The shared `UniversityMark` uses the new compact candidates only where no existing accepted mark exists. Directory/featured record cards request the larger directory role; the normal64px frame stays consistent with existing cards, and a minimum64px image gets a72px frame to retain64px of actual content; small suggestions use 32px, and a 24px chip below a candidate’s minimum retains the generic icon. Compact files never substitute for Hero/title assets. École Normale Supérieure de Lyon and UNIFESP require 64px and do not enter 32px suggestions. All added images retain their backing and actual pixel caps, including native32 MUNI and native50 Deakin. A failed image renders the generic icon. Adjacent canonical university names remain text links.

## Validation and local operation

Evidence lives in `.local/v6-directory-marks-integration-20261019/`; final counts and readbacks are bound in its completion receipt. The local development listener on 3270 was restarted after hot-reload timeouts, using the same existing preview flags. No production build, service restart, deployment, push, cutover or search notification was performed.

Local review: http://127.0.0.1:3270/zh/universities?page=4 . The three formerly generic marks there (American University, AUB and Amirkabir) now use their exact selected compact files; the three existing accepted marks are preserved.

Completed validation: `pnpm check`, final web typecheck, related role/native/production-gate tests and `git diff --check` passed. All244 exported images decoded to exact recorded WebP dimensions; all244 HTTP responses matched their content hashes. The final directory browser acceptance passed186 checks across7 locales,2 themes and320/720/820/1672px viewports, with no browser errors/warnings. Another30 checks covered home, search, rankings, Changes and the existing Harvard policy page at390/820/1440px in both themes, with no browser errors. These are Chromium/emulated-viewport checks; no physical-device or Safari acceptance is claimed. Initial hot reload encountered timeout/stale development module behavior; the owned local listener was restarted and final dedicated-browser reports were clean.
