# V6 大学页接入规范

更新：2026-10-15。适用：V6 本地适配及已发布数据接入；保留六校历史基准、UCL 和三校试点凭据。页面接入、政策语义审核、学生摘要资格及发布验收分别成立。生产操作另遵循 release-routing-policy.md。

## 先读这一段

新增学校采用 **已审核资料 → 显式字段映射 → 脚本生成本地 view → 共享 V6 组件 → 验收**。不要让 AI 对照 Harvard 截图重新写 JSX/CSS，也不要复制一份学校专用页面。AI 的职责是核对范围、状态、关键例外、翻译和图文对应；脚本负责重复转换、哈希、证据引用及格式检查。

V6 已有发布实现；早期 `policy-v6-local` 是历史开发位置。进入任何线程先核对实际 checkout、代码 SHA、文件、选定内容包和公开版本；本地旧 checkout 可能仍只有文档。不要以目录名判断能力，不重置共享脏工作树或覆盖其他线程文件。公开记录与本地候选不可互换。

这份规范描述现有行为；UCL 试点首次补出了通用的本地资料适配入口。它支持 `uapt-private-repaired-evidence-bundle-v1` 形状的修复包，**尚非任意爬虫 JSON 一键导入器**。不同格式应先做一次格式适配，不能削弱证据与审核门槛。

## 页面固定骨架

| 区域 | 固定行为 | 学校需要提供 |
| --- | --- | --- |
| 身份 Hero | 左侧校徽；正式全名（已核对缩写）作为主标题；城市、国家、检查日期在校名上方；右侧对比/分享；不另加 Reviewed 徽章 | canonical slug、校名、地理字段、真实日期；已验收校徽或建筑图标 |
| 四个快捷问题 | 作业、工具、研究发表、教学；无编号紧凑卡，宽屏一行四项；教学跳转自动展开补充主题 | 来自本校对应主题状态，不额外创造结论 |
| 提交前快速检查 / Do / Don't | 主题后、工具前；四问下保留快捷入口；各最多三项，逐项证据默认显示原引文 | EN/ZH 行动、kind、Claim IDs；每校独立绑定，缺证据不填规则 |
| 学校特殊情境 | 可选；只有真实院系/课程/学位例外才添加 | 明确范围和证据，不复制 HLS/HMS/Engineering 文案 |
| 六个主题 | coursework、exams、disclosure、privacy_data、approved_tools、research_publication | 摘要、状态、证据、条件/例外；缺资料保留明确缺口 |
| 补充主题 | academic_integrity、teaching_guidance、security_procurement；有已核实范围时可显式扩展如 admissions；默认折叠 | 有依据才填，不把 11 个分析维变成 11 个学生主题 |
| AI 工具 | 默认一行，超出展开全部；机构一般工具优先；特殊院内工具默认折叠 | 产品原名、获取条件、费用未知项、原文和适用范围 |
| 提交清单 | 合并到提交前快速检查，保留旧锚点，不另设重复勾选模块 | 不作合规证明 |
| 已审核条款 | 分类卡片；详情浮层；完整引文和定位器保留 | 经过筛选的主张/候选规则，未审项单列 |
| 官方来源 | 卡片网格，默认一行，展开全部 | 官方 URL、标题、来源身份、版本及健康限制 |
| 相关大学 | FAQ 上方的末尾区域；地理优先、同国/主题相关，再回退 | 使用真实 catalog 记录，通常 4 所；不代表政策一致 |
| 记录信息与 FAQ | 记录信息收起；FAQ 当前 12 项，两列/窄屏一列 | FAQ 复用主题摘要及来源，不另造答案 |

所有新增页面共享样式、浮层、校徽、搜索与复制功能。当前紧凑模板所有区块均不显示情境插画或配图入口，历史图资产保留。保留具体政策条件，删除的是重复空泛说明，不是范围/例外本身。

## 代码地图与职责

路径均相对实际 V6 checkout：

