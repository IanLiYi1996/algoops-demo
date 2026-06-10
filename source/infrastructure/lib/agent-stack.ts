import * as path from 'path';
import { Aws, CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';

export class AgentStack extends Stack {
  public readonly runtimeArn: string;
  public readonly memoryId: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // SEMANTIC + SUMMARIZATION extraction strategies turn raw conversation
    // events into long-term records. Without a strategy, cross-session recall
    // (the demo's Memory climax) never populates. The namespace must match the
    // one the agent retrieves from (see agent/loader.py RETRIEVAL_NAMESPACE).
    const memory = new agentcore.Memory(this, 'Memory', {
      memoryName: 'research_copilot_memory',
      description: 'Cross-session memory for the research co-pilot',
      expirationDuration: Duration.days(30),
      memoryStrategies: [
        new agentcore.ManagedMemoryStrategy(agentcore.MemoryStrategyType.SEMANTIC, {
          name: 'semantic_facts',
          namespaces: ['research/{actorId}/facts'],
        }),
        // SUMMARIZATION namespaces are per-session — {sessionId} is mandatory.
        new agentcore.ManagedMemoryStrategy(agentcore.MemoryStrategyType.SUMMARIZATION, {
          name: 'session_summaries',
          namespaces: ['research/{actorId}/{sessionId}/summaries'],
        }),
      ],
    });

    const ciRole = new iam.Role(this, 'CodeInterpreterRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    });

    const codeInterpreter = new agentcore.CodeInterpreterCustom(this, 'CodeInterpreter', {
      codeInterpreterCustomName: 'research_copilot_ci',
      description: 'Sandbox for reproducing experiments',
      networkConfiguration: agentcore.CodeInterpreterNetworkConfiguration.usingPublicNetwork(),
      executionRole: ciRole,
    });

    const execRole = new iam.Role(this, 'AgentRuntimeRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        AgentCorePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
              resources: [`arn:aws:ecr:${Aws.REGION}:${Aws.ACCOUNT_ID}:repository/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecr:GetAuthorizationToken'],
              resources: ['*'],
            }),
            // Write/create scoped to the runtime log groups only.
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogStreams',
              ],
              resources: [
                `arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/runtimes/*`,
              ],
            }),
            // DescribeLogGroups is a list operation that does not support
            // resource-level scoping below the account, so it stands alone.
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:DescribeLogGroups'],
              resources: [
                `arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
                'xray:GetSamplingRules',
                'xray:GetSamplingTargets',
              ],
              resources: ['*'],
            }),
            // Memory data plane: events (write/read turns) AND record retrieval
            // (long-term recall). Without the Retrieve/List record actions the
            // cross-session recall hook is denied and recall returns empty.
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock-agentcore:CreateEvent',
                'bedrock-agentcore:GetEvent',
                'bedrock-agentcore:ListEvents',
                'bedrock-agentcore:ListActors',
                'bedrock-agentcore:ListSessions',
                'bedrock-agentcore:RetrieveMemoryRecords',
                'bedrock-agentcore:GetMemoryRecord',
                'bedrock-agentcore:ListMemoryRecords',
              ],
              resources: [memory.memoryArn, `${memory.memoryArn}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock-agentcore:*CodeInterpreter*'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: [
                'arn:aws:bedrock:*::foundation-model/*',
                `arn:aws:bedrock:${Aws.REGION}:${Aws.ACCOUNT_ID}:*`,
              ],
            }),
          ],
        }),
      },
    });

    const artifact = agentcore.AgentRuntimeArtifact.fromAsset(
      path.join(__dirname, '../../agent'),
      { platform: ecr_assets.Platform.LINUX_ARM64, file: 'Dockerfile' },
    );

    const runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: 'research_copilot_runtime',
      agentRuntimeArtifact: artifact,
      executionRole: execRole,
      description: 'Research co-pilot agent runtime',
      environmentVariables: {
        MEMORY_ID: memory.memoryId,
        CODE_INTERPRETER_ID: codeInterpreter.codeInterpreterId,
        AWS_REGION: this.region,
        // Repo-local AlgoOps skills + two huggingface/skills that fit model
        // selection (find best models via leaderboards; manage eval results),
        // proving zero-modification reuse of the community skill ecosystem.
        SKILL_SOURCES: [
          '/app/agent/skills',
          'https://raw.githubusercontent.com/huggingface/skills/main/skills/huggingface-best/SKILL.md',
          'https://raw.githubusercontent.com/huggingface/skills/main/skills/huggingface-community-evals/SKILL.md',
        ].join(','),
      },
    });

    this.runtimeArn = runtime.agentRuntimeArn;
    this.memoryId = memory.memoryId;

    new CfnOutput(this, 'RuntimeArn', { value: runtime.agentRuntimeArn });
    new CfnOutput(this, 'MemoryId', { value: memory.memoryId });
  }
}
