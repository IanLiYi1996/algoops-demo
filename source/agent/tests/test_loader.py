from pathlib import Path

from agent.loader import build_agent, load_system_prompt

SKILLS_DIR = Path(__file__).parent.parent / "agent" / "skills"


def test_load_system_prompt_nonempty():
    prompt = load_system_prompt()
    assert "algoops" in prompt.lower()
    assert "never claim a metric you did not run" in prompt.lower()


def test_build_agent_wires_skills_and_tools():
    captured = {}

    def fake_agent_factory(**kwargs):
        captured.update(kwargs)
        return object()  # stand-in Agent

    def fake_session_manager_factory(memory_id, region, session_id, actor_id):
        captured["memory_id"] = memory_id
        captured["sm_session_id"] = session_id
        captured["sm_actor_id"] = actor_id
        return f"session-manager:{memory_id}:{session_id}:{actor_id}"

    def fake_ci_tool_factory(region, code_interpreter_id=None):
        captured["ci_region"] = region
        captured["ci_id"] = code_interpreter_id
        return "ci-tool"

    build_agent(
        memory_id="mem-123",
        code_interpreter_region="us-west-2",
        session_id="sess-abc",
        code_interpreter_id="ci-xyz",
        skill_sources=[str(SKILLS_DIR)],
        agent_factory=fake_agent_factory,
        session_manager_factory=fake_session_manager_factory,
        ci_tool_factory=fake_ci_tool_factory,
    )

    assert captured["memory_id"] == "mem-123"
    assert captured["ci_region"] == "us-west-2"
    assert captured["ci_id"] == "ci-xyz"
    assert captured["sm_session_id"] == "sess-abc"
    assert captured["sm_actor_id"] == "research_copilot"  # DEFAULT_ACTOR_ID
    assert captured["session_manager"] == "session-manager:mem-123:sess-abc:research_copilot"
    assert "ci-tool" in captured["tools"]
    # three tools: CI tool + the two @tool-wrapped candidate tools
    assert len(captured["tools"]) == 3
    names = {
        getattr(t, "tool_name", getattr(t, "__name__", ""))
        for t in captured["tools"]
        if t != "ci-tool"
    }
    assert {"fetch_candidate", "list_candidates"} <= names
    # an AgentSkills plugin is registered
    assert any(p.__class__.__name__ == "AgentSkills" for p in captured["plugins"])
    # system prompt is passed
    assert "algoops" in captured["system_prompt"].lower()