| 入口 | 职责 |
| --- | --- |
| `apps/web/lib/policy-v6-gate.ts` | 历史基准/本地试点与已发布 allowlist 分开；本地 development + 显式参数，生产由 published gate 控制 |
| `apps/web/lib/policy-v6.ts` | `LabSchool` / `LabTopic` 展示合同；strong snapshot / published analysis / 本地包依据分开 |
| `apps/web/lib/policy-v6-bundle.ts` | 通用本地 view 读取、哈希/身份/基本合同验证；生产拒绝读取 |
| `scripts/prepare-v6-local-bundle.py` | 显式 mapping 驱动的修复包转换；不调用模型、不联网、不选指针、不发布 |
| `apps/web/components/policy-v6-bundle-page.tsx` | 通用本地包页面组合，无 UCL 专属布局 |
| `apps/web/lib/policy-v6-local-evidence.ts`、`components/policy-v6-local-page.tsx` | Harvard/Cambridge 历史特例；不照搬它的两校名单、HMS 表或六校审核声明 |
| `components/policy-v6.tsx` | Provider、快捷入口、三个主题操作、对比、工具展开、清单、FAQ |
| `components/policy-v6-popover.tsx` | native popover，非模态、点外/Escape关闭、无背景遮罩和页面重排 |
| `components/policy-v6-record-topics.tsx`、`student-policy-snapshot.tsx` | analysis/local 与有效 strong snapshot 的主题呈现；原文 SSR |
| `components/university-ai-tools.tsx` | 获取条件与官方原文 **两个独立入口、两个浮层**；无切换 Tab |
| `components/policy-v6-claim-groups.tsx`、`policy-v6-sources.tsx` | 条款分类浮层和来源网格 |
| `lib/policy-v6-art.json`、`policy-v6-illustration-pins.json`、`policy-v6-illustrated-scene.ts` | 主题图、学校专属图的版本门槛、历史六校指南文案 |
| `lib/policy-v6-university-title.ts` | 正式主标题格式；UCL 为 University College London (UCL)，MIT 保留完整名称；不修改 catalog/API 或搜索短名 |
| `components/university-mark.tsx`、`lib/university-marks.json` | 验收标识注册，大小两档、宽字标、反白背景、缺图回退；按 canonical slug，不按 QS 行号 |
| `lib/policy-v6-*-copy.ts`、`policy-reference-ui.ts`、`university-tools-ui.ts` | 共享多语言 UI 文案；学校 EN/ZH 内容放 mapping |
| `app/(default)/universities/[slug]/page.tsx` | 唯一大学页面路由组合点；保留普通页/别名/API基线 |

## 输入合同与事实边界

爬取/审核交付至少包含：学校身份、完整原公开 Claim ID 集、原对象与 held 队列、已审核更正/新增规则、原始来源与连续引文、URL＋版本哈希、定位器、工具、六主题、分析补充主题、缺口、独立验收结果。按 [证据 runbook](policy-evidence-integration-runbook.md) 和当前 registry 冻结依据，不只看目录修改时间。

本地 view 的 schema 是 `uapt-v6-local-view-v1`。它不是公开 API schema 或已批准 student snapshot。顶层 `publicationApproved:false`；sourceBundleSha256 绑定输入 bundle 字节；学校 fingerprint 同一哈希。文件外再有 SHA256 指针。保留六维顺序、主题唯一键及全部 evidence 引用。

显式 mapping 必须提供：slug/name、sourceBundleSha256、revision、checkedAt、topic 原 status → 展示 status / EN-ZH label、补充主题名单、draft topic → 真实 claimType、缺标题 source ID → 标题、工具获取文案、Hero 标题/范围/三图/Do-Don't 行动。来源标题回退是编辑标签，不是捏造文件内容。状态映射需核对含义：`assessment_specific` 不能自动变成 blocked；历史 Copilot 数据说明不能变成当前 tenant 设置已验证。

原主张 VERIFIED 才复用原文；OVERSTATED/UNDERSTATED 只采用已经验收的 suggestedClaimEn，原表述保留在冻结包。新增 draft VERIFIED 且不在 heldDraftIds 才进入本地展示。拒绝把 machine/needs_review/矛盾项统标已审核。六校旧用户确认不能自动授权新学校或新指纹；页面 Agent 审核、完整 QS 审计、公开 strong snapshot 和发布授权各自独立。

