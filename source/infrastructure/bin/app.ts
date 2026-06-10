#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { AgentStack } from '../lib/agent-stack';
import { WebAppStack } from '../lib/webapp-stack';

const app = new App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const agent = new AgentStack(app, 'ResearchCopilotAgent', { env });

// CloudFront + Cognito Hosted UI + streaming relay Lambda, all in one stack
// (they form a DAG around the CloudFront domain; separate stacks would cycle).
new WebAppStack(app, 'ResearchCopilotWebApp', {
  env,
  runtimeArn: agent.runtimeArn,
});
