from agent.tools.reproduce import run_in_sandbox


class FakeCIClient:
    """Mimics bedrock_agentcore CodeInterpreter: start/invoke/stop."""
    def __init__(self):
        self.started = False
        self.stopped = False

    def start(self):
        self.started = True

    def invoke(self, name, args):
        assert name == "executeCode"
        assert args["language"] == "python"
        return {"stream": [
            {"result": {"content": [{"type": "text", "text": "accuracy=0.91\n"}]}}
        ]}

    def stop(self):
        self.stopped = True


def test_run_in_sandbox_returns_stdout_and_cleans_up():
    fake = FakeCIClient()
    result = run_in_sandbox("print('accuracy=0.91')", client=fake)
    assert "accuracy=0.91" in result["stdout"]
    assert fake.started is True
    assert fake.stopped is True


def test_run_in_sandbox_stops_on_error():
    class Boom(FakeCIClient):
        def invoke(self, name, args):
            raise RuntimeError("kaboom")
    fake = Boom()
    try:
        run_in_sandbox("print('x')", client=fake)
    except RuntimeError:
        pass
    assert fake.stopped is True  # cleanup still ran