修复包的 topic evidenceIds 未必等于原 claim 的证据集。**用实际 evidenceIds 取原文**，不要只按 claimIds 展示旧引文，导致新增 CLIE/博士条件丢失。主题内来源分组的 ID 是 source ID，不制造新的公开 Claim ID。已审核条款则保留原公开 ID 和真实 draft ID；draft 仍未公开提升。

工具 taxonomy 未收录的产品保留本地 `proposed:<slug>`，真实产品名和证据照常展示，不冒充公共 enum、不伪装成另一个产品。公共 schema 不扩充。获取方式未知则明确未知，成本未知不能填免费。工具访问、数据批准、评估使用许可分别核对。

原文不删、不意译、不自动翻译。公共 primitive 单段上限 700 字符时，脚本按连续字符分段保留全部文字并标注 offset；主题浮层仍保留完整连续引文。日期仅将同一 UTC 时刻 `+00:00` 格式化为 `Z` 以满足原 schema，不刷新时间、不推断政策生效日期。私有路径、调试信息和审核内部控制字段不进入公开 loader 或网页正文。

## 新增学校的最短工作流

1. 核对 checkout、dirty state、当前库存指针、registry；冻结输入包/验收结果。只读验证最新版包，保留旧包与历史 held。
2. 填 [单校输入清单](templates/policy-v6-school-input.md) 与 mapping。UCL 已做一次实际样板；复制其 mapping 的结构，逐字段更换证据和学校内容。
3. 从 V6 checkout 执行下面的准备命令，输出必须是新文件。脚本只生成，不自动打开预览或批准。
4. 新学校明确获准本地试套后，在 `policyV6BundlePreviewSlugs` 加 slug；**不要改六校历史 policyV6Slugs**。更新私有 `.local/policy-v6/bundles-current.json` 的相对 path、view sha256、sourceBundleSha256。指针仅在校验通过后选择。
5. 路由/组件已经通用；新增同形包不新建 JSX/CSS。新输入格式首次需要适配；学校特殊内容通过数据或可选通用模块加入，避免 `slug === ...` 长链。
6. EN/ZH先做；全部启用语言进行路由/文案键/切换检查。其余语言保留明确英语内容回退，不把 UI 翻译当政策译文审核或 SEO 扩语种许可。
7. 按 [验收清单](templates/policy-v6-acceptance.md) 核验并登记同步事件。默认只本地；不推送、不生产构建、不切内容、不改 API/changes/MCP/pins、不通知。

```bash
# 工作目录是拥有 V6 文件的 checkout；变量为任务实际私有目录。
python3 scripts/prepare-v6-local-bundle.py \
  --bundle-root "$V6_INPUT_BUNDLE" \
  --mapping "$V6_MAPPING_JSON" \
  --output "$V6_NEW_VIEW_JSON"

pnpm --filter @uapt/web typecheck
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  tests/policy-v6-bundle.test.ts tests/policy-v6.test.tsx tests/policy-v6-local-evidence.test.tsx
pnpm check
git diff --check
```

上述 shell 变量须由调用线程设置，不执行 model 提供的命令或历史 publisher。Python 3.9+，推荐当前 Homebrew Python；系统 Python 3.8 不支持 Path.is_relative_to。

预览 EN `/universities/<slug>?layout=v6`，ZH `/zh/universities/<slug>?layout=v6`。语言切换保留 layout/compare/view/differences；对比搜索复用 `/api/public/v1/search.json`，点击加选不跳学校页，最多四校。仅本地 `/api/local/policy-v6/compare` 不作为公开服务。

## 响应式与图像规范

- 按内容容器宽度，不按“手机/iPad”用户代理。工具最大列数 2 → 3（640px）→ 4（900px）→ 5（1180px），实际工具少则不生成空卡；默认显示当前一行，只有更多工具或 scopedTools 才显示展开按钮。
- 主题文字完整显示、不 ellipsis；图框 16:9 contain，不裁嵌字。同一网格行用现有 stretch/flex 对齐图片和操作基线，短文可以留空，不用伪造内容填高度。保留图片原始尺寸/比例字段。
- 主题操作只留“查看证据 / 复制链接 / 官方来源”，flex-wrap 窄时自然两行，不压到文字不可读；浮层不把下一行推开。
- 条款分类窄两列、容器850px三列；条款浮层内容窄一列、700px两列。清单620px两列；来源540px两列、850px三列。FAQ宽两列、窄一列。
- 新图通常不必要。已审核 Hero/Do/Don't优先复用；主题共享中性图可复用。学校特定图须绑定新 fingerprint，不沿用旧特定范围文案。后半段不配图。
- 校徽按验收 registry 读取小图/hero两档，保留完整字标；小图 lazy、Hero eager。QS表格行号不能作为校徽身份。未验收使用建筑图标。

