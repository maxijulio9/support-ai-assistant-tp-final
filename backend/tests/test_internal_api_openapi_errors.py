"""Tests para los errores declarados en el contrato OpenAPI de la API interna."""

from app.main import app


# verifica que el 404 de GET /api/indexing/status esta declarado en el contrato con su modelo de error
def test_indexing_status_declares_404_in_the_contract():
    responses = app.openapi()["paths"]["/api/indexing/status"]["get"]["responses"]

    assert "200" in responses
    assert "404" in responses
    assert responses["404"]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")


# verifica que el modelo de error tiene el campo detail como texto obligatorio
def test_error_response_schema_has_a_required_text_detail():
    schema = app.openapi()["components"]["schemas"]["ErrorResponse"]

    assert schema["properties"]["detail"]["type"] == "string"
    assert "detail" in schema["required"]
