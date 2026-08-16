"""Tests unitarios para el cliente LLM de M4 - LlmClient."""

from unittest.mock import patch, MagicMock
from app.modules.response_generator.llm_client import LlmClient


# verifica que evaluate_confidence devuelve el score que dice el llm
@patch("app.modules.response_generator.llm_client.OpenAI")
def test_evaluate_confidence_returns_score_from_llm(mock_openai_class):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"confidence_score": 0.85}'
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai_class.return_value = mock_client

    client = LlmClient()
    score = client.evaluate_confidence("prompt de prueba")

    assert score == 0.85


# verifica que clampea si el llm devuelve algo fuera de rango
@patch("app.modules.response_generator.llm_client.OpenAI")
def test_evaluate_confidence_clamps_out_of_range_score(mock_openai_class):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"confidence_score": 1.5}'
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai_class.return_value = mock_client

    client = LlmClient()
    score = client.evaluate_confidence("prompt de prueba")

    assert score == 1.0