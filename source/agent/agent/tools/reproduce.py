"""Run a Python snippet in an AgentCore Code Interpreter sandbox.

The client is injected so unit tests can pass a fake. In production the
caller passes a real
``bedrock_agentcore.tools.code_interpreter_client.CodeInterpreter`` instance.
"""
from typing import Any, Optional


def _make_default_client(region: str):
    from bedrock_agentcore.tools.code_interpreter_client import CodeInterpreter
    return CodeInterpreter(region)


def run_in_sandbox(
    code: str,
    client: Optional[Any] = None,
    region: str = "us-west-2",
) -> dict:
    """Execute ``code`` in the sandbox; return {"stdout": str}.

    Always stops the session, even on error.
    """
    if client is None:
        client = _make_default_client(region)
    client.start()
    try:
        response = client.invoke("executeCode", {"language": "python", "code": code})
        chunks = []
        for event in response.get("stream", []):
            result = event.get("result", {})
            for item in result.get("content", []):
                if item.get("type") == "text":
                    chunks.append(item["text"])
        return {"stdout": "".join(chunks)}
    finally:
        client.stop()
