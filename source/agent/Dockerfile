# AgentCore Runtime requires linux/arm64.
FROM --platform=linux/arm64 python:3.12-slim

WORKDIR /app

# Install uv for fast, reproducible installs.
RUN pip install --no-cache-dir uv

# Install dependencies from the lockfile for deterministic, reproducible
# builds (no fresh PyPI resolution at image-build time). pyproject + uv.lock
# come first for layer caching; --no-dev skips test-only deps.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code.
COPY agent ./agent

# uv sync installs into .venv; put it on PATH so `python` resolves deps.
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080
CMD ["python", "-m", "agent.main"]
