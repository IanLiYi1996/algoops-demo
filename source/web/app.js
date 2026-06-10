/**
 * AlgoOps（算法效能智能体）— booth console.
 *
 * Auth: Cognito Hosted UI, Authorization-Code + PKCE (public SPA client, no
 * secret). We exchange the code for tokens, then call the relay Lambda with the
 * access token as a Bearer header. The relay verifies the JWT, invokes
 * AgentCore server-side, and streams SSE back — which we render into the
 * console transcript and the three instrument tiles.
 */

let CFG = null;
let ACCESS_TOKEN = null;

const $ = (id) => document.getElementById(id);

/* ───────────────────────── PKCE helpers ───────────────────────── */
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
}
function randomString(len = 64) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return b64url(a).slice(0, len);
}

async function beginLogin() {
  const verifier = randomString(64);
  sessionStorage.setItem('pkce_verifier', verifier);
  const challenge = b64url(await sha256(verifier));
  const u = new URL(CFG.cognitoDomain + '/oauth2/authorize');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', CFG.userPoolClientId);
  u.searchParams.set('redirect_uri', CFG.redirectUri);
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('code_challenge', challenge);
  location.assign(u.toString());
}

async function exchangeCode(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CFG.userPoolClientId,
    code,
    redirect_uri: CFG.redirectUri,
    code_verifier: verifier || '',
  });
  const r = await fetch(CFG.cognitoDomain + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('token exchange failed: ' + r.status);
  return r.json(); // { access_token, id_token, ... }
}

function parseJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return {}; }
}

function logout() {
  sessionStorage.clear();
  const u = new URL(CFG.cognitoDomain + '/logout');
  u.searchParams.set('client_id', CFG.userPoolClientId);
  u.searchParams.set('logout_uri', CFG.redirectUri);
  location.assign(u.toString());
}

/* ───────────────────────── UI: tiles + transcript ───────────────────────── */
const TILES = ['pipeline', 'memory', 'sandbox'];
function setTile(name, hot) {
  const el = $('tile-' + name);
  el.classList.toggle('hot', hot);
  el.querySelector('.tile-led').textContent = hot ? 'LIVE' : 'IDLE';
}
function resetTiles() {
  TILES.forEach((t) => { $(t).innerHTML = ''; setTile(t, false); });
}
function routeToTile(text) {
  // Heuristic routing of streamed text into the relevant instrument.
  const skill = text.match(/activated skill[:\s]*([a-z0-9-]+)/i);
  if (skill) {
    appendTile('pipeline', '');
    $('pipeline').insertAdjacentHTML('beforeend',
      `<span class="skill-chip">🧩 ${skill[1]}</span>`);
    setTile('pipeline', true);
    return;
  }
  if (/from (my )?memory|prior (session|selection)|already evaluated|recall|remember|conclusion|namespace/i.test(text)) {
    appendTile('memory', text); setTile('memory', true); return;
  }
  if (/recall@|ndcg|f1|verified|benchmark|sandbox|precision|=\s*0?\.\d|stdout/i.test(text)) {
    appendTile('sandbox', text); setTile('sandbox', true); return;
  }
  appendTile('pipeline', text); setTile('pipeline', true);
}
function appendTile(name, text) {
  const el = $(name);
  el.appendChild(document.createTextNode(text));
  el.scrollTop = el.scrollHeight;
}

let agentBubble = null;
function startAgentMessage() {
  const wrap = document.createElement('div');
  wrap.className = 'msg agent';
  wrap.innerHTML = '<div class="role">◆ agent</div><div class="bubble cursor"></div>';
  $('transcript').appendChild(wrap);
  agentBubble = wrap.querySelector('.bubble');
  $('transcript').scrollTop = $('transcript').scrollHeight;
}
function appendAgent(text) {
  if (!agentBubble) startAgentMessage();
  agentBubble.appendChild(document.createTextNode(text));
  $('transcript').scrollTop = $('transcript').scrollHeight;
}
function endAgentMessage() {
  if (agentBubble) agentBubble.classList.remove('cursor');
  agentBubble = null;
}
function addUserMessage(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg user boot';
  wrap.innerHTML = '<div class="role">you ◆</div><div class="bubble"></div>';
  wrap.querySelector('.bubble').textContent = text;
  $('transcript').appendChild(wrap);
  $('transcript').scrollTop = $('transcript').scrollHeight;
}

