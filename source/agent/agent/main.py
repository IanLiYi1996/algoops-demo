"""AgentCore Runtime HTTP shell. No business logic lives here."""
import asyncio
import json
import os

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

from agent.loader import build_agent

app = FastAPI(title="ResearchCopilot", version="0.1.0")

# AgentCore injects the runtime session id as this header on every invocation.
SESSION_HEADER = "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id"

# One Strands agent per session id. Memory namespaces by session_id, so each
# visitor gets isolated turn history while a shared actor enables cross-session
# recall (see loader.build_agent).
_AGENTS: dict[str, object] = {}


def _skill_sources() -> list[str] | None:
    """Skill sources from env: comma-separated dirs and/or https SKILL.md URLs.

    Unset → loader default (repo-local skills dir only). The CDK agent-stack
    sets SKILL_SOURCES to include both the bundled skills dir and a couple of
    huggingface/skills raw SKILL.md URLs so the demo shows external skill reuse.
    """
    raw = os.environ.get("SKILL_SOURCES", "").strip()
    if not raw:
        return None
    return [s.strip() for s in raw.split(",") if s.strip()]


async def get_agent(session_id: str):
    """Build (off the event loop) and cache one agent per session id.

    Overridable in tests. ``build_agent`` does blocking AWS setup, so it runs
    in a worker thread to avoid stalling the asyncio loop.
    """
    agent = _AGENTS.get(session_id)
    if agent is None:
        agent = await asyncio.to_thread(
            build_agent,
            memory_id=os.environ["MEMORY_ID"],
            code_interpreter_region=os.environ.get("AWS_REGION", "us-west-2"),
            session_id=session_id,
            code_interpreter_id=os.environ.get("CODE_INTERPRETER_ID") or None,
            skill_sources=_skill_sources(),
        )
        _AGENTS[session_id] = agent
    return agent


@app.get("/ping")
def ping():
    return {"status": "healthy"}


@app.post("/invocations")
async def invocations(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    # Prefer the platform-injected header; fall back to a body field for local
    # runs, then a constant so a missing id never crashes the request.
    session_id = (
        request.headers.get(SESSION_HEADER)
        or body.get("session_id")
        or "local-session"
    )

    async def event_stream():
        agent = await get_agent(session_id)
        async for event in agent.stream_async(prompt):
            chunk = event.get("data") if isinstance(event, dict) else str(event)
            if chunk:
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