## V4 / V5 的保留与退出

| 对象 | 建议 |
| --- | --- |
| V4 的指南布局与路由 | 保留现有页面、共享 PolicyReference 组件、回退开关与历史验收；新获准试点优先用 V6 |
| V4 视觉开发文件/skill | 当前只作为维护旧页的参考；不要让新线程默认重新做 reference-v4；暂不删除 |
| V5 内容合同 | **继续保留**：触发、回应、机构与可能结果、复核/申诉、支持、证据限制，以及期限主体/起算/例外 |
| V5 展示代码/历史数据 | 保留到对应学校迁入新呈现并完成证据和公开验收；不能因 V6 更紧凑就删纪律内容或偷偷接回未审旧模块 |
| V6 | 统一新前端和交互；不替代证据/学生摘要审核合同，也不宣称已覆盖 V5 全功能 |

`docs/v4-v5-site-development-plan-20261006.md` 是旧布局/内容规划；其中“全站先落 V4”作为历史阶段策略。对新的 **已获准 V6 学校任务**，本指南决定前端呈现；内容质量、证据和发布仍遵循当前 runbook。代码中 `policy-reference-preview.ts` 和 `enforcement-v4-refresh.tsx` 仍被普通路由引用，所以现在删除会破坏功能。并未重新验收公网，因此不以源码 allowlist 断言当前线上 cohort 数量。

删除条件：逐校默认/别名/语言路由和数据迁完；V5有价值内容保留；旧 hash/claim 深链、打印、正常页及候选/公网对照通过；发布回退窗口结束；最后才移除无调用的旧组件。现在只调整新开发入口，不删除历史标准。

## 线程成本与并行边界

首次试点的成本主要是把异构资料整理成稳定输入。之后同形包只需一份 mapping、脚本和验收，不需读取全部站点代码、全量原文或反复发截图让 AI 重建。线程只读取本指南、目标单校包索引、对应证据与必要组件；复杂事实仍须独立核对。没有实测 token 账单，不能承诺每校固定 token 或节省百分比。

多个线程各自生成新私有 view、mapping 与验收记录；共享 route/gate/registry/locale/CSS 由一个集成线程合并，避免同时覆写指针。输入转换/图文简报可并行，审核与指针选择有顺序依赖。任何失败保留明确 gap，不为通过模板把缺内容填成允许。

可直接发给下一线程的任务见 [线程提示](prompts/policy-v6-school-task.md)。

## UCL 试点实际结果（2026-10-13）

采用最新已验收 r4 修复包；6 条原公开主张按已验收更正映射、8 条 VERIFIED 新规则，共14条本地展示；19个官方来源、2个工具、6+3主题、12项FAQ。两条原纪律对象继续 held，Copilot当前设置/价格继续未知，整校审计仍PARTIAL。Studiosity用本地proposed身份展示，未改公共工具分类。

首版转换暴露了来源缺title、analysis与student同名维度状态不同、UTC `+00:00`格式、700字符primitive限制；都在显式mapping/转换层处理，未改源包。浏览器发现同URL多版本React key冲突，统一用URL+hash修复。模板代码无需按UCL重新绘制或写专用CSS，既有三图直接复用。

实测：UCL EN/ZH ×390/720/1440六状态、明暗代表截图；无横向溢出，三操作可读，证据与工具独立浮层、Claim深链和添加Harvard对比通过。19条HTTP回读覆盖六校EN/ZH对照和UCL七语言；原文分段重组/SSR保持、普通UCL页/API保持原基线。4种错误mapping拒绝，11项相关回归、pnpm check、最终web typecheck及diff检查通过。其余五语言未做完整译文/视觉审核；打印与关闭JavaScript未在本轮重验。无fresh crawl、生产构建、推送、上线或通知。

