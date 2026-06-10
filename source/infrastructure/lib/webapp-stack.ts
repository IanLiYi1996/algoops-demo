import * as path from 'path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, CorsHttpMethod, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export interface WebAppStackProps extends StackProps {
  readonly runtimeArn: string;
}

/**
 * The browser-facing tier: a CloudFront-hosted SPA, a Cognito User Pool with
 * Hosted UI for login, and a relay Lambda fronted by an **API Gateway HTTP
 * API**.
 *
 * Why API Gateway (not a Lambda Function URL): the browser cannot call
 * AgentCore directly (its endpoint is CORS-less and streaming-only), and this
 * account's SCP blocks public Lambda Function URLs — and a public Function URL
 * also trips the "Lambda with open policy" AppSec finding. An HTTP API is
 * publicly invokable, returns CORS headers, and needs no open Lambda policy.
 * Auth is the Cognito JWT check inside the relay handler (no API GW authorizer,
 * matching the booth-proven data-agent pattern). API GW + Lambda proxy buffers
 * (no SSE), so the relay returns the full answer in one JSON response.
 */
export class WebAppStack extends Stack {
  constructor(scope: Construct, id: string, props: WebAppStackProps) {
    super(scope, id, props);

    // --- Static SPA hosting on S3 + CloudFront ---
    const bucket = new s3.Bucket(this, 'WebBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
    });
    const webUrl = `https://${distribution.distributionDomainName}`;

    // --- Relay Lambda (buffered; no Function URL → no open policy) ---
    const relay = new NodejsFunction(this, 'RelayFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/relay/index.mjs'),
      handler: 'handler',
      timeout: Duration.minutes(5),
      memorySize: 512,
      bundling: {
        format: 'esm' as any,
        nodeModules: ['@aws-sdk/client-bedrock-agentcore', 'aws-jwt-verify'],
        banner:
          "import{createRequire}from'module';const require=createRequire(import.meta.url);",
      },
      environment: {
        RUNTIME_ARN: props.runtimeArn,
        ALLOWED_ORIGIN: webUrl,
        // USER_POOL_ID injected below once the pool exists.
      },
    });
    relay.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeAgentRuntime'],
        // InvokeAgentRuntime targets the endpoint sub-resource
        // (…/runtime/<id>/runtime-endpoint/DEFAULT), not just the bare runtime ARN.
        resources: [props.runtimeArn, `${props.runtimeArn}/runtime-endpoint/*`],
      }),
    );

    // --- API Gateway HTTP API → relay (the public, CORS-enabled front door) ---
    const httpApi = new HttpApi(this, 'RelayApi', {
      corsPreflight: {
        allowOrigins: [webUrl],
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
    });
    httpApi.addRoutes({
      path: '/invoke',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('RelayIntegration', relay),
    });
    // HttpLambdaIntegration grants apigateway.amazonaws.com a SourceArn-scoped
    // invoke permission — NOT an open ("*") policy.

    // --- Cognito User Pool + Hosted UI ---
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'research_copilot_users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const client = userPool.addClient('WebClient', {
      userPoolClientName: 'research_copilot_web',
      generateSecret: false, // public SPA client (PKCE)
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [webUrl, 'http://localhost:5173'],
        logoutUrls: [webUrl, 'http://localhost:5173'],
      },
    });

    userPool.addDomain('HostedUiDomain', {
      cognitoDomain: { domainPrefix: `research-copilot-${this.account}` },
    });
    const cognitoDomain = `https://research-copilot-${this.account}.auth.${this.region}.amazoncognito.com`;

    // Inject the User Pool id (issuer) for JWT verification. Only USER_POOL_ID
    // is needed; injecting the client id would create a relay→client→… cycle.
    relay.addEnvironment('USER_POOL_ID', userPool.userPoolId);

    // --- Front-end runtime config (read by the SPA at load) ---
    const config = {
      relayUrl: httpApi.apiEndpoint + '/invoke',
      region: this.region,
      userPoolClientId: client.userPoolClientId,
      cognitoDomain,
      redirectUri: webUrl,
    };

    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../web')),
        s3deploy.Source.jsonData('config.json', config),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'WebUrl', { value: webUrl });
    new CfnOutput(this, 'RelayApiUrl', { value: httpApi.apiEndpoint + '/invoke' });
    new CfnOutput(this, 'CognitoDomain', { value: cognitoDomain });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
  }
}
