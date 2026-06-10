"""Single wiring point: build a Strands Agent with Memory + CI + Skills.

Cloud constructors are injectable so the wiring is unit-testable. Defaults
resolve the real Strands / AgentCore objects lazily (imported inside the
factory functions) so importing this module never requires AWS.
"""
import os
from pathlib import Path
from typing import Callable, Optional

from agent.tools.candidate import (
    fetch_candidate as _fetch_candidate,
    list_candidates as _list_candidates,
)

_PROMPT_PATH = Path(__file__).parent / "prompts" / "system.md"
_SKILLS_PATH = Path(__file__).parent / "skills"


def load_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def _build_candidate_tools():
    """Wrap the pure candidate-lookup functions as Strands tools.

    Strands 1.42 rejects bare functions ("unrecognized tool specification") and
    silently drops them, so tools must carry @tool metadata. We keep
    ``candidate.py`` strands-free (unit-testable) and decorate here.
    """
    from strands import tool

    @tool
    def fetch_candidate(model_id: str) -> dict:
        """Fetch a candidate model's CLAIMED spec for the evaluation card.

        Returns claimed metrics, dataset, scenario and caveats. Use this in the
        Survey/Assess stages — the claimed numbers are then re-verified in the
        sandbox.

        Args:
            model_id: A catalog id, e.g. "bge-m3", "sasrec", "bert-tagger".
        """
        return _fetch_candidate(model_id)

    @tool
    def list_candidates() -> list:
        """List the candidate models available for evaluation (id, name, task)."""
        return _list_candidates()

    return [fetch_candidate, list_candidates]


# Retrieval namespaces MUST match the extraction-strategy namespaces declared
# on the Memory resource (infrastructure/lib/agent-stack.ts). {actorId} is
# resolved by the session manager at retrieval time. If these drift apart,
# recall silently returns nothing.
RETRIEVAL_NAMESPACES = (
    # Cross-session: SEMANTIC facts are namespaced by actor only, so a fresh
    # session still recalls papers studied earlier (the Memory climax).
    "research/{actorId}/facts",
    # Per-session SUMMARIZATION ({sessionId} is mandatory for this type).
    "research/{actorId}/{sessionId}/summaries",
)


def _default_session_manager_factory(
    memory_id: str, region: str, session_id: str, actor_id: str
):
    from bedrock_agentcore.memory.integrations.strands.config import (
        AgentCoreMemoryConfig,
        RetrievalConfig,
    )
    from bedrock_agentcore.memory.integrations.strands.session_manager import (
        AgentCoreMemorySessionManager,
    )

    # session_id + actor_id are required by AgentCoreMemoryConfig. A FIXED
    # actor across all booth sessions is what makes cross-session recall work:
    # long-term memory is namespaced per actor, so a fresh session_id still
    # retrieves papers studied in earlier sessions.
    #
    # async_mode=False is deliberate: in async mode the retrieval hook is
    # fire-and-forget, so recalled context is NOT injected before the model
    # generates — recall appears empty. Sync mode injects context in time. The
    # blocking memory I/O is fine here because main.py builds/runs the agent off
    # the event loop (asyncio.to_thread), and booth concurrency is low.
    config = AgentCoreMemoryConfig(
        memory_id=memory_id,
        session_id=session_id,
        actor_id=actor_id,
        async_mode=False,
        retrieval_config={
            ns: RetrievalConfig(top_k=5) for ns in RETRIEVAL_NAMESPACES
        },
    )
    return AgentCoreMemorySessionManager(config, region_name=region)


def _default_ci_tool_factory(region: str, code_interpreter_id: Optional[str] = None):
    from strands_tools.code_interpreter import AgentCoreCodeInterpreter

    # ``identifier`` binds the tool to our CDK-provisioned custom Code
    # Interpreter (public-network egress, so reproductions can pip-install).
    # Without it the tool auto-creates a default sandbox per run.
    return AgentCoreCodeInterpreter(
        region=region, identifier=code_interpreter_id
    ).code_interpreter


def _default_agent_factory(**kwargs):
    from strands import Agent

    return Agent(**kwargs)


DEFAULT_ACTOR_ID = "research_copilot"


def build_agent(
    memory_id: str,
    code_interpreter_region: str,
    session_id: str,
    actor_id: str = DEFAULT_ACTOR_ID,
    code_interpreter_id: Optional[str] = None,
    skill_sources: Optional[list[str]] = None,
    agent_factory: Callable = _default_agent_factory,
    session_manager_factory: Callable = _default_session_manager_factory,
    ci_tool_factory: Callable = _default_ci_tool_factory,
):
    """Build and return a configured Strands Agent for one session.

    A fresh agent is built per session (per runtime invocation) so each
    visitor's conversation maps to its own Memory ``session_id`` while sharing
    one ``actor_id`` — that shared actor is what lets a brand-new session recall
    papers studied earlier (the demo's Memory climax). ``code_interpreter_id``
    binds the sandbox tool to the custom Code Interpreter the CDK stack created.
    """
    from strands.vended_plugins.skills import AgentSkills

    sources = skill_sources if skill_sources is not None else [str(_SKILLS_PATH)]
    skills_plugin = AgentSkills(skills=sources)

    ci_tool = ci_tool_factory(code_interpreter_region, code_interpreter_id)
    session_manager = session_manager_factory(
        memory_id, code_interpreter_region, session_id, actor_id
    )

    return agent_factory(
        system_prompt=load_system_prompt(),
        tools=[*_build_candidate_tools(), ci_tool],
        plugins=[skills_plugin],
        session_manager=session_manager,
    )
