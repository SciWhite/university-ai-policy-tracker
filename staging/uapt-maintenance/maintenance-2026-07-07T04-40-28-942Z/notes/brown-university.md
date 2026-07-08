# Brown University — Source Health Maintenance Note

**Maintenance run:** `maintenance-2026-07-07T04-40-28-942Z`
**Entity slug:** `brown-university`
**Target source:** [Generative AI as a Research Tool](https://ithelp.brown.edu/kb/articles/generative-ai-as-a-research-tool)
**Source type:** `official_guidance`
**Existing snapshot hash:** `2cacca85dd2bbd4476903b24aa0eae2c6445cb532c42b621d1b39811d0929252` (2026-05-24, 13,395 bytes)
**Live fetch (2026-07-07):** HTTP 200, same final URL, same title, same page structure.

## Assessment: No policy-content update

The live page remains materially identical to the last snapshot. Differences observed are limited to:

- **Chrome/noise:** Vote count shifted from "244 of 405" to "245 of 409" — analytics noise, not policy content.
- **Notification banner:** A system-level "March 19: New Look for Duo Two-Step" alert appears in the old normalized snapshot but is absent from the readability-extracted live text (either removed from the page or filtered by the extractor; either way, it is not policy content).
- **Formatting only:** Headings rendered differently (`##` markdown in readability vs. plain text in the prior extractor), and link representations differ slightly. No text of the actual guidance changed.

## Policy content sections verified (no change)

1. **Development of Code for Research** — Same guidance on boilerplate, test cases, code documentation, and the warning against sharing Level 2/3 data. Same cross-references to OIT and OVPR resources.
2. **Development of Large Language Models** — Same reference to CCV, Oscar GPUs, Hugging Face, and "The Pile" dataset.
3. **Attribution** — Same instruction to document AI use in Methods/Acknowledgements and link to Brown Library citation guide.
4. **Glossary of Generative AI Terms** — Same entries, definitions, and citations (unchanged).

## Links verified

- OVPR IP guidance URL still resolves.
- OIT data risk classifications page still referenced with the same link.
- CCV Oscar GPU resource still referenced.
- Brown Library AI citation guide URL still resolves.

## Conclusion

No artifact bundle needed. Source is healthy, live, and unchanged. The maintenance signal reflects only metadata/chrome/noise.

**Action taken:** Note written only. No staging artifact directory created. No `pnpm validate` needed.
