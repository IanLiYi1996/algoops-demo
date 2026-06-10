/**
 * Browser → AgentCore relay (API Gateway HTTP API, buffered proxy).
 *
 * Architecture (matches the booth-proven data-agent pattern):
 *   browser → CloudFront /api/* → API Gateway HTTP API ($default) → this Lambda
 * The browser cannot call AgentCore directly (CORS-less + streaming-only), and
 * this account's SCP blocks public Lambda Function URLs — so the front door is
 * an API Gateway HTTP API (publicly invokable, returns CORS) and auth is the
 * Cognito JWT check done HERE in the handler (no API GW authorizer).
 *
 * API Gateway + Lambda proxy does not stream, so we BUFFER: invoke the runtime,
 * collect the full SSE body, concatenate the text deltas, and return one JSON
 * payload the SPA renders at once.
 */
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const REGION = process.env.AWS_REGION || 'us-east-1';
const RUNTIME_ARN = process.env.RUNTIME_ARN;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Verify Cognito access tokens issued by our User Pool. clientId is null (any
// app client of this pool is accepted) — only our pool can mint tokens that
// pass issuer + signature verification, sufficient for the demo.
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.USER_POOL_CLIENT_ID || null,
});

const client = new BedrockAgentCoreClient({ region: REGION });

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function reply(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj),
  };
}

/** Pad/normalize a session id to AgentCore's >=33 char requirement. */
function normalizeSessionId(raw) {
  let s = (raw || 'web-session').replace(/[^a-zA-Z0-9_-]/g, '');
  while (s.length < 33) s += '0';
  return s;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // --- Auth: verify the Cognito JWT. ---
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token) return reply(401, { error: 'Missing bearer token' });
  let claims;
  try {
    claims = await verifier.verify(token);
  } catch (e) {
    return reply(401, { error: 'Invalid token: ' + e.message });
  }

  // --- Parse body. ---
  let body = {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    body = JSON.parse(raw || '{}');
  } catch {
    return reply(400, { error: 'Invalid JSON body' });
  }
  const prompt = body.prompt || '';
  // Bind the AgentCore session to the authenticated user so each visitor gets
  // their own short-term history; the agent's fixed actor still enables recall.
  const sessionId = normalizeSessionId(body.session_id || claims.sub);

  // --- Invoke the runtime and buffer the full SSE response. ---
  try {
    const resp = await client.send(
      new InvokeAgentRuntimeCommand({
        agentRuntimeArn: RUNTIME_ARN,
        runtimeSessionId: sessionId,
        contentType: 'application/json',
        payload: new TextEncoder().encode(
          JSON.stringify({ prompt, session_id: sessionId }),
        ),
      }),
    );

    const decoder = new TextDecoder();
    let raw = '';
    for await (const chunk of resp.response) raw += decoder.decode(chunk, { stream: true });

    // The agent emits SSE lines: `data: {"text": "..."}`. Concatenate the
    // deltas into the final answer; ignore the [DONE] sentinel.
    let text = '';
    for (const line of raw.split('\n')) {
      const m = line.match(/^data:\s*(.*)$/);
      if (!m || m[1] === '[DONE]') continue;
      try {
        const o = JSON.parse(m[1]);
        if (o.text) text += o.text;
        else if (o.error) text += `\n⚠ ${o.error}`;
      } catch {
        /* non-JSON keepalive line — ignore */
      }
    }
    return reply(200, { text, sessionId });
  } catch (e) {
    return reply(502, { error: e.message });
  }
};
