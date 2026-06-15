# QS 11-20 AI Tools Crawl Report

Run ID: `uapt-ai-tools-qs-11-20-20260614`

Mode: Firecrawl-first. Search was used for official source discovery; markdown scraping was used for evidence capture. Official tool tables/directories were split into row-level records where available.

## Sources Used

| Source | URL |
| --- | --- |
| HKUGenAI Tools - Information Technology Services | https://its.hku.hk/services/ai-as-a-service/hku-chatgpt/ |
| Empowering students to thrive in the age of AI | NTU Singapore | https://www.ntu.edu.sg/news/detail/empowering-students-to-thrive-in-the-age-of-ai |
| Approved and Restricted AI Tools | University of Chicago | https://genai.uchicago.edu/generative-ai-tools/approved-and-restricted-ai-tools |
| UChicago Generative AI Tools | University of Chicago | https://genai.uchicago.edu/generative-ai-tools |
| Artificial Intelligence (AI) for Law School: Generative AI Tools | https://lrcguides.stl.pku.edu.cn/c.php?g=967766&p=7035212 |
| Penn Generative AI Tools & Resources | https://isc.upenn.edu/ai/tools/penn-generative-ai-tools-resources |
| Tools & Resources - Cornell AI Innovation Hub | https://innovationhub.ai.cornell.edu/tools-resources/ |
| Tsinghua's student AI growth assistant 'Xiaoda' | https://www.tsinghua.edu.cn/en/info/1418/14423.htm |
| Tsinghua University Library AI Service New Experience | https://lib.tsinghua.edu.cn/en/info/1021/1416.htm |
| Licensed AI Tools | Berkeley AI Hub | https://ai.berkeley.edu/tools-services/licensed-ai-tools |
| GenAI tools - The University of Melbourne | https://www.unimelb.edu.au/ai/home/staff/gen-ai-tools |
| Using AI in university | Current Students - UNSW Sydney | https://www.unsw.edu.au/student/managing-your-studies/academic-skills-support/toolkit/ai |

## Tool Records by University

| QS | University | Records | Raw tools |
| --- | --- | ---: | --- |
| 11 | The University of Hong Kong (HKU) | 3 | HKU ChatGPT Web App; HKU DALL∙E Web App; HKU ITS Developer Portal API |
| 12 | Nanyang Technological University, Singapore (NTU Singapore) | 4 | Gemini Enterprise; Google AI Studio; Vertex AI; NTU AI Learning Assistant (NALA) |
| 13 | University of Chicago | 18 | Adobe Acrobat AI Assistant; Anthropic Claude Commercial Account; Anthropic Claude Enterprise Account; Azure AI; ChatGPT 3.5; ChatGPT 4.0; claude.ai; Claude Code on Amazon Bedrock; Copilot; Gemini through UChicago Google Workspace; Google Workspace Studio; GitHub Copilot Business; Llama 4; NotebookLM through UChicago Google Workspace; Perplexity.ai; PhoenixAI; Vertex AI; Zoom AI Companion |
| 14 | Peking University | 2 | DeepSeek; Kimi Chat |
| 15 | University of Pennsylvania | 8 | Microsoft Copilot Chat (Basic); Microsoft M365 Copilot (Premium); Snowflake Data Analytics Platform & Consulting; Gemini for Google Workspace; Google NotebookLM; Grammarly; ChatGPT Edu; Zoom AI Companion |
| 16 | Cornell University | 6 | Cornell AI Platform; Microsoft Copilot Basic; OpenAI ChatGPT Edu; Claude; Zoom AI Companion; Adobe Firefly |
| 17 | Tsinghua University | 3 | Xiaoda; AI Navigation Assistant; AI Reading Assistant |
| 17 | University of California, Berkeley | 11 | BearGPT; Campus AI Sandbox (Beta); ChatGPT; Google Gemini App; Microsoft Copilot; Google AI Pro; Google NotebookLM and NotebookLM Plus; Zoom AI Companion; Firefly, Adobe Creative Cloud; Copilot for Microsoft 365; DALL-E |
| 19 | The University of Melbourne | 3 | SparkAI; Copilot (Web); Zoom AI Companion |
| 20 | UNSW Sydney | 1 | Microsoft Copilot |

## Data Quality Notes

- Strong official tool tables/directories: UChicago, Penn, UC Berkeley, University of Melbourne, Cornell, HKU.
- School-hosted named services are kept as `self_deploy` with their real `rawToolName`, including HKU ChatGPT Web App, HKU DALL∙E Web App, NALA, Xiaoda, Tsinghua Library assistants, BearGPT, Campus AI Sandbox, Cornell AI Platform, and SparkAI.
- NTU Google AI access is future-dated from August 2026, so the timing is preserved in the access field.
- PKU records are marked `needs_review` because Firecrawl surfaced the official guide and snippet with named tools, but full guide body extraction was incomplete.
- UNSW has official guidance recommending Microsoft Copilot with a UNSW account for data privacy and protection; no public approved-tools table was found in this pass.
- HKU provider/model families nested inside HKUGenAI services, including DeepSeek, Gemini, Qwen, and GLM, were not promoted into separate allowed tool records because the source presents them as models inside HKU-hosted tools.

## Next Actions

1. Re-run PKU with a direct LibGuides scrape or browser fallback to extract the full tool list beyond search snippets.
2. Re-run UNSW IT/service-catalog discovery for any dedicated licensed AI tools page.
3. Add more canonical slugs for high-frequency products if UChicago-style tables keep surfacing non-core tools such as Box AI, Slack AI, Otter.ai, and Adobe Acrobat AI Assistant.
