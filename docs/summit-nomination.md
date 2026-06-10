# FY26 Summit Builder Lab (AgentCore) — 提名内容

> 填入 Quip 提名表的一行。各列对应 Demo Owner 行动项（B/C/D/F/G…）。
> 架构图见 `docs/architecture.png`（draw.io · AWS 官方图标 · AgentCore 高亮；源文件 `architecture_diagram` drawio session）。
>
> **定位**：AlgoOps（算法效能智能体）——**赋能业务，提效产品与算法**。以「AI 验证 AI」的方式让 Agent 自主评估、
> 真跑验证、迭代企业内部业务的算法模型；以搜索 / 推荐 / 标签系统为业务落点，弱化具体行业，突出通用算法工程提效能力。

---

## A · Demo 名称（≤10 字）
**算法效能智能体**
（英文/品牌名：AlgoOps）

> 注：提名表第 14 行已有「自主科研Agent」(Synapse, weiyihao)，主打 **Gateway + Runtime + MCP/GPU 编排**的科研项目编排。
> 本 Demo 走 **不同的 AgentCore 服务组合与业务落点**：核心叙事是 **「AI 验证 AI」**——Agent 赋能企业算法团队，自主验证/迭代**企业内部业务**（搜索/推荐/标签）的算法模型，
> 高潮是 **Code Interpreter 真跑 benchmark 验证 + Memory 跨会话沉淀评估结论**，与 Synapse 不重复。

## B · Demo 简介（≤150 字，含 AgentCore/Bedrock 如何实现、用了哪些 service、区别在哪）

> AlgoOps（算法效能智能体）赋能业务、提效产品与算法，以「AI 验证 AI」让 Agent 替团队评估、真跑验证、迭代内部业务的算法模型。基于 Amazon Bedrock AgentCore（Strands Agents SDK），按"调研 → 评估 → 验证 → 沉淀"协同——以企业**搜索/推荐/标签**系统的模型选型为例，Agent 读源材料产出评估卡，并在 **AgentCore Code Interpreter** 沙箱真跑 benchmark（Recall@K / NDCG / F1）验证宣称指标，根治"离线漂亮、上线翻车"；历次结论由 **AgentCore Memory**（SEMANTIC + SUMMARIZATION）跨会话记忆召回，不重复踩坑；评估方法论沉淀为可复用 **Skills**。一条 `cdk deploy` 起全栈，GitHub + Gitee 可复刻。

## C · AgentCore Services（最多 3 个，按演示重点排序，不要默认 Runtime 在前）

**AgentCore Memory · AgentCore Code Interpreter · AgentCore Runtime**

- **Memory（高潮 1）**：算法团队知识沉淀——跨会话记住「搜索/推荐/标签项目评估过哪些方案、结论/坑是什么」，SEMANTIC + SUMMARIZATION 抽取，namespace 化按团队/项目召回。
- **Code Interpreter（高潮 2）**：选型验证——隔离沙箱真跑 benchmark/消融（Recall@K、NDCG、标签 F1 等），返回真实数值与图表，上线前先验真。
- **Runtime（承载底座）**：Serverless ARM64 microVM，按会话隔离，托管 Strands Agent。
- *（加分，可插拔，不计入 3 个主线）* Observability（评估全链路可审计）、Gateway（接企业内部特征/向量库/A-B 平台等数据工具）、Browser、Identity。

## D · 架构图
`docs/architecture.png`（AgentCore 橙色高亮；三主线服务 + Skills 在 Runtime 内；账户安全的 Cognito→API Gateway→relay Lambda 边缘层；可复刻 CLI 旁路）。

## E · Content Link
- 项目说明：`README.md`
- 架构图：`docs/architecture.png`

## F · GitHub Link
`https://github.com/IanLiYi1996/algoops-demo`（Gitee 镜像同步）

## G · Live Demo
**YES** — 现场可跑：Web 控制台（登录 → 输入要为「搜索/推荐/标签」选型的方案 → 三块仪表盘实时点亮：评估流水线 / Memory 召回历史结论 / Sandbox 真跑 benchmark）+ CLI `demo.sh` 旁路（复刻演示）。

## 其他列
| 列 | 内容 |
|---|---|
| Nominator Login | ianleely |
| Team | IVT |
| Key AWS Product/Service | Amazon Bedrock AgentCore (Memory / Code Interpreter / Runtime / Observability), Strands Agents SDK, Cognito, API Gateway, Lambda, CloudFront, CDK |
| LLM Model | Claude（Nova / DeepSeek 可切换） |
| 特殊设备需求 | 无特殊要求； |
| 时间安排 | 待定 |

---

## 演示脚本（展台 ~2.5 分钟，双高潮）

场景设定：电商/内容平台的**推荐算法团队**要评估是否引入一个新的召回/排序模型（同一套流程也适用于**搜索**的相关性模型、**标签系统**的多标签分类模型）。

1. **Evaluate + Digest**：观众给出候选方案（arXiv id / 开源 repo / 内部 wiki）→ Agent 抓取源材料、激活评估 skill、产出结构化「选型评估卡」（数据/指标/成本/风险），并把关键结论写入 Memory。
2. **🎬 高潮 1 · Memory 跨会话沉淀召回**：操作员**新开一个会话**，问「我们推荐团队之前评估过哪些排序模型？结论和坑是什么？」——Agent 从 Memory 召回本会话从未出现过的历史评估结论与踩坑。Memory 面板亮起召回记录 + 相似度。**价值：搜索/推荐/标签团队的算法知识不流失、不重复踩坑。**
3. **🎬 高潮 2 · Code Interpreter 真跑验证**：观众说「别看它宣称的指标，帮我真跑验证」——Agent 激活相关 skill，写最小 benchmark，在 **Code Interpreter** 沙箱用样例数据真跑，返回 **Recall@K / NDCG（或标签 F1）真实数字 + 图**，与宣称值对比。Sandbox 面板流式打印 stdout。**价值：上线前先验真，避免「离线漂亮、线上翻车」。**
4. **沉淀**：新结论写回 Memory → 下次选型直接复用，团队知识复利。

## 与「真实企业算法业务场景 + 弱化行业 + 突出通用性」的呼应
- **真实算法业务**：搜索相关性、推荐召回/排序、内容标签——技术选型 / PoC 验证 / benchmark 复现是这些团队每周都在做、且成本高的工程活动。
- **弱化行业**：搜索/推荐/标签是跨电商、内容、广告、社交等多行业的通用算法能力，不绑定单一垂直行业。
- **通用性**：换掉 `tools/` + `skills/` + system prompt，同一套 Runtime+Memory+CI+Skills 骨架即可在 **搜索相关性 ↔ 推荐排序 ↔ 标签分类** 三个场景间切换，**零基础设施改动**；再换一组 skill 还能扩展到风控、NLP 等其它算法域。
