# 大学校徽统一入口

更新：2026-10-19。

当前828条大学目录记录（815所大学）全部有标题图和小图文件。完整采集库共1099所、2198个用途，包含旧资源、本轮32所目录补图和Delta历史空缺补图。

## 文件

- 最新表格：`/Users/newvolume/Documents/university-ai-policy-tracker/outputs/university-marks-20261019T190116Z/university-marks.xlsx`
- 固定指针：`/Users/newvolume/Documents/university-ai-policy-tracker/.local/university-marks/current.json`
- 完整manifest：`/Users/newvolume/Documents/university-ai-policy-tracker/.local/university-marks-unified-20261019T190116Z/handoff/manifest.json`
- 完整资源包：`/Users/newvolume/Documents/university-ai-policy-tracker/.local/university-marks-unified-20261019T190116Z/university-marks-full-1099.zip`
- 压缩取图包：`/Users/newvolume/Documents/university-ai-policy-tracker/.local/university-marks-unified-20261019T190116Z/university-marks-assets-1099.zip`，包含实际展示变体及尺寸/背景合同，适合其他线程导出页面资源；原件和来源在完整资源包内。

Excel第一张表对应当前828条大学目录记录（815所大学，含13组同校别名），第二张表对应去重后的1099所已整理大学。另有11条旧库历史身份与QS身份重合，已按完整校名、国家和官网证据合并，原图和来源均保留。每行都有标题、小图的包内文件路径、实际可用像素、背景和显示限制。覆盖范围是当前目录和已整理采集库，并非全球所有大学。

## 其他任务取图

```bash
python3 /Users/newvolume/Documents/university-ai-policy-tracker/scripts/university-mark-assets.py ucl --role title --slot 96 --dpr 1
python3 /Users/newvolume/Documents/university-ai-policy-tracker/scripts/university-mark-assets.py brac-university --role compact --slot 32 --dpr 2
```

按canonical slug精确查找当前目录学校。暂未进入目录的学校可用Excel最后一列的库ID查询。JSON通过 `catalogBindings[].slug → id → entries[].roles` 绑定；不要以排名或近似校名匹配。标题读title，搜索/比较/目录/相关大学读compact。

指针校验manifest后，使用变体的实际width/height/sha256；路径相对manifest目录。`local-compact-registry.json`提供当前828条目录记录的开发预览小图映射，字段保留现有local entry的尺寸与背景合同。它不能覆盖共享组件或替代集成线程的受控导出。

## 显示要求

保持图案完整与原配色，contain且不放大位图。按实际尺寸和DPR选变体；读取minimumWidth、maximumWidth、minimumDisplaySlot、actual32Accepted、requiredBacking及limitations。低分辨率图按原生上限展示，较小槽位使用通用学院图标。明尼苏达系统使用solid Block M且至少45px，保留相邻完整名称。Wollongong继续使用44×56深底专用槽，纹章实际宽至少40px。

原件、来源和历史决策保存在包内；压缩WebP在assets目录，originals/provenance不作为公开浏览器资源。旧冻结包和held/reject不改；单项来源及品牌状态随角色保留。此交付未修改其他工作区正在运行的页面或现网资源注册表。
