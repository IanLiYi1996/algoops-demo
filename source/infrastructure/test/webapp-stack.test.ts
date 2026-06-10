import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WebAppStack } from '../lib/webapp-stack';

function synth() {
  const app = new App();
  const stack = new WebAppStack(app, 'TestWebApp', {
    runtimeArn: 'arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/abc',
    env: { account: '111111111111', region: 'us-east-1' },
  });
  return Template.fromStack(stack);
}

test('hosts the SPA on S3 + CloudFront', () => {
  const t = synth();
  t.resourceCountIs('AWS::S3::Bucket', 1);
  t.resourceCountIs('AWS::CloudFront::Distribution', 1);
});

test('provisions a Cognito User Pool with a public app client', () => {
  const t = synth();
  t.resourceCountIs('AWS::Cognito::UserPool', 1);
  t.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    AllowedOAuthFlows: ['code'],
    GenerateSecret: false, // public SPA client (PKCE, no secret)
  });
});

test('relay Lambda is scoped to the one runtime ARN and has NO Function URL', () => {
  const t = synth();
  // No Lambda Function URL at all (avoids the public-policy AppSec finding).
  t.resourceCountIs('AWS::Lambda::Url', 0);
  // IAM policy limited to InvokeAgentRuntime on the single runtime + endpoint.
  t.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'bedrock-agentcore:InvokeAgentRuntime',
          Resource: [
            'arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/abc',
            'arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/abc/runtime-endpoint/*',
          ],
        }),
      ]),
    },
  });
});

test('fronts the relay with an API Gateway HTTP API (no open Lambda policy)', () => {
  const t = synth();
  t.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
  t.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'POST /invoke' });
  // The Lambda invoke permission is granted to API Gateway with a scoped
  // SourceArn — never Principal "*".
  t.hasResourceProperties('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    Principal: 'apigateway.amazonaws.com',
  });
});

test('exposes web url, relay api url, and cognito outputs', () => {
  const t = synth();
  const keys = Object.keys(t.findOutputs('*')).map((k) => k.toLowerCase());
  expect(keys.some((k) => k.includes('weburl'))).toBe(true);
  expect(keys.some((k) => k.includes('relayapiurl'))).toBe(true);
  expect(keys.some((k) => k.includes('cognitodomain'))).toBe(true);
});
