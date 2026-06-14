# QS 1-10 AI Tools Crawl Report

Run ID: `uapt-ai-tools-qs-1-10-20260614`

Mode: Firecrawl-first. Search was used for official source discovery; markdown/PDF scraping was used for evidence capture. HTTP/Playwright were not needed for this first pass.

## Sources Used

| QS | University | Source |
| --- | --- | --- |
| 1 | Massachusetts Institute of Technology (MIT) | https://ist.mit.edu/ai-tools |
| 2 | Imperial College London | https://www.imperial.ac.uk/admin-services/ict/training-and-resources/daisy/ |
| 3 | Stanford University | https://uit.stanford.edu/aiplayground |
| 4 | University of Oxford | https://oerc.ox.ac.uk/ai-centre/generative-ai-tools |
| 5 | Harvard University | https://www.huit.harvard.edu/ai/tools |
| 6 | University of Cambridge | https://www.information-compliance.admin.cam.ac.uk/data-protection/guidance/ai-guidance |
| 7 | ETH Zurich | https://ethz.ch/en/the-eth-zurich/education/ai-in-education/tools.html |
| 8 | National University of Singapore (NUS) | https://ctlt.nus.edu.sg/wp-content/uploads/2026/04/Policy-for-Use-of-AI-in-Teaching-and-Learning.pdf |
| 9 | UCL | https://www.ucl.ac.uk/news/2024/mar/more-secure-generative-ai-tool-available-staff-and-students |
| 10 | California Institute of Technology (Caltech) | https://www.imss.caltech.edu/services/ai |

## Data Quality Notes

- Strong named approved/licensed tool pages: MIT, Oxford, Harvard, Cambridge, ETH, UCL, Caltech.
- Strong institutional platform pages: Imperial dAIsy, Stanford AI Playground, MIT Parley.
- NUS has a public teaching policy and library guide, but Firecrawl did not surface a public NUS-wide named approved-tools list. The NUS record is therefore generic `unspecified_ai_tool`, not ChatGPT/Copilot/Gemini.
- NotebookLM appears repeatedly at MIT/Oxford/Cambridge/ETH/Harvard, but v1 taxonomy lacks a `notebooklm` key. It is preserved in snippets and should be considered for a taxonomy expansion.
- Stanford exposes OpenAI, Google, Anthropic and DeepSeek model families inside AI Playground. The safe v1 conclusion is the platform-level `institutional_ai_service`; named-model records should remain review-gated unless the UI/data model supports model-family evidence.

## Next Actions

1. Convert `tool_records.json` into standard OpenClaw claim/evidence artifacts or extend the public tools builder to read this staging contract.
2. Add `notebooklm`, `azure_openai`, and possibly `codex` to the tool taxonomy before promoting Oxford/Harvard/MIT records fully.
3. Re-run NUS with a targeted authenticated-agnostic official source search for the `see the list here` approved-tools target referenced in the PDF.
