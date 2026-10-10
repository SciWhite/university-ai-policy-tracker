# QS 2026 — MIT 独立证据审计

审计日期：2026-10-10（America/Toronto）。本报告只读，不修改数据库、GitHub 或生产网站。

## 1. 审计概览

QS 2026 第 1 名：Massachusetts Institute of Technology (MIT)，美国。队列按公开覆盖接口 data.rows 的原始顺序读取；下一所为 QS 第 2 名 Imperial College London，slug=imperial-college-london。

- [大学页面](https://eduaipolicy.org/universities/massachusetts-institute-of-technology)
- [完整大学 JSON](https://eduaipolicy.org/api/public/v1/universities/massachusetts-institute-of-technology.json)
- [学生快照 JSON](https://eduaipolicy.org/api/public/v1/policy-snapshots/universities/massachusetts-institute-of-technology.json)
- [QS 队列](https://eduaipolicy.org/api/public/v1/coverage/qs-2026.json)

公开 releaseId 为 public-release-20260924-002，MCP releasePublishedAt=2026-09-24T23:31:02.306Z。大学 JSON generatedAt=2026-10-07T23:46:51.816Z，不是政策生效日期，也不是全部主张新核查日期。大学 lastCheckedAt/lastChangedAt=2026-07-18T21:27:39.689Z；8 条非工具主张核查日期为 2026-05-06，13 条工具主张为 2026-07-15。record confidence=0.98、全部 claims agent_reviewed，单条 confidence=0.93–0.98；这些数字不能作为准确率。

完整范围：21 个唯一 Claim ID、22 个 evidence，MCP 分批 10+10+1 取回，与 JSON 的 claimText、claimValue、claimType、reviewState、confidence、evidence 一致。MCP 首次返回 15 条及 remainingClaimIds，已全部补取。浏览器展开全部分组后，21 条标题与完整 JSON 一致。claims 类型：13 ai_tool_treatment、1 academic_integrity、1 procurement、6 other；没有 privacy/research/source_status 类型的单独条目，不代表相关主题不存在。

当前政策语义初核：VERIFIED 13；OVERSTATED 0；UNDERSTATED 2；STALE 6；CONTRADICTED 0；BROKEN_SOURCE 0；UNVERIFIED 0。以上 0 个 UNVERIFIED 仅表示每条当前主张已做状态初判，不表示其历史逐字引文已验证。历史证据逐字性仍有 14 条待核验，故学校总状态为 PARTIAL。

现有记录问题按根因去重：P0 1 组、P1 6 组、P2 4 组，共 11 组。F07 是明确待调查的疑点，未计为已确认伪造。新增政策缺口在第 4 节单列，不重复计入主张状态。

## 2. 逐条审核表

VERIFIED 只确认列出的当前政策事实，并不授予课程许可，也不为历史引文真实性背书。STALE 包括旧版本具体表述失去当前来源绑定；不能读成 MIT 已取消相应行为义务。

| Claim ID | 内容简述 | 审核状态 | 官方证据位置 | 问题说明 |
|---|---|---|---|---|
| clm-massachusetts-institute-of-technology-high-risk-prohibition | 高风险数据禁令与公共工具限制 | UNDERSTATED | [Determine the Risk Level of Your Data Before Using AI Tools，风险矩阵](https://ist.mit.edu/ai-guidance) | 把公共工具处理 Medium Risk 数据的 Not allowed 弱化成不推荐，P0/F01。 |
| clm-massachusetts-institute-of-technology-compliance | 法律及校内政策合规 | STALE | [Compliance with Federal and State Laws and Orders](https://ist.mit.edu/ai-guidance) | MIT 页面仍引用已撤销 EO 14110；校方原文也可能过时，F05。 |
| cl-massachusetts-institute-of-technology-adobe-firefly-1 | Adobe Firefly | VERIFIED | [IS&T 工具表，Adobe Firefly 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-aws-bedrock-2 | AWS Bedrock | VERIFIED | [IS&T 工具表，AWS Bedrock 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-aws-sagemaker-3 | AWS Sagemaker | VERIFIED | [IS&T 工具表，AWS Sagemaker 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-azure-openai-4 | Azure OpenAI | VERIFIED | [IS&T 工具表，Azure OpenAI 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-chatgpt-5 | Open AI ChatGPT | STALE | [IS&T 工具表，Open AI ChatGPT 行](https://ist.mit.edu/ai-tools) | claimValue 获取方式及保留证据的 faculty-only 范围已过时，见 F03。 |
| cl-massachusetts-institute-of-technology-gemini-6 | Google Gemini | VERIFIED | [IS&T 工具表，Google Gemini 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-google-vertex-ai-7 | Google Vertex | VERIFIED | [IS&T 工具表，Google Vertex 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-microsoft-copilot-8 | Microsoft Copilot | VERIFIED | [IS&T 工具表，Microsoft Copilot 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-microsoft-copilot-for-m365-9 | Microsoft Copilot for M365 | VERIFIED | [IS&T 工具表，Microsoft Copilot for M365 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-notebooklm-10 | Google NotebookLM | VERIFIED | [IS&T 工具表，Google NotebookLM 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-salesforce-einstein-11 | Salesforce Einstein | VERIFIED | [IS&T 工具表，Salesforce Einstein 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-self-deploy-12 | Parley | VERIFIED | [IS&T 工具表，Parley 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| cl-massachusetts-institute-of-technology-zoom-ai-companion-13 | Zoom AI Companion | VERIFIED | [IS&T 工具表，Zoom AI Companion 行](https://ist.mit.edu/ai-tools) | 当前官方页面支持此项事实；工具可访问不代表作业许可。历史引文真实性另见 F07。 |
| clm-massachusetts-institute-of-technology-disclosure | 学术与研究披露 | STALE | [当前全文与对应旧章节核对](https://ist.mit.edu/ai-guidance) | 当前引用页面不再保留该具体章节；不能推断规则已废除，F02/F06。 |
| clm-massachusetts-institute-of-technology-ai-procurement-review | 新工具采购咨询 | UNDERSTATED | [Generative AI Tools Licensed by MIT，末段](https://ist.mit.edu/ai-guidance) | 当前采购新工具必须走 VPF 流程，数据库仍只有推荐咨询，P1/F04。 |
| clm-massachusetts-institute-of-technology-accuracy-responsibility | 发布内容准确性责任 | STALE | [当前全文与对应旧章节核对](https://ist.mit.edu/ai-guidance) | 当前引用页面不再保留该具体章节；不能推断规则已废除，F02/F06。 |
| clm-massachusetts-institute-of-technology-approved-tools-list | 校内批准工具及风险限制 | VERIFIED | [IS&T 工具表前言与风险条件](https://ist.mit.edu/ai-tools) | 当前前言支持名单、未列工具事前评估及高风险限制；保留的列表引文有改写/截断疑点，F07。 |
| clm-massachusetts-institute-of-technology-risk-assessment-uses | 招聘、评分等用途事前咨询 | STALE | [当前全文与对应旧章节核对](https://ist.mit.edu/ai-guidance) | 当前引用页面不再保留该具体章节；不能推断规则已废除，F02/F06。 |
| clm-massachusetts-institute-of-technology-existing-tool-review | DLCI 已用工具审查 | STALE | [当前全文与对应旧章节核对](https://ist.mit.edu/ai-guidance) | 当前引用页面不再保留该具体章节；不能推断规则已废除，F02/F06。 |

## 3. 重要问题详细分析

下面数据库英文来自被审计的公开主张，不是我新编的大学原文。官方原文仅短引；其余中文为审计解释。建议英文是修改草稿，未经发布。

### P0 / F01 — 公共工具的中风险数据禁令被弱化

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-high-risk-prohibition`

  > No generative AI tools, including those licensed by IS&T, are approved for use with High Risk MIT information. Additionally, MIT does not recommend using publicly available GenAI tools not subject to an Institute licensing agreement for MIT research and educational activities, even with Low Risk or Medium Risk information.

官方证据及位置：IS&T ai-guidance：Determine the Risk Level of Your Data Before Using AI Tools，Medium Risk Data × Publicly Available GenAI Tool 单元格。

比较结果：当前矩阵对该组合写 Not allowed；旧主张把 Low Risk 与 Medium Risk 一起归入不推荐。高风险禁令本身仍受支持。

原因：旧复合主张未按当前风险矩阵拆分规范强度。

建议英文：

> Public GenAI tools must not receive Medium Risk MIT data. High Risk MIT data must not be entered into any GenAI tool.

建议修复字段：更新 claimText；claimType 建议 privacy；重取 evidence、sourceSnapshotHash、snippetLocation 与 lastCheckedAt；同步 privacy_data 快照。低风险建议应另保留其较弱规范强度。

来源：[https://ist.mit.edu/ai-guidance](https://ist.mit.edu/ai-guidance)

### P1 / F02 — 披露建议被快照提升为普遍强制义务，且来源已改版

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-disclosure`

  > MIT advises community members to disclose the use of generative AI tools for all academic, educational, and research-related uses, and not to publish research results relying on AI-generated content without disclosing the nature of such use.

官方证据及位置：数据库保留的 Be transparent about your use of AI tools 段；当前 IS&T 全文；student snapshot dimensions.disclosure 与 dimensions.research_publication；MIT Libraries When to cite or acknowledge / Important!。

比较结果：保留证据的一般学术披露用 should，claimText 用 advises，但 snapshot 的一般 disclosure.status 为 required。当前 IS&T 已无该具体段落。Libraries 仍提供引用与核实指导，因此不能据段落消失认定披露已取消。

原因：建议与出版限制被合为同一 Required 标签；旧证据没有被当前版本重新绑定。

建议英文：

> MIT Libraries provides AI citation guidance; follow the applicable class and publication rules.

建议修复字段：保留历史 claim 与证据；当前条目标记 needs_review，重新绑定 Libraries 等适用来源；将一般指导与具体出版/论文要求拆开。不能在无新证据时直接恢复 required。更新 summary、actions、basis、basisFingerprint。

来源：[https://libguides.mit.edu/cite-AI-tools](https://libguides.mit.edu/cite-AI-tools)

### P1 / F03 — ChatGPT 资格和获取方式已变化

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `cl-massachusetts-institute-of-technology-chatgpt-5`

  > Open AI ChatGPT is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

官方证据及位置：IS&T ai-tools：Open AI ChatGPT 行，Available to / How to obtain；页脚 Page updated 9/29/2026。

比较结果：当前行列出 faculty、staff、students；获取方式包括 Parley 或 MIT 邮箱登录。数据库保留证据写 only faculty，claimValue.howToObtain 仅指教师联系 IS&T。

原因：2026-07-15 的工具记录未跟随新版本刷新。

建议英文：

> MIT lists ChatGPT access for faculty, staff, and students via Parley or MIT-email sign-in; assessment permission is separate.

建议修复字段：更新 claimText、claimValue.howToObtain、description、受众信息、evidence 与核查时间；不要把整个 availability 的含义扩写成课程许可。

来源：[https://ist.mit.edu/ai-tools](https://ist.mit.edu/ai-tools)

### P1 / F04 — 新工具采购要求仍被写成建议

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-ai-procurement-review`

  > IS&T recommends that MIT community members consult with IS&T before purchasing or using generative AI tools, and recommends using tools already licensed by IS&T for the MIT community.

官方证据及位置：IS&T ai-guidance：Generative AI Tools Licensed by MIT 最后一段；ai-tools 前言中未列工具的 assessment 路径。

比较结果：当前新工具采购必须通过 VPF；未列工具的使用或采购还需联系 ai-guidance 请求评估。旧主张只有 recommends。

原因：旧咨询建议没有更新为当前采购流程要求。

建议英文：

> Purchasing new GenAI tools requires MIT's VPF procurement process.

建议修复字段：更新 claimText、procurement 证据及时间；与 approved-tools-list 的未列工具评估条件交叉引用，避免重复。

来源：[https://ist.mit.edu/ai-guidance](https://ist.mit.edu/ai-guidance)

### P1 / F05 — 合规记录继续引用已撤销的行政命令

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-compliance`

  > Use of generative AI tools at MIT must comply with all applicable federal and state laws and orders (including FERPA, HIPAA, Massachusetts Data Protection Standards, export control laws, and the Executive Order on Safe, Secure, and Trustworthy Development and Use of AI), Institute policies (including 10.1 Academic and Research Misconduct, 11.0 Privacy and Disclosure of Personal Information, and 13.0 Information Policies), Information Protection guidelines, and the Institute's Written Information Security Program (WISP), plus any additional policies established by the user's department, lab, center, or institute (DLCI).

官方证据及位置：MIT 当前 Compliance with Federal and State Laws and Orders；White House 2025-01-23 命令 §5(a)。

比较结果：MIT 现页仍列 EO 14110。White House §5(a) 明确把该命令称为 revoked。基本合规义务仍成立；此处是过时法律引用，不能仅因校方页面仍保留而当成现行命令。

原因：来源忠实度验证没有另外检查引用法规的时间有效性。

建议英文：

> GenAI use must comply with applicable law and current MIT, information-protection, WISP, and DLCI policies.

建议修复字段：更新 claimText 的法规举例；保留原始校方引文，添加过时引用说明及政府来源；更新证据位置（旧位置已经变化），reviewState=needs_review 后复核。

来源：[https://ist.mit.edu/ai-guidance](https://ist.mit.edu/ai-guidance)

### P1 / F06 — 三条具体旧要求缺少当前来源绑定

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-accuracy-responsibility`

  > MIT holds users responsible for the accuracy of any information they publish, including AI-generated content. Users must be aware that AI-generated information may be inaccurate, incomplete, misleading, biased, fabricated, or contain third-party intellectual property.

- `clm-massachusetts-institute-of-technology-risk-assessment-uses`

  > MIT prohibits the use of generative AI for purposes that may require in-depth risk assessments without prior consultation with ai-guidance@mit.edu. Such purposes include recruitment and hiring of employees, evaluating student academic performance, making investment decisions, and complaint and dispute resolution.

- `clm-massachusetts-institute-of-technology-existing-tool-review`

  > MIT departments, labs, centers, and institutes (DLCIs) already using a generative AI tool or service must ensure that the tool complies with all Institute policies and Information Protection guidelines, and must contact ai-guidance@mit.edu for consultation or assessment if needed.

官方证据及位置：完整阅读 6/23/2026 标注的 IS&T 当前页后，与旧 Ensure accuracy / Consult with IS&T 章节逐项比较。

比较结果：当前页面已不包含这三段具体表述。Libraries 和 2026 委员会报告另有准确性指导，但范围与规范强度需要重写；没有取得同等范围的当前招聘、投资、投诉处理事前咨询条款，也未确认其取消。

原因：旧版本具体规则被继续作为现行大学要求输出。

建议英文：

> Historical IS&T guidance; current applicability of this specific provision has not been confirmed.

建议修复字段：逐条改为历史说明并退出当前行动建议；保留各自旧 hash。accuracy 可另用 Libraries 当前指导重写；risk-assessment 与 existing-tool-review 不应在未取得等价来源时生成新的禁止/义务。建议准确性类型 research/academic_integrity，风险审查类型 security_review。

来源：[https://ist.mit.edu/ai-guidance](https://ist.mit.edu/ai-guidance)

### P1 / F07 — 14 条记录的历史引文逐字性尚未完成验证（疑点）

**性质：需要进一步调查，未证实历史引文伪造。**

完整 Claim ID 与数据库当前英文：

- `cl-massachusetts-institute-of-technology-adobe-firefly-1`

  > Adobe Firefly is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-aws-bedrock-2`

  > AWS Bedrock is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-aws-sagemaker-3`

  > AWS Sagemaker is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-azure-openai-4`

  > Azure OpenAI is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-chatgpt-5`

  > Open AI ChatGPT is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-gemini-6`

  > Google Gemini is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-google-vertex-ai-7`

  > Google Vertex is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-microsoft-copilot-8`

  > Microsoft Copilot is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-microsoft-copilot-for-m365-9`

  > Microsoft Copilot for M365 is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-notebooklm-10`

  > Google NotebookLM is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-salesforce-einstein-11`

  > Salesforce Einstein is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-self-deploy-12`

  > Parley is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: self hosted system.

- `cl-massachusetts-institute-of-technology-zoom-ai-companion-13`

  > Zoom AI Companion is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `clm-massachusetts-institute-of-technology-approved-tools-list`

  > MIT maintains a list of approved generative AI tools licensed by IS&T for use by the MIT community. Only these tools are approved for use with low- and medium-risk information, and any tool not on the list requires contacting ai-guidance@mit.edu for assessment before use or purchase. No generative AI tools are approved for use with High Risk MIT information.

官方证据及位置：13 条工具 evidenceSnippet / evidenceSnippetDisplay；evd-massachusetts-institute-of-technology-10 的列表式 evidenceSnippet。

比较结果：多条片段把前言、独立 availability 句与表格行拼接；部分描述被缩写，approved-tools-list 使用改写列表并以省略号截断。当前官方正文不能完整逐字匹配这些字符串。但公开 API/MCP 未返回对应历史完整快照字节，不能据此宣称已证实伪造历史引文。

原因：可能把规范化表格展示或摘要当作原始引文；也可能涉及历史版本差异，仍需原始字节裁决。

建议英文：

> Normalized tool-table summary; not a verbatim quotation.

建议修复字段：这句仅可用作展示标签；evidenceSnippet 必须换成可核验的原文，展示拼接放 evidenceSnippetDisplay 并标明处理方式；重取 row locator。保留历史 hash 不覆盖；取得 977be4c0… 与 3a95a461… 对应原始快照后逐条核验。

来源：[https://ist.mit.edu/ai-tools](https://ist.mit.edu/ai-tools)

### P2 / F08 — 数据契约合法，但结构化分类与受众信息不足

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-high-risk-prohibition`

  > No generative AI tools, including those licensed by IS&T, are approved for use with High Risk MIT information. Additionally, MIT does not recommend using publicly available GenAI tools not subject to an Institute licensing agreement for MIT research and educational activities, even with Low Risk or Medium Risk information.

- `clm-massachusetts-institute-of-technology-compliance`

  > Use of generative AI tools at MIT must comply with all applicable federal and state laws and orders (including FERPA, HIPAA, Massachusetts Data Protection Standards, export control laws, and the Executive Order on Safe, Secure, and Trustworthy Development and Use of AI), Institute policies (including 10.1 Academic and Research Misconduct, 11.0 Privacy and Disclosure of Personal Information, and 13.0 Information Policies), Information Protection guidelines, and the Institute's Written Information Security Program (WISP), plus any additional policies established by the user's department, lab, center, or institute (DLCI).

- `clm-massachusetts-institute-of-technology-accuracy-responsibility`

  > MIT holds users responsible for the accuracy of any information they publish, including AI-generated content. Users must be aware that AI-generated information may be inaccurate, incomplete, misleading, biased, fabricated, or contain third-party intellectual property.

- `clm-massachusetts-institute-of-technology-approved-tools-list`

  > MIT maintains a list of approved generative AI tools licensed by IS&T for use by the MIT community. Only these tools are approved for use with low- and medium-risk information, and any tool not on the list requires contacting ai-guidance@mit.edu for assessment before use or purchase. No generative AI tools are approved for use with High Risk MIT information.

- `clm-massachusetts-institute-of-technology-risk-assessment-uses`

  > MIT prohibits the use of generative AI for purposes that may require in-depth risk assessments without prior consultation with ai-guidance@mit.edu. Such purposes include recruitment and hiring of employees, evaluating student academic performance, making investment decisions, and complaint and dispute resolution.

- `clm-massachusetts-institute-of-technology-existing-tool-review`

  > MIT departments, labs, centers, and institutes (DLCIs) already using a generative AI tool or service must ensure that the tool complies with all Institute policies and Information Protection guidelines, and must contact ai-guidance@mit.edu for consultation or assessment if needed.

- `cl-massachusetts-institute-of-technology-adobe-firefly-1`

  > Adobe Firefly is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-aws-bedrock-2`

  > AWS Bedrock is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-aws-sagemaker-3`

  > AWS Sagemaker is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-azure-openai-4`

  > Azure OpenAI is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-chatgpt-5`

  > Open AI ChatGPT is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-gemini-6`

  > Google Gemini is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-google-vertex-ai-7`

  > Google Vertex is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-microsoft-copilot-8`

  > Microsoft Copilot is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-microsoft-copilot-for-m365-9`

  > Microsoft Copilot for M365 is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-notebooklm-10`

  > Google NotebookLM is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-salesforce-einstein-11`

  > Salesforce Einstein is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: conditionally allowed. Derived endorsement type: institutionally licensed or procured.

- `cl-massachusetts-institute-of-technology-self-deploy-12`

  > Parley is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: self hosted system.

- `cl-massachusetts-institute-of-technology-zoom-ai-companion-13`

  > Zoom AI Companion is listed for Massachusetts Institute of Technology (MIT) in an official university AI tools source. Derived availability: allowed. Derived endorsement type: institutionally licensed or procured.

官方证据及位置：公开 JSON claimType/claimValue；本地 packages/shared/src/claims.ts 与 tools.ts 的声明。

比较结果：6 条主张使用合法的 other。13 个 claimValue 都是可解析的 JSON 字符串，但没有显式 availableTo。官方工具行的受众条件保存在 evidence 中；这不是已证实学生被授予教师工具许可，也不是 schema 解析错误。

原因：合法的宽泛分类降低了主题检索与结构化条件表达的质量。

建议英文：

> Institutional tool access; consult the cited eligibility and data conditions.

建议修复字段：按语义调整 privacy/security_review/research 等类型；为工具结构化保留 availableTo、账户与数据限制，并确认下游真正读取这些字段。不要为提高覆盖率制造重复条目。

来源：[https://eduaipolicy.org/api/public/v1/universities/massachusetts-institute-of-technology.json](https://eduaipolicy.org/api/public/v1/universities/massachusetts-institute-of-technology.json)

### P2 / F09 — TLL 旧官方 URL 返回 404

**性质：已确认的记录或版本问题。**

Claim ID：不适用，这是公开来源或网页补充层的问题，未捏造主张 ID。

官方证据及位置：officialSources sc-massachusetts-institute-of-technology-2；直接 HTTP GET；从 TLL 首页导航取得的新链接。

比较结果：旧 /course-design/gen-ai-your-course/ 返回 404；新 /course-design/ai-in-teaching-learning/gen-ai-your-course/ 返回 200。21 条主张均没有绑定该失效 URL，因此主张状态中 BROKEN_SOURCE 为 0，来源记录中有 1 个确认失效链接。

原因：站点路径迁移后 tracker 未更新来源导航。

建议英文：

> Generative AI & Your Course — current TLL location.

建议修复字段：新增当前来源 attribution 并链接旧历史记录；不要把历史 sourceUrl/finalUrl/hash 无声改成新快照。5 个 source attributions 对应 4 个不同 URL：ai-tools 的两个历史版本不是应直接删掉的重复来源。

来源：[https://tll.mit.edu/teaching-resources/course-design/ai-in-teaching-learning/gen-ai-your-course/](https://tll.mit.edu/teaching-resources/course-design/ai-in-teaching-learning/gen-ai-your-course/)

### P2 / F10 — 学生快照审核状态互相矛盾

**性质：已确认的记录或版本问题。**

完整 Claim ID 与数据库当前英文：

- `clm-massachusetts-institute-of-technology-approved-tools-list`

  > MIT maintains a list of approved generative AI tools licensed by IS&T for use by the MIT community. Only these tools are approved for use with low- and medium-risk information, and any tool not on the list requires contacting ai-guidance@mit.edu for assessment before use or purchase. No generative AI tools are approved for use with High Risk MIT information.

- `clm-massachusetts-institute-of-technology-disclosure`

  > MIT advises community members to disclose the use of generative AI tools for all academic, educational, and research-related uses, and not to publish research results relying on AI-generated content without disclosing the nature of such use.

- `clm-massachusetts-institute-of-technology-high-risk-prohibition`

  > No generative AI tools, including those licensed by IS&T, are approved for use with High Risk MIT information. Additionally, MIT does not recommend using publicly available GenAI tools not subject to an Institute licensing agreement for MIT research and educational activities, even with Low Risk or Medium Risk information.

官方证据及位置：snapshot overallStatus=strong、review.reviewState=dual_agent_reviewed；顶层与 data.limitations 声称 machine-candidate、overallStatus remains needs_review。

比较结果：同一已发布 JSON 同时表示复核通过与仍待复核；MCP 输出通过复核说明。

原因：状态更新没有同步 limitations。

建议英文：

> This reviewed summary reflects its cited snapshot and requires revalidation after substantive source changes.

建议修复字段：同步 limitations、overallStatus、reviewState 与 MCP 通知；修复证据后重新生成 basisFingerprint，不应仅修改文字标签。

来源：[https://eduaipolicy.org/api/public/v1/policy-snapshots/universities/massachusetts-institute-of-technology.json](https://eduaipolicy.org/api/public/v1/policy-snapshots/universities/massachusetts-institute-of-technology.json)

### P2 / F11 — 网页存在公开 JSON 主张集合之外的纪律补充

**性质：已确认的记录或版本问题。**

Claim ID：不适用，这是公开来源或网页补充层的问题，未捏造主张 ID。

官方证据及位置：网页 enforcement-fact-mit-fact-01/02/05/07/11；公开大学 JSON claims；网站 quick-guide 与 snapshot-coursework/exams。

比较结果：21 条网页主张标题与 JSON、MCP 一致，但 5 个纪律补充不在其 claims 中，hero 也有课程规则解释。网页已明确补充为一般纪律框架、当前适用性未独立确认，没有把一般处分写成 AI 必罚。停学旧引文与当前 §XI.D 的措辞、例外已有变化，主体摘要仍基本成立。

原因：不同公开内容管道没有一个完整可枚举集合。

建议英文：

> Supplementary general disciplinary evidence; not an AI-specific sanction rule.

建议修复字段：提供独立补充公开 JSON 或在主 JSON 中添加 supplement URL/version；保留主 Claim ID 集合独立性，刷新 mit-fact-07 证据并写明当前返校许可不保证回原系/项目/实验室。

来源：[https://eduaipolicy.org/universities/massachusetts-institute-of-technology](https://eduaipolicy.org/universities/massachusetts-institute-of-technology)

F01 当前原文短引：风险矩阵单元格为 “Not allowed”。F04 原文短引：“you must go through the VPF procurement process”。其余旧章节须通过下载的当前全文检查，不能把字符串匹配当成语义通过。

F05 政府核实：[White House 2025-01-23 命令](https://www.whitehouse.gov/presidential-actions/2025/01/removing-barriers-to-american-leadership-in-artificial-intelligence/)，§5(a) 将 EO 14110 明确称为 revoked。

### 其他质量检查与保留限制

- 未发现两个不同官方 URL 异常共享同一 snapshotHash。ai-tools 的 2026-05-06 与 2026-07-15 记录有不同 hash，不能自动合并成一份快照。
- 21 条没有重复 ID；14 个历史引文待核验不影响 ID 范围已完整枚举。部分低风险/高风险事实在不同主张中重叠，宜交叉引用，而不是盲目删除。
- claimValue 为字符串是当前契约允许的形态；13 个字符串均能解析。reviewState、claimType、64 位 hash 格式、evidence 与 attribution 的 hash 绑定没有发现基本格式错误。sourceType 在 source attribution 与 evidence attribution 上有 official_guidance/official_policy_page 差异，应统一来源角色，但不能凭标签把 guidance 升格为正式规则。
- 公开 JSON 的 generatedAt、大学 lastCheckedAt、单条 lastCheckedAt、来源 retrievedAt 与当前官网 Page updated 必须分别显示。July 18 的记录时间不表示五月每条规则都在七月重查。
- 8 条非工具主张的主要历史 IS&T hash：9f5d98b57ae0a98780b717171db014845705949710b3e8247db979042e50878d；五月工具页 hash：3a95a461a608ebd8222ef258a338f4f76dda14250d21168165e89167d83d419b；13 条七月工具证据 hash：977be4c05ca6944c0331b18f1514351a1e58d37b5049b277f290ab04ae5885e7。未取得这些历史完整快照字节，无法独立重算其 SHA-256。
- 学生快照 basisFingerprint：81ca9d510fdfbf56c28c4db4c4ade057c3ddd263775b983b9b92f2edf0f9c919。它只证明所标识的旧依据集合，不证明官网当前语义仍成立。
- 当前 MIT IS&T 指南页脚为 6/23/2026，工具页为 9/29/2026；这些是网页更新时间标签，未当作政策生效日期。

### 网页额外纪律补充核查

| 补充 ID（不是主 Claim ID） | 当前核查 | 官方位置 |
|---|---|---|
| mit-fact-05 | 未完成处分可能产生进一步措施，主要表述 VERIFIED；may 保留 | [COD §XI 首段](https://cod.mit.edu/rules/section11/) |
| mit-fact-07 | 停学、记录及申请返校主要表述 VERIFIED；旧引文 STALE，需要刷新措辞和例外 | [COD §XI.D](https://cod.mit.edu/rules/section11/) |
| mit-fact-01 | 指定严重决定才有普通上诉，5 business days 从收到决定信起算，VERIFIED | [COD §XII 前言](https://cod.mit.edu/rules/section12/) |
| mit-fact-02 | 四项普通上诉理由及特别程序限定，VERIFIED | [COD §XII.A–H](https://cod.mit.edu/rules/section12/) |
| mit-fact-11 | personal support 为 encouraged，VERIFIED | [COD Resources / Personal Support](https://cod.mit.edu/resources/) |

未发现这五项被页面明确说成 AI 专属必罚。这里不主张已完整审计 MIT 全部纪律规则，也未断言所有学生均有同一种上诉权。

## 4. 遗漏的政策：建议新增草稿

以下是对 MIT 的独立联网搜索结果，不是现有 21 条 Claim ID。建议 ID 仅用于开发提案。

### proposed-mit-course-ai-policy-framework

建议分类：teaching。适用对象：学生与任课教师；课程适用。

英文草稿：

> MIT's Fall 2026 guidance states that there are no Institute-wide requirements for setting classroom AI-use policies; instructors are encouraged to publish clear course policies.

官方依据：[来源](https://facultygovernance.mit.edu/communications-chair)；Generative AI Use Policies，第 1–3 段。不能把四种示范选项当作全校已采用规则。

### proposed-mit-ai-detector-evidence

建议分类：academic_integrity。适用对象：COD 的 AI 学术诚信证据判断。

英文草稿：

> MIT's August 2026 committee report states that COD does not consider AI-detector output alone sufficient.

官方依据：[来源](https://sites.mit.edu/ai-use/ai-committee-final-report-aug-13/)；§3.1.9，PDF 实际第 19 页、印刷第 17 页；已渲染并检查。短引：the COD itself does not consider AI detector output alone sufficient（13 词）。这是委员会对 COD 现况的记载；未独立取得 COD 单列 AI 证据规则，因此来源角色应写清。

### proposed-mit-tll-detectors

建议分类：teaching。适用对象：TLL 给教师的教学建议。

英文草稿：

> MIT TLL strongly recommends against AI-detection tools.

官方依据：[来源](https://tll.mit.edu/teaching-resources/course-design/ai-in-teaching-learning/gen-ai-your-course/)；Define Acceptable Use / AI-detection resources 之后的 TLL 建议段。strongly recommends 不能改为全校禁止。

### proposed-mit-thesis-ai-acknowledgment

建议分类：research。适用对象：学位论文作者、导师与研究者。

英文草稿：

> MIT's August 2026 committee report recommends thesis AI-use statements and excluding AI from co-authorship.

官方依据：[来源](https://sites.mit.edu/ai-use/ai-committee-final-report-aug-13/)；§3.2.6，PDF 实际第 24 页、印刷第 22 页。报告用 should，是建议；应继续寻找正式学位论文实施规则，不能标成已生效全校 must。

### proposed-mit-human-subject-ai-consent

建议分类：research / privacy。适用对象：需 COUHES 审查的 AI 人体研究；不是所有课程作业。

英文草稿：

> For AI human-subjects research, COUHES guidance requires appropriate consent transparency and available Data Cards; Model Cards are recommended for model development.

官方依据：[来源](https://couhes.mit.edu/researchers/guidelines/artificial-intelligence-ai-research)；When appropriate… application involving AI 后的 Data Card、Model Card、Consent 条目。保留 must/should 与 when available 条件。

### proposed-mit-cod-accessibility

建议分类：academic_integrity。适用对象：参与 COD 程序、需要残障便利的学生。

英文草稿：

> MIT COD directs students needing disability accommodations in its process to Disability and Access Services.

官方依据：[来源](https://cod.mit.edu/resources/)；Student Disability and Access Services。与普通 Personal Support 分开，不承诺个案一定获得某一种调整。

### proposed-mit-return-after-suspension

建议分类：academic_integrity。适用对象：停学后获准返校的学生，含研究生。

英文草稿：

> Permission to return after suspension does not guarantee return to the same MIT department, program, lab, or position.

官方依据：[来源](https://cod.mit.edu/rules/section11/)；§XI.D，申请返校段之后。可新增补充或扩充 mit-fact-07；不是 AI 专属处分。

另外建议扩充 F01：高风险信息若已经输入 GenAI，应立即联系 security@mit.edu；合并到数据安全条目，不另制造重复高风险禁令。TLO 当前指南对 in-process invention disclosures 同时出现高风险禁用与事前 approval 两种表述，存在须询证的条件关系；本次没有将其写成足以覆盖高风险禁令的许可。

## 5. 开发修复清单（不执行）

1. 优先更新 F01 的中风险公共工具限制与 privacy_data 学生快照。
2. 修复 disclosure/general guidance 与 required 标签之间的强度问题；不要无依据删除具体课程或出版要求。
3. 更新 ChatGPT claimValue 与资格来源；刷新采购要求及过时法规举例。
4. 对 accuracy-responsibility、risk-assessment-uses、existing-tool-review 保留历史版本并移出当前行动性结论，直到取得当前同范围证据。
5. 取得 14 条待核验历史证据所绑定的完整快照，逐字复核；将摘要/表格拼接与原始 quotation 分开。
6. 更新 TLL 导航地址，保留历史来源与历史 hash；修复 snapshot 状态文案冲突。
7. 为公开网页的纪律补充提供可枚举接口与版本；刷新 mit-fact-07，保留一般纪律框架范围。
8. 对第 4 节七项草稿做语义复核后再决定新增；高风险事后报告合并，避免重复。
9. 所有改动须更新真实核查时间和新快照绑定，不可只提高 confidence、复用旧 hash 或改变 generatedAt。

## 6. 结论、限制与进度

MIT 当前工具名单与高风险禁令的核心事实有官网依据，但记录不能作为完整、现行的学生许可清单。最高风险是中风险隐私限制被弱化；重要问题还包括披露规范强度、ChatGPT 的旧资格条件、采购义务与原文逐字性的可追溯性。

当前 21 条均已独立联网做语义与版本初核；13 条 VERIFIED 不等于 13/21 准确率。由于历史逐字引文与 hash 绑定缺乏可取得的原始字节，本次严格记录为 PARTIAL，不推进正常队列。未核查下一所学校，没有任何在线写入、推送、部署或自动化。

### 剩余审核项

剩余阶段不是新学校，也不是尚未枚举的主张，而是以下 14 条的历史原始证据逐字核查：

- cl-massachusetts-institute-of-technology-adobe-firefly-1
- cl-massachusetts-institute-of-technology-aws-bedrock-2
- cl-massachusetts-institute-of-technology-aws-sagemaker-3
- cl-massachusetts-institute-of-technology-azure-openai-4
- cl-massachusetts-institute-of-technology-chatgpt-5
- cl-massachusetts-institute-of-technology-gemini-6
- cl-massachusetts-institute-of-technology-google-vertex-ai-7
- cl-massachusetts-institute-of-technology-microsoft-copilot-8
- cl-massachusetts-institute-of-technology-microsoft-copilot-for-m365-9
- cl-massachusetts-institute-of-technology-notebooklm-10
- cl-massachusetts-institute-of-technology-salesforce-einstein-11
- cl-massachusetts-institute-of-technology-self-deploy-12
- cl-massachusetts-institute-of-technology-zoom-ai-companion-13
- clm-massachusetts-institute-of-technology-approved-tools-list

此外，risk-assessment-uses / existing-tool-review 的当前同范围规则是否另有正式出处，保留为未确认的适用性问题；现有 STALE 判断仅指旧引用已失去当前版本支持，不宣称大学取消规则。


## 附录：公开来源版本与 hashes

| 来源记录 ID | URL | retrievedAt | snapshotHash |
|---|---|---|---|
| sc-massachusetts-institute-of-technology-2 | https://tll.mit.edu/teaching-resources/course-design/gen-ai-your-course/ | 2026-05-06T00:57:38.672Z | 378745e0058115791f20f99fdb201f02717080dc504e1941757e1913518882f9 |
| sc-massachusetts-institute-of-technology-4 | https://ist.mit.edu/ai-tools | 2026-05-06T00:57:37.464Z | 3a95a461a608ebd8222ef258a338f4f76dda14250d21168165e89167d83d419b |
| sc-massachusetts-institute-of-technology-698369ffabb1 | https://ist.mit.edu/ai-tools | 2026-07-15T17:32:43.896Z | 977be4c05ca6944c0331b18f1514351a1e58d37b5049b277f290ab04ae5885e7 |
| sc-massachusetts-institute-of-technology-1 | https://ist.mit.edu/ai-guidance | 2026-05-06T00:57:37.427Z | 9f5d98b57ae0a98780b717171db014845705949710b3e8247db979042e50878d |
| sc-massachusetts-institute-of-technology-3 | https://tll.mit.edu/rethinking-your-problem-sets-in-the-world-of-generative-ai/ | 2026-05-06T00:57:38.754Z | df6913244fee79c9e77ac1ec014422870a5c7ca34a1d60fa026ef742f4848f02 |

`QS2026_AUDIT_CURSOR: rank=1, slug=massachusetts-institute-of-technology, status=PARTIAL`

下次「继续」或「下一所」：先完成 MIT 余项。队列下一候选：Imperial College London，rank=2，slug=imperial-college-london（尚未开始）。
