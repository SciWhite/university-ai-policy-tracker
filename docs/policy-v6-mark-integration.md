# V6 校徽补齐包读取与接入合同

更新：2026-10-26（合并统一校徽入口；旧包及技术审查记录保留）。供单校资料准备和集成线程使用；本合同不表示已实现包导入器、不改变公开 registry，也不授权发布。先读 [V6 主规范](policy-v6-integration-guide.md)。

## 当前完整入口（优先读取）

当前取图改用[大学校徽统一入口](university-marks-current.md)。它覆盖当前828条大学目录记录（815所大学），并汇集既有采集库，共1099所、2198个标题/小图用途；本轮32所目录缺项已经补图。每个用途都有实际压缩文件，尺寸、背景、原生像素和品牌限制随记录保留。

固定指针为主工作区 `.local/university-marks/current.json`，schema为 `uapt-university-marks-current-v1`；指向的完整manifest为 `uapt-university-marks-unified-v1`。按 `catalogBindings[].slug → id → entries[].roles.title/compact` 读取，不再要求单校线程自行拼接旧基线和211增量。资源路径相对manifest目录，须校验指针中的manifest hash及所选资源hash。

只读查询示例：`python3 scripts/university-mark-assets.py ucl --role compact --slot 32 --dpr 1`。查询会检查尺寸条件、原生像素和实际文件hash；槽位不满足条件时返回明确缺口，不伪造可用结果。该脚本不是页面导入器。主工作区与其他checkout路径不同，应使用主工作区脚本绝对路径或显式 `--pointer`。

下面211用途包的路径和hash继续作为冻结历史依据保留，不能再当作最新完整取图表。公开用途状态、历史held/reject、深底/native限制及共享组件的集成归属继续有效。

## 固定输入与两层状态

本机冻结目录：

```text
/Users/newvolume/Documents/university-ai-policy-tracker/.local/university-marks-external-fill-20261019T015011Z/
  summary.json
  artifact-manifest.json
  seal-verification.json
  display-conditions.md
  role-reviews.json
  source-attribution.md
  private-university-mark-delta-211.zip
  handoff/
    manifest.json
    file-hashes.json
    assets/
    originals/
    provenance/
```

ZIP 解压后以 `university-marks-delta/` 为资源根，对应上面的 `handoff/`，不是整个采集目录。其他 checkout 应显式引用此绝对路径或复制并验证冻结包，不能假设自己的 `.local/` 已有副本。

| 冻结对象 | SHA256 |
| --- | --- |
| `handoff/manifest.json` | `1b78097f130c9ada84311df68436956a3c32ef43b37890d50d2e6fd79fbe37e9` |
| `artifact-manifest.json` | `90b49dff91f01ad90eed3d3989ef2aac2df601d5bb04233a3f2e2b39a4290295` |
| `private-university-mark-delta-211.zip` | `367166baca93aba6f551c7213313be7667f2fa7f1539e17290ca0c1bdf22a1c3` |

包 schema 为 `uapt-private-mark-delta-v1`，顶层 `roles` 共 **211 个用途条目**：本轮200项（151校，140 compact/60 title）及此前前200补齐的11 compact；它是**增量，不是1003校的全部原件或现网 registry**。1003校双用途齐备是原有私有通过层加候选技术层的合并统计，不能把本包当作211所大学或新的全量公开通过数。

原件私有通过基线位于主工作区 `.local/university-marks-top200-20261018T194605Z/accepted-role-registry.json`，SHA256 为 `230bfb47023da38e8b23d8995d40f5401123dfd3f3db485e2ff0b4f01bb1c5a4`；它的1795个官方QS角色和另列133个历史角色不是本ZIP的内容。该私有基线也不是现网服务注册表，里面的 `directory`/原件路径必须在其冻结依据下解析。

**技术候选通过与可公开使用分开**：`technicalDisplayDecision`、`actual32Accepted` 只说明指定尺寸/背景的技术检查；`officialReferenceVerified` 仅说明记录的来源核实状态；`publicationApproved:false`、`publicUseReviewRequired:true` 和品牌/仪式用途、历史版本、非自由文件限制继续有效。不得改成 true 来适配旧组件的 accepted 标记。

## 单校选图与合并顺序