/* ───────────────────────── Invoke (buffered via API Gateway) ─────────────────────────
 * API Gateway + Lambda proxy doesn't stream, so the relay returns the full
 * answer as one {text} JSON. We show a "working" pulse, then reveal the answer
 * and ignite the relevant tiles once it lands. To keep the booth feel lively,
 * the final text is typed into the transcript with a short cadence.
 */
async function run() {
  const prompt = $('prompt').value.trim();
  if (!prompt) return;
  const sessionId = $('session').value.trim() || 'booth-1';
  $('run').disabled = true;
  $('conn').textContent = 'AGENT WORKING…';
  $('led')?.classList.add('busy');
  resetTiles();
  addUserMessage(prompt);
  $('prompt').value = '';
  startAgentMessage();
  appendAgent('thinking');
  const dots = setInterval(() => appendAgent('.'), 700);

  try {
    const resp = await fetch(CFG.relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + ACCESS_TOKEN,
      },
      body: JSON.stringify({ prompt, session_id: sessionId }),
    });
    clearInterval(dots);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'relay error ' + resp.status);

    const full = data.text || '(no response)';
    // Reset the bubble (drop the "thinking…" placeholder) and type the answer.
    agentBubble.textContent = '';
    await typeOut(full);
    // Route the whole answer through the tiles so the instruments light up.
    routeToTile(full);
  } catch (e) {
    clearInterval(dots);
    if (agentBubble) agentBubble.textContent = '';
    appendAgent('⚠ ' + e.message);
  } finally {
    endAgentMessage();
    $('run').disabled = false;
    $('conn').textContent = 'LINK ACTIVE';
    $('led')?.classList.remove('busy');
  }
}

// Type text into the agent bubble in small chunks for a live cadence.
async function typeOut(text) {
  const CHUNK = 4;
  for (let i = 0; i < text.length; i += CHUNK) {
    appendAgent(text.slice(i, i + CHUNK));
    if (i % 80 === 0) await new Promise((r) => setTimeout(r, 8));
  }
}

/* ───────────────────────── Wiring ───────────────────────── */
function enterApp(claims) {
  $('gate').style.display = 'none';
  $('app').classList.add('live');
  $('who').innerHTML = 'OPERATOR <b>' + (claims.email || claims.username || claims.sub?.slice(0, 8) || 'guest') + '</b>';
  $('run').onclick = run;
  $('logout').onclick = logout;
  $('prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run();
  });
  $('presets').addEventListener('click', (e) => {
    const q = e.target?.dataset?.q;
    if (q) { $('prompt').value = q; $('prompt').focus(); }
  });
  $('newsess').onclick = () => {
    $('session').value = 'booth-' + Math.floor(Math.random() * 9000 + 1000);
  };
}

async function init() {
  CFG = await (await fetch('./config.json')).json();
  $('login').onclick = beginLogin;

  // Returning from Hosted UI with ?code=…
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const saved = sessionStorage.getItem('access_token');

  if (code) {
    $('gate-state').textContent = 'AUTH: EXCHANGING…';
    try {
      const tok = await exchangeCode(code);
      ACCESS_TOKEN = tok.access_token;
      sessionStorage.setItem('access_token', tok.access_token);
      history.replaceState({}, '', location.pathname); // strip ?code
      enterApp(parseJwt(tok.id_token || tok.access_token));
    } catch (e) {
      $('gate-state').textContent = 'AUTH: FAILED — ' + e.message;
    }
  } else if (saved) {
    ACCESS_TOKEN = saved;
    enterApp(parseJwt(saved));
  }
}

init().catch((e) => {
  const gs = document.getElementById('gate-state');
  if (gs) gs.textContent = 'INIT ERROR: ' + e.message;
});
