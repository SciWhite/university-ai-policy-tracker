# V6 输入、来源哈希与 SEO 合同

状态：本地实现，尚未发布。基于 `9166c421e0aec585b85763371f58896adb79f3b5`。
未改政策内容、公开指针、历史原包、Claim ID、held、审核指纹或语言批准范围。

## 一个入口，三种适配器

三种表示形状仍有实际用途：record 使用公共记录，bundle 带显式主题/工具映射，
evidence 保留历史范围表。它们现在经过 `acceptV6SchoolInput`，由同一个运行时
resolver 选择；同时提供 bundle/evidence 会失败，不会静默遮蔽。

`pnpm validate:v6-release` 对当前页面包和记录包共同验收，已加入 `pnpm check`：
学校/七语言集合、六主题顺序、主题证据或明确缺口、公共完整 Claim 集、记录指纹、
held 分离、工具字段及特殊表格映射。目录关系标签是展示字段，来源字段必须一致。
没有原文支持的主题允许保留 not_mentioned/insufficient_public_evidence/unclear，
不生成新的允许/禁止结论。合同校验不替代语义、范围、时效或独立审核。

新增已发布 V6 的工具模块从公开指针派生；历史 V4/V5/私有预览登记继续保留。
不把私有 inventory 变成生产输入，也不继承六校旧批准。

## 新包的统一打包流程

先完成真实审核和同步凭据，冻结两个公开包，准备私有输入 manifest：

```json
{
  "schemaVersion": "uapt-v6-release-input-v1",
  "pages": {"path": "pages.json", "sha256": "<exact-byte-sha256>"},
  "records": {"path": "records.json", "sha256": "<exact-byte-sha256>"},
  "acceptance": {"path": "acceptance.json", "sha256": "<exact-byte-sha256>"},
  "syncLedger": {"path": "event.json", "sha256": "<exact-byte-sha256>"}
}
```

相对路径按 manifest 目录解析；这些机器路径不会复制进公开包。
acceptance 使用 `uapt-v6-packaging-acceptance-v1`，包含
`decision:accepted_for_packaging`、`pagesSha256`、`recordsSha256`、
`syncLedgerSha256`，以及 `sourceHashes` 数组。每个条目含
`sourceUrl`、`snapshotHash`、`hashKind`；raw/text 类型分别提供等值的
`rawSha256`/`textSha256`。`unknown_legacy` 必须写 `unresolvedReason`。
覆盖全部 officialSources 和 Claim evidence/attribution 的 URL＋版本组合，
不以某个域名或相同哈希合并不同 URL。

```sh
pnpm v6:pack --input <manifest.json> --sha256 <manifest-byte-sha256> \
  --output <new-isolated-staging-directory>
```

命令验证两包、验收绑定、公开字段、逐来源哈希种类及同步合同 2.0 candidate gate，
随后输出 immutable shards、source-hash-provenance.json 和 receipt。使用真实 loader
还原全部输出，失败不产生成功 receipt。输出目录必须全新、父目录已存在，且位于 tracked data 之外。
失败目录保留诊断，使用另一个全新目录重试。

输入已带 publicationApproved 标记不等于脚本替用户审批；接受文件同样不能凭空证明
语义已审。脚本不授予批准、不选择 current、不生成新政策、不推送或部署。
旧单文件 exporter 只用于已冻结旧包或历史转换，拒绝新 page/record revision。
历史一次性 publisher 不再是新包入口；存量 aggregate guard 继续拒绝新整包复制。

发布仍按 release routing/lifecycle 决定代码与内容适配，并核对输出 provenance 的
实际安装与 API 回读。当前 loader 的登记仍由代码导入；本工作未增加 live reload。
同一来源 registry 必须随使用它的代码进入候选验收，不能仅把 staged 文件当成已选中。

## 来源哈希口径

公开大学 JSON 增加 `sourceHashContract`，保留原有字段与记录序列化指纹。
主站与共享 zone、zone 的历史记录响应共用同一解释器：

| 类型 | 对应字节 | 不能据此推断 |
| --- | --- | --- |
| raw_captured_bytes | 所保留的捕获文件字节 | 不保证是 HTTP 压缩/传输层字节 |
| extracted_text_utf8 | 所保留提取文本的 UTF-8 字节 | 不等于 HTML/PDF 文件；没有跨抓取统一的文本归一化保证 |
| unknown_legacy | 历史公共字段未建立表示口径 | 不从引文定位器或字符串相等推断 raw/text |

record fingerprint、分片对象 hash、包原始字节 hash、source snapshot hash 是不同对象。
哈希匹配只证明被绑定对象身份，不证明政策仍有效、范围正确或已获审批。
工具 evidence.snapshotHash 和主题 sources.hash 如引用相同 URL＋捕获版本，应遵循
相同表示口径；不得凭字段名宣称原始文档字节。新适配器必须保留明确绑定。

本次实际核对 Cornell 冻结私有凭据与捕获文件：95 条 evidence、17 个来源版本，
分别验证 raw/text 文件 SHA-256、引文字符范围、quote SHA-256，以及公开两处 hash。
新增公共 registry 只含 URL、版本、raw/text digest 与验证类别，不含私有路径。
17 个版本均为 extracted_text_utf8。其他未取得同等表示凭据的历史版本明确为
unknown_legacy；这是保留缺口，不是断定它们的哈希错误。来源卡片可展开查看口径。

## 三条页面路径的 SEO

V6 页面的 metadata 和 WebPage/Dataset JSON-LD 使用同一个 helper，提前返回的
bundle/evidence 分支也输出 JSON-LD。中文 title/description 使用中文 UI 描述，
不宣称正式学生快照已批准。canonical、description、公开 JSON 链接共同校验。
Harvard 的英文-only hreflang 限制保留；中文 UI 不构成政策译文审核。

本地结果：22 项相关回归、pnpm check、zone typecheck 通过；全部 16 校七语言共
112 页，加 MIT 对照和三条当前/历史 JSON，共 116 HTTP 回读通过。浏览器实际展开
Cornell 中文来源哈希详情，390/720/1440 宽度无水平溢出。测试中的 Yale 路径不属于
bounded zone，首次误作对照得到预期 404，已保留原日志并改用 zone 内对照；
浏览器还记录到 zone 未承载的 favicon/analytics 404，不当作本站完整运行验收。

实际以现有 16 校/507 Claim/205 工具/7 held 做配对打包并还原一致；保留原包。
私有执行证据与本任务同步事件位于 `.local/v6-contract-seo-20261016/`。
这些结果不替代 OCI 候选、公网回读、容量验收、发布授权或 Gemini 独立复核。


2026-10-17 发布前补充：打包器将新来源绑定与现有注册表按 URL＋版本哈希合并。
旧版本保持可查询；unknown_legacy 不覆盖已验证口径；同版本的 raw/text digest 或已知
表示类型冲突会失败。receipt 同时记录原 registry 字节 hash 与合并输出 hash。
未发布私有 V6 预览继续 noindex 且不借用公开 Dataset 描述候选；已发布三路径统一输出。