1. 核对实际 V6 checkout、目标 catalog 的 canonical slug、QS core ID 和大学身份。`qsRow` 是包内追溯键，**不能拿排名作身份**；包的 `key` 是 `qsRow:role`，不是 URL。先精确匹配 `canonicalSlug`，再比对 `qsCoreId`、全名及已核实国家/官网；别名、更名、同名冲突进入明确待核队列，不模糊猜测。
2. 验证冻结 manifest、文件列表及实际选中文件 hash。所有包内路径相对资源根，拒绝绝对路径、`..` 和符号链接逃逸。缺文件、重复的同校同 role 或 hash 不同立即保留 gap，不自动下载替代文件。
3. 按 **canonical slug + role** 合并，保留实际 checkout 现有已验收服务资源。增量只填缺少/held 的用途；同用途已有好图时保留原图，另存候选选择记录，不按文件日期自动覆盖。ZIP中此前11项按 `sourceStage:prior_top200_11_NOT_NEW_COUNT` 去重，不重复增加通过数；与基线身份冲突不得静默覆盖。
4. Hero 取 `role:title`；搜索建议、对比选项/标签、大学列表/相关大学取 `role:compact`。如果本包仅有 compact，该校 title 从原有资源取得；反之同理。不能把 title 横标缩到32px顶替 compact。相同完整校印可以按两个已检查 role 使用，不为凑两套重新裁图或下载。
5. 单校线程仅写自己的**私有选图记录**，包括 manifest hash、身份、key、原图/派生图 hash、候选路径、尺寸/背景/用途条件和 fallback 理由。共享注册表、资源导出、组件/CSS由集成线程串行处理，且需要相应本地接入授权。没有资产条目时保留建筑图标，不把回退算成已采集校徽。

## 字段如何映射到页面

| 包字段 | 读取与展示要求 |
| --- | --- |
| `canonicalSlug` / `qsCoreId` / `name` | 精确身份映射；完整正式校名仍为相邻可选文本；校徽图片不替代H1或链接可访问名称 |
| `role:title` | 对应 `UniversityMark` 的 Hero 用途；完整字标或已核实完整符号，contain，按真实比例/可见高度布局，eager |
| `role:compact` | 对应 small/chip 等小图用途；保留完整选中图案，contain，lazy；需要相邻校名 |
| `variants[].path/sha256/width/height/bytes` | 使用压缩WebP的实际解码尺寸和hash，不用 `size` 文件名推定实际像素；原图/巨大SVG不直接当服务图 |
| `master` / `original` 及对应hash | 复核和后续受控导出的依据；不覆写原件，不将私人绝对路径暴露给浏览器 |
| `scalableVector` / `derivedNativeDimensions` / `nativeRasterUpscaleAllowed:false` | SVG容器可能内嵌位图；按记录判断。位图不得CSS放大或伪称2x，选择变体时按实际像素和DPR核对 |
| `actual32Accepted` / `minimumCompactWidth` | false不是32px通过。小图槽位必须满足最小尺寸；不能仅凭分辨率或方形画布自动放行 |
| `minimumDisplaySlot` / `uowCrestWidthAtLeast40` | Wollongong特殊合同，除槽位尺寸外还要核对实际纹章宽度，不按外框宽度替代 |
| `requiredBacking` / `limitationsRetained` | 保留 light/dark/学校指定底色；不套滤镜、改色、圆形强裁或为深色模式抹掉背景条件 |
| `sourceKind` / `provenanceFiles` / `provenance` | 私有选图记录保留来源分类、文件证据与版本；仓库/Wikipedia不能伪装官网引用或商标许可 |

已存在的候选图无需再裁切；有明确用户授权时，新的完整图层分离/外部留白裁切另建派生版本，保留原件、配方和独立图形检查。不得重绘、改色、削掉盾/字的组成部分或放大位图；第三方素材不会解除已有品牌用途限制。

## 尺寸与背景例外

本轮9个 compact 不作为32px通过。下表的宽度是最小展示要求，仍要按完整比例、真实渲染像素及相邻名称检查；小槽位继续使用通用学院图标，不能擅自放大搜索行高度。

| 大学 | 最小 compact 展示宽度 |
| --- | ---: |
| Tel Aviv University | 48px |
| University of Maribor | 48px |
| Universidad EAFIT | 48px |
| Bina Nusantara University (BINUS) | 64px |
| Immanuel Kant Baltic Federal University | 64px |
| École Normale Supérieure de Lyon | 64px |
| Universidade Federal de São Paulo | 64px |
| Université de Franche-Comté（现有继承身份绑定保留） | 96px |
| Sabanci University | 96px |

