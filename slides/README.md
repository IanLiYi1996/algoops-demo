# Slides · AlgoOps booth deck

12 页 HTML 分享 deck(精简 booth 版),含中文逐字稿(speaker notes)+ 4 张 SVG 流程图。
视觉对齐 demo 的 `DESIGN.md`(Coinbase 机构风:白底 + Coinbase Blue + Inter/JetBrains Mono)。

## 打开

```bash
open slides.html        # 或 xdg-open / firefox slides.html
```

## 键盘

- `← →` · `Space` · `PgUp/PgDn` 翻页
- `S` 演讲者视图(当前页 / 下一页 / 逐字稿 / 计时器)
- `T` 切主题(algoops / corporate-clean / minimal-white / swiss-grid / blueprint)
- `F` 全屏 · `O` 总览 · `Esc` 关弹窗

## 12 页

| # | 页 | 内容 |
|---|---|---|
| 1 | Cover | AlgoOps 定位 |
| 2 | Agenda | 今天看什么 |
| 3 | Pain | 离线漂亮、上线翻车 |
| 4 | Four Stages | 调研→评估→验证→沉淀(SVG) |
| 5 | Architecture | 浏览器→API GW→relay→Runtime(SVG) |
| 6 | Capability Map | AgentCore 能力映射(SVG) |
| 7 | AI verifies AI | 宣称 vs 实测(SVG) |
| 8-9 | Demo | 真跑验证 + 跨会话召回 |
| 10 | Generalization | 同骨架换领域 |
| 11 | Deploy | 一条 cdk deploy 复刻 |
| 12 | Takeaway | 别信宣称,真跑一遍 |

## 4 张 SVG(`diagrams/`)

独立可编辑、零依赖、纯 SVG。也被主 README 引用。

- `fig-four-stages.svg` — 调研→评估→验证→沉淀 四阶段流程
- `fig-architecture.svg` — 浏览器 → API Gateway → relay Lambda → Runtime
- `fig-ai-verifies-ai.svg` — CLAIMED vs VERIFIED 对账
- `fig-capability-map.svg` — Runtime / Memory / Code Interpreter / Skills 能力映射

## 工具 / 风格

- HTML PPT:[lewislulu/html-ppt-skill](https://github.com/lewislulu/html-ppt-skill)(资产已内联到 `assets/`,离线可用)
- 主题:自定义 `assets/themes/algoops.css`(映射 DESIGN.md tokens)
- 字体:Inter + JetBrains Mono(首次加载走 Google Fonts,离线回退系统字体)
