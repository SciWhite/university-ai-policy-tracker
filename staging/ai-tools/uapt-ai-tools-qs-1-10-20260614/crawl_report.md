# QS 1-10 AI Tools Crawl Report

Run ID: `uapt-ai-tools-qs-1-10-20260614`

Mode: Firecrawl-first. Search was used for official source discovery; markdown/PDF scraping was used for evidence capture. Harvard's HUIT tool page required Firecrawl extraction because normal fetch returned incomplete/blocked content.

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
| 10 | California Institute of Technology (Caltech) | https://www.imss.caltech.edu/services/ai/caltech-ai |

## Data Quality Notes

- Strong named approved/licensed tool pages: MIT, Oxford, Harvard, Cambridge, ETH, UCL, Caltech.
- Strong institutional platform pages: Imperial dAIsy, Stanford AI Playground, MIT Parley.
- NUS has a public teaching policy and library guide, but Firecrawl did not surface a public NUS-wide named approved-tools list. The NUS record is therefore generic `unspecified_ai_tool`, not ChatGPT/Copilot/Gemini.
- MIT's official tools table was expanded row-by-row into 13 concrete records, including Adobe Firefly, AWS Bedrock, AWS SageMaker, Azure OpenAI, Google NotebookLM, Google Vertex, Microsoft Copilot for M365, Salesforce Einstein, and Zoom AI Companion.
- NotebookLM now has a canonical taxonomy key and is split from Gemini when the source explicitly names it.
- Named school-hosted platforms use `self_deploy` when the source presents a concrete platform such as Parley, dAIsy, Stanford AI Playground, or Harvard AI Sandbox.
- Stanford and Imperial mention nested model providers inside their institutional platforms. Those provider/model mentions are not promoted into separate allowed tool records.
- Tool records now carry concise `description`, `howToObtain`, and `costToUser` metadata when the official source exposes those fields or equivalent wording.
- Caltech's official AI tools table was refreshed from the dedicated `caltech-ai` page and expanded to include Anthropic Claude Standard/Premium and Google Gemini Enterprise for Education Pro. Product variants are still collapsed where the v1 canonical slug model would otherwise merge multiple rows for the same vendor tool.
- Harvard Google Gemini Pro and Microsoft Copilot Pro rows are omitted from canonical records because v1 slugs do not yet distinguish paid variants from Basic products without merging availability incorrectly.

## Next Actions

1. Re-run NUS with a targeted authenticated-agnostic official source search for the `see the list here` approved-tools target referenced in the PDF.
2. Add paid-variant slugs only if the UI/data model will preserve separate availability for Basic vs Pro/M365 variants.
3. Backfill QS 11-50 using the same table-first extraction rule.
