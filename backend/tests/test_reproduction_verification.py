import json
from types import SimpleNamespace

import pytest

from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.ticket_analyzer.schemas import ConversationTurn


def build_client(content=None, error=None, captured=None):
    client = LlmClient.__new__(LlmClient)
    client._refresh = lambda: None
    client.model = "test-model"

    def create(**kwargs):
        if captured is not None:
            captured.update(kwargs)
        if error:
            raise error
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    client.client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return client


@pytest.mark.parametrize("verdict", ["falta", "suficiente", "no_aplica"])
def test_returns_each_valid_verdict(verdict):
    client = build_client(content=json.dumps({"verdict": verdict}))
    assert client.verify_reproduction_info("la app se cierra") == verdict


def test_unknown_verdict_defaults_to_suficiente():
    client = build_client(content=json.dumps({"verdict": "otra cosa"}))
    assert client.verify_reproduction_info("la app se cierra") == "suficiente"


def test_model_error_defaults_to_suficiente():
    client = build_client(error=RuntimeError("proveedor caido"))
    assert client.verify_reproduction_info("la app se cierra") == "suficiente"


def test_malformed_json_defaults_to_suficiente():
    client = build_client(content="no es un json")
    assert client.verify_reproduction_info("la app se cierra") == "suficiente"


def test_prompt_includes_message_and_history():
    captured = {}
    client = build_client(content=json.dumps({"verdict": "falta"}), captured=captured)
    history = [ConversationTurn(role="assistant", content="que estabas haciendo?")]
    client.verify_reproduction_info("la app se cierra", history)
    prompt = captured["messages"][0]["content"]
    assert "la app se cierra" in prompt
    assert "assistant: que estabas haciendo?" in prompt