本机证据目录：V6 checkout的 `.local/policy-v6/ucl-pilot-20261013/`。当前选中的view-v3是UTC序列化/长引文适配后版本；v1/v2保留历史、不再选用。后续同形学校复用脚本和组件，新的内容映射仍需核对，不能把此试点的通过状态复制给其他学校。

## 2026-10-13 三校本地接入与爬取合同核对

Caltech、ETH Zurich、NUS 已分别接入独立 bundle preview 队列；六校历史参考队列保持原身份。实际包、映射、父 manifest、逐 ID 对账、浏览器证据及同步事件位于 V6 工作区私有 `.local/policy-v6/three-school-20261013/`。以 `bundles-current.json` 指定的不可变视图为准，不能继承其他学校的审批或 `strong` 状态。

- 异构爬取包必须先验证父 manifest，再在独立转换层映射分类；原分类、完整原件、旧快照、审计 disposition、requirements 和 held 仍在冻结父包中。转换不补造大学政策核查日期。
- 全部公开 Claim ID 在展示或明确排除表中对账。STALE、争议或 held 不进入已核实结论；记录区保留对应 ID。展示 claim 必须保留受审的适用范围。
- 逐字原文与所有连续分段可重组核对，PDF 保留物理页码、真实位置与来源 hash。未知页码不得推定；EN 原文不自动翻译为审核过的其他语言政策。
- 工具的资格、费用、模式、数据审批、教学许可分别呈现。员工/研究项目/课程/消费者模式使用显式 `scopedToolNames`，默认折叠；所有模式仍保留原文浮层。转换产品身份不扩公共 taxonomy。
- 六个学生主题与三个补充主题是展示映射，不是完整 11 维分析或 25 项爬取要求的替代物。其余分析、历史来源及操作凭据留在证据层。不得用页面接入通过声称全校审计无缺口或所有存档都已展示。
- V6 私有预览通过不代表普通页面/API/snapshot/MCP/changes/search 已采用新数据。未来政策发布仍须在同一 release 更新学校 changes/history/diff 及适用同步面；本地任务另登记同步事件并保留公网面排除理由。


## 2026-10-14 数据与证据接入补充

新任务冻结 `docs/policy-audit-requirements-v1.1.json`（1.1.0），保留 1.0.0 库存及审核。新要求覆盖从 not_checked 开始。下一次新库存通过 resolver 的 requirementsRegistry 显式选择新文件；不得原地改旧库存 requirements.json、哈希或批准结果。1.0.0 的库存诊断通过不代表已覆盖 1.1.0。

### 展示边界

保持现有页面骨架、间距、卡片和交互。不因后台修复在 Hero、快捷摘要或正文增加开发说明、审计统计、版本解释横幅或重复免责声明。摘要只保留学生做决定需要的规则、范围、条件与未知项；详细原文、定位、历史版本及适用审计结论由现有卡片详情、证据和 changes 入口展开。后台响应可含追溯元数据，不自动转成页面解释文案。

保留 V5 有价值的纪律程序内容与全部证据；所有适用的公开内容须能通过现有入口追溯。私有绝对路径、运行日志、凭据、内部提示词与未审 draft 不公开。详细信息无现有入口时先记录接入缺口，不用删内容或在首页堆文字解决。

### 数据集合与结论依据

分别登记当前 Claim IDs、独立工具对象、来源对象、held/history IDs、学生摘要版本及补充主题，逐集合对账。`approved_tools` MCP 查询核对公开工具集合、人员资格、费用、账号与证据；Claim 数量相等不能证明工具完整。工具访问不建立课程、考试或敏感数据授权；范围不足的研究规则不得投射成全校课程规则。

对每个学生结论保存对应 Claim/evidence IDs、规范强度及适用范围。主题、快捷摘要、FAQ、Do/Don't、对比及插图文案应使用同一受审依据；条款改动后核查全部投影。招生等补充主题使用现有合法 claimType 和显式映射，不扩未支持的枚举或复制学校 JSX。

候选审核时对目标学校冻结大学 JSON 与分析 JSON，执行后台结构校验：