此前11项中的 **University of Wollongong** 另需深底、44×56专用槽、实际纹章宽至少40px，不能按32px通过。所有其他明暗/原生1x/仪式校印限制仍逐条读取 manifest，不能只检查此表。UNIFESP完整组合标的文字与屋顶边缘相邻，保留完整图及64px条件，不再次裁楼。

压缩图按真实尺寸选：例如 Deakin 的 `64.webp` 实际只有50×48，不能宣称64px或32px@2x就绪。目标32 CSS px@2x需要至少对应64物理像素；不足则保留明确1x限制/回退。标题同样按变体实际尺寸限制，不默认拉大到统一固定框。无损WebP无需再次低质量压缩。

## 只读选图样例（不是导入器）

在主工作区的任意工作目录均可运行；修改 `slug` 为实际已核实目标。此例只核hash并输出候选路径，不复制文件、不写registry、不批准本地展示或发布：

```bash
python3 - <<'PY'
from pathlib import Path
import hashlib, json

root = Path('/Users/newvolume/Documents/university-ai-policy-tracker/.local/university-marks-external-fill-20261019T015011Z/handoff').resolve()
slug = 'deakin-university'
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert digest(root / 'manifest.json') == '1b78097f130c9ada84311df68436956a3c32ef43b37890d50d2e6fd79fbe37e9'
manifest = json.loads((root / 'manifest.json').read_text())
assert manifest['schema'] == 'uapt-private-mark-delta-v1'

def checked(relative, expected):
    p = (root / relative).resolve()
    assert not Path(relative).is_absolute() and root in p.parents
    assert digest(p) == expected
    return p

roles = [r for r in manifest['roles'] if r['canonicalSlug'] == slug]
assert len({r['role'] for r in roles}) == len(roles)
for r in roles:
    checked(r['original'], r['originalSha256'])
    checked(r['master'], r['masterSha256'])
    variants = []
    for v in r['variants']:
        checked(v['path'], v['sha256'])
        variants.append({k: v[k] for k in ('path', 'width', 'height', 'bytes')})
    print(json.dumps({k: r.get(k) for k in (
        'key', 'qsCoreId', 'canonicalSlug', 'name', 'role', 'sourceStage',
        'actual32Accepted', 'minimumCompactWidth', 'minimumDisplaySlot',
        'requiredBacking', 'limitationsRetained', 'publicationApproved'
    )} | {'variants': variants}, ensure_ascii=False))
if not roles:
    print('No delta role: inspect preserved registry/baseline; do not infer missing university logo.')
PY
```

Python样例需3.9+。输出仅是资源查找结果，身份、role fit、DPR和用途条件仍需实际核对。完整包/解压副本还须校验 `file-hashes.json` 与ZIP来源hash，不能只验证这一个学校后宣称全库验收。

## 当前实现边界与接入交付

2026-10-26 以线上共享 V6 `2e1a0052` 为整合基线复核：`UniversityMark` 同时支持既有 `university-marks.json`、已发布 `university-marks-published.json` 及 development-only 本地候选。已发布 compact 通过 `getPublishedCompactMark` 读取；仅在对应 geometry 合同要求时替代旧 compact，其他已验收图保留。不能再将当前实现概括为“只有 20261013 tuple”。

当前组件仍**不是统一 1099 校 manifest 的通用导入器**；不能把私有候选的 technical/available 状态转换为公开批准。新增 title/compact 角色须先输出保留全部限制的私有选图记录，再由共享集成人集中处理。本地预览与公开资源审批分别登记。

集成线程应先准备独立的本地适配与导出方案：保留原有条目，仅映射获准角色，给受控压缩资源选定新版本目录，同时承载尺寸/背景/原生限制及回退；**不能仅把候选转换为旧tuple丢掉限制**。具体实现、公开用途处理与浏览器验收是后续任务。本规范不要求单校线程自行改共享组件，也不宣称有现成一键命令。

单校交付使用 [输入模板](templates/policy-v6-school-input.md) 的 `universityMarks` 交付字段，并完成 [验收清单](templates/policy-v6-acceptance.md) 的校徽检查。记录Hero、搜索建议、比较选项/标签、相关大学实际触达面；明暗、窄屏、缺失/不满足条件时回退与图片失败回退分别测。只改文档时这些浏览器项标为未执行，不能复制本包截图充当页面验收。
