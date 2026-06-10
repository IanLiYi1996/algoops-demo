from fastapi.testclient import TestClient

import agent.main as main


def test_ping():
    client = TestClient(main.app)
    resp = client.get("/ping")
    assert resp.status_code == 200
    assert resp.json() == {"status": "healthy"}


def test_invocations_streams_agent_events(monkeypatch):
    seen = {}

    class FakeAgent:
        def stream_async(self, prompt):
            async def gen():
                yield {"data": "hello "}
                yield {"data": "world"}
            return gen()

    async def fake_get_agent(session_id):
        seen["session_id"] = session_id
        return FakeAgent()

    monkeypatch.setattr(main, "get_agent", fake_get_agent)
    client = TestClient(main.app)
    resp = client.post(
        "/invocations",
        json={"prompt": "hi"},
        headers={main.SESSION_HEADER: "header-session-123"},
    )
    assert resp.status_code == 200
    body = resp.text
    assert "hello " in body
    assert "world" in body
    # the runtime session header is threaded through to get_agent
    assert seen["session_id"] == "header-session-123"


def test_invocations_falls_back_to_body_session_id(monkeypatch):
    seen = {}

    class FakeAgent:
        def stream_async(self, prompt):
            async def gen():
                yield {"data": "ok"}
            return gen()

    async def fake_get_agent(session_id):
        seen["session_id"] = session_id
        return FakeAgent()

    monkeypatch.setattr(main, "get_agent", fake_get_agent)
    client = TestClient(main.app)
    resp = client.post("/invocations", json={"prompt": "hi", "session_id": "body-s1"})
    assert resp.status_code == 200
    assert seen["session_id"] == "body-s1"