```bash
pnpm exec tsx scripts/validate-assessment-evidence.ts <university.json> <analysis.json>
```

校验拒绝课程/考试仅有工具依据、缺失/重复/外校 basis IDs 和无依据的许可结论。它是显式调用的非写入门禁，尚未接入全部历史分析生成器或生产 runtime；不能声称当前线上已自动拦截。通过仅建立结构条件，不证明混合证据中的范围、强度或语义正确；这些仍独立审核。

### 来源与 PDF

逐来源保存原始字节、提取文本、引文的独立哈希及 hash kind/scope；批次哈希不可当成每个 URL 自身 SHA。URL + 版本哈希维持来源身份，同 URL 多历史版本不误合并。绑定校验必须拒绝跨来源引用错配，不能为让 MCP 通过而关闭 hash gate。

PDF 从同一保存原件完成文件类型检查、原始哈希、文本提取、封面及规则物理页渲染、条款和引文定位。HTTP 200 返回 HTML 不是 PDF 成功。缓存文本/截图差异本身不证明 STALE；冻结原件验证与现网字节验证分别报告，未取得现网原件继续保留 gap。

### 版本、时间与审核

区分 datasetReleaseId 全局基线、universityRevisionId 学校修订及页面/内容包版本；先检查已有字段，再决定修复，不能改历史 ID 消除表面歧义。历史 changes/JSON 按请求的冻结修订读取，不用最新包重解释旧记录。

分别保留政策发布、生效、修订、取回、实际复核、包准备/发布、切换、索引基线及响应生成时间。响应变新不刷新所有 Claim 的 lastCheckedAt。审批只绑定受审指纹；已完成 ChatGPT agent 审核的相关记录可按现有契约标 agent_reviewed，不创造 human/dual-agent 或 institution_verified。

### 验收及同步

记录 LOCAL_PREPARED、COMMITTED、PUSHED、CANDIDATE_ACCEPTED、DEPLOYED、PUBLIC_VERIFIED 的实际达到阶段及凭据，不以单个总状态掩盖未完成项。源码检查、结构通过、一致性抽查、官方语义审核、视觉验收各列覆盖范围。跨语言原文一致不是全部原文实时准确率；隐藏 DOM 标题、测试定位失败与可见 UI 缺陷分别判断。

目标 changes/history 冷启动和稳定运行都须验收；超时保留 failed，不能被其他通过项抵销。公开提升同一 release 完成学校 changes、history、索引、latest diff、recent changes、RSS；即使只改工具或 Tracker 元数据，也按实际影响登记。无政策变化不制造大学新规。候选读回与公网读回分别执行当前 2.0.0 合同。学校/Claim/工具/语言/路由数量从冻结包得出，不硬编码示例数字。

生产代码地图补充：`lib/policy-v6-published.ts` 和 `lib/v6-effective-records.ts` 分别读取公开页面包和有效记录；`data/public-v6-pages`、`data/public-v6-records` 保存修订和指针。MCP 目录消费独立工具对象；索引 provenance 是响应元数据。这些入口的具体可用性仍以实际 checkout 为准；本地新增代码不自动等于线上实现。

### 2026-10-15 MIT 行动指引单校试点

仅 MIT 试点，其他 V6 学校须等用户验收后再接入；不能把本次批准推广到其余 cohort。紧凑 Do/Don't 各三项放在四个核心问题后，逐项区分本范围要求、来源建议与本站建议。AI 使用疑虑入口的调查/可能后果/复核申诉分别显示，具体规则、时限、范围与原文放入既有浮层。当前主张与已发布程序补充维持各自对象身份，不用补充对象冒充 Claim；缺证据不填通用期限。历史补充的恢复需重新查对应官方正文，而非仅复用旧采集日期。

既有主题正文与重复说明均保留。三张既有情境插画以可展开、可打开原图的紧凑条带保留，主题配图不删，不生成新图；不回迁整套 V5 大幅漫画。新投影同时绑定当前学校指纹、记录哈希、逐项 Claim/evidence 和实际图像哈希，不能直接重算旧 illustration pin 伪称重新审核。依据变化时保留指引入口和明确的证据更新提示，不能再次把整个模块静默隐藏。恢复缺失模块是本次 UI 修复，不代表全校政策审计完成。

