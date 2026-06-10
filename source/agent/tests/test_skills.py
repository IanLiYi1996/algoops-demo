from pathlib import Path

from strands.vended_plugins.skills import AgentSkills

SKILLS_DIR = Path(__file__).parent.parent / "agent" / "skills"


def test_repo_local_skills_load_strict():
    # strict=True raises on any malformed SKILL.md
    plugin = AgentSkills(skills=[str(SKILLS_DIR)], strict=True)
    names = {s.name for s in plugin.get_available_skills()}
    assert {"model-eval-card", "benchmark-recsys"} <= names
