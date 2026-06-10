# AlgoOps（算法效能智能体）· Builder Demo

让 Agent 以「**AI 验证 AI**」替团队做内部业务的**模型选型**——以企业
**搜索 / 推荐 / 标签**系统为例,按「**调研 → 评估 → 验证 → 沉淀**」协同:读源材料
产出**评估卡**,在 **AgentCore Code Interpreter** 沙箱里**真跑 benchmark**
(`Recall@K` / `NDCG@K` / `F1`)验证宣称指标,根治"离线漂亮、上线翻车"。历次选型结论
由 **AgentCore Memory**(SEMANTIC + SUMMARIZATION)跨会话记忆召回,不重复踩坑;评估
方法论沉淀为可复用 **Skills**。一条 `cdk deploy` 起全栈,GitHub + Gitee 可复刻。

A real, CDK-deployable demo on Amazon Bedrock AgentCore (Strands Agents SDK).

## What it shows

| Stage | Service | Pain point it kills |
|---|---|---|
| Deploy | AgentCore Runtime | serverless ARM64 microVM |
| 沉淀 Persist | AgentCore Memory | 🔁 repeating the same model-selection pitfalls |
| 评估 Assess | Strands AgentSkills + huggingface/skills | 🎲 no repeatable eval methodology |
| 验证 Verify | AgentCore Code Interpreter | 🤡 "looks great offline, breaks in production" |

## Deploy (one command)

```bash
cd source/infrastructure
npm install
npx cdk deploy --all          # builds ARM64 image → ECR; provisions everything
# outputs: ResearchCopilotWebApp.WebUrl, ResearchCopilotAgent.RuntimeArn
```

## Run the booth demo

```bash
export RUNTIME_ARN=<RuntimeArn output>
./scripts/seed.sh             # pre-seed Memory with a few selection conclusions
./scripts/demo.sh "Evaluate candidate model bge-m3: produce its evaluation card and store the conclusion." booth-1
```

Open the `WebUrl` for the live 3-tile console (Evaluation card · Memory · Sandbox).

## Teardown

```bash
cd source/infrastructure && npx cdk destroy --all
```

## Prerequisites

- AWS account in an AgentCore-available region
- Bedrock model access (Claude) enabled
- Node 20+, AWS CDK v2, Docker (ARM64 build), Python 3.12 + uv

## Generalization

Swap `source/agent/agent/tools/`, `source/agent/agent/skills/`, and
`prompts/system.md` and the same Runtime + Memory + CI + Skills skeleton becomes a
finance / bio / ops agent — no infra changes. See the root README's
generalization table.