## 2026-10-15 已验收帝国理工布局推广为共享模板

本节取代上面历史试点关于“仅 MIT/Imperial”、保留情境插画和重复勾选清单的当前展示约定；历史政策数据、图片文件、审核 pin 和验收凭据不删除。以公开页面包 `slugs` 为 V6 范围，`v5Slugs` 不自动转换。当前实际为 13 所 V6，北大维持 V5；以后以指针实际值重新计算。

- 唯一共享实现：`policy-v6-compact-guide.tsx`、`policy-v6-record-topics.tsx` 与 `policy-v6.css`；`data-ui-experience=compact-evidence`。不得复制帝国理工的学校规则、期限或 JSX 给其他学校。历史 Imperial import 路径仅作兼容导出。
- 身份标题后只保留低调的“独立整理 · 免费开放 · 非学校官方页面”；不恢复已移除的翻译免责声明、开发解释、额外 Banner、无意义分隔线。
- 四问覆盖作业、工具、研究与教学，无序号；四问下紧凑提交检查入口。六主题宽屏等高、手机单列自然高度；中文导读与完整英文范围说明分层，原文直接从证据入口阅读。
- 不显示任何情境插画及配图按钮，不生成新图，不删除历史资产或审核记录。
- 主题之后、工具之前显示紧凑 Do/Don't 与 AI 疑虑入口。要求/来源建议/本站建议独立标识，标签至少 12px、证据触控区域至少 44px；正文深色，红绿用于标题和边线。有条件为黄，受限为红，建议为绿，未提及为灰；颜色不改变状态或规范强度。
- 疑虑详情支持 `?guide=concerns`、关闭返回、复制链接、打印；手机全屏。各组只呈现本校已发布的适用程序；无已核实程序/期限显示证据缺口，禁止复制 MIT COD、Imperial D17 或其他学校期限。MIT 原有补充对象维持 `published_supplement` 身份和 scope/deadline 全文。
- `data/policy-v6-student-actions.json` 保留原 MIT/Imperial 已验收投影；其他学校及 MIT 中文主题导读由 `data/policy-v6-compact-projections.json` 显式映射。绑定学校 fingerprint、记录 hash、准确 Claim/evidence 与英文主题摘要；不一致时拒绝使用，不自动刷新批准。导读不建立正式 student snapshot 或新校规。
- 所有启用语言核查 SSR、原文与链接；EN/ZH 逐校手机/平板/桌面交互，明暗、打印、键盘焦点及分享代表性核查。其余语言导读按现行英文回退，不宣称政策译文完整审核。
- 每所变更学校更新其 changes 的 presentation note；保持政策修订、政策日期及 RSS 不变，不把 UI 发布说成大学改规。最小发布采用同一个有界共享 zone、冻结 SHA/BUILD_ID、精确路径和独立资源前缀；不动主站框架、数据库或 V5 路由。

## 2026-10-15 北大接入与校徽首页导航

北京大学现在接入共享 compact-evidence V6，公开 V6 名单为 14 校；此前 13 校/V5 北大说明是历史状态，以新页面指针为准。北大 63 Claim、33 工具、48 来源和政策修订 `pku-v5-20261014-r3` 均不因此改号或刷新核查日期。新页面版本独立于政策版本。纪律申诉 10 日、校内处理 15 日及复杂案件延长、外部申诉 15 日、学位复核处理 30 日分别保留完整范围与起算条件，不合并成通用申诉期限。

所有 V6 标题校徽由 `UniversityHomepageMark` 共享组件链接大学正式首页，URL 取自 `lib/university-homepages.json` 的逐校显式映射。不能直接继承 catalog.website（现有部分值为 IT/图书馆/政策单位）。仅标题校徽添加链接，不把对比按钮内部的校徽做成嵌套链接。默认同标签页，保留 Ctrl/Cmd 点击原生行为、明确无障碍名称及可见焦点；无正式首页映射时保持普通校徽，不猜 URL。新增学校应联网核对正式根站并加入映射及浏览器 href/点击验收。政策、原文、日期和审核状态不因导航变化修改。
