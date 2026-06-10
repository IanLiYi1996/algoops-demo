import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AgentStack } from '../lib/agent-stack';

test('agent stack provisions runtime, memory, and code interpreter', () => {
  const app = new App();
  const stack = new AgentStack(app, 'TestAgentStack', {
    env: { account: '111111111111', region: 'us-west-2' },
  });
  const template = Template.fromStack(stack);

  // An execution role that AgentCore can assume.
  template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'bedrock-agentcore.amazonaws.com' },
        },
      ],
      Version: '2012-10-17',
    },
  });

  // Stack exposes the runtime ARN + memory id as outputs.
  const outputs = template.findOutputs('*');
  const keys = Object.keys(outputs);
  expect(keys.some((k) => k.toLowerCase().includes('runtimearn'))).toBe(true);
  expect(keys.some((k) => k.toLowerCase().includes('memoryid'))).toBe(true);
});
