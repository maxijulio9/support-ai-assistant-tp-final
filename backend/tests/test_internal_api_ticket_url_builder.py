"""Tests unitarios para build_ticket_url.
Es una funcion pura, no necesita mocks."""

from app.modules.internal_api.ticket_url_builder import build_ticket_url


# verifica que arma el enlace con la url base sin barra final
def test_build_ticket_url_with_base_without_trailing_slash():
    assert build_ticket_url("https://example.atlassian.net", "TEST-1") == "https://example.atlassian.net/browse/TEST-1"


# verifica que no duplica la barra cuando la url base termina en barra
def test_build_ticket_url_with_base_with_trailing_slash():
    assert build_ticket_url("https://example.atlassian.net/", "TEST-1") == "https://example.atlassian.net/browse/TEST-1"


# verifica que devuelve none si la key del ticket es nula
def test_build_ticket_url_returns_none_when_ticket_key_is_none():
    assert build_ticket_url("https://example.atlassian.net", None) is None


# verifica que devuelve none si la key del ticket esta vacia o solo tiene espacios
def test_build_ticket_url_returns_none_when_ticket_key_is_blank():
    assert build_ticket_url("https://example.atlassian.net", "") is None
    assert build_ticket_url("https://example.atlassian.net", "   ") is None


# verifica que devuelve none si no hay url base
def test_build_ticket_url_returns_none_when_base_is_missing():
    assert build_ticket_url(None, "TEST-1") is None
    assert build_ticket_url("", "TEST-1") is None


# verifica que no devuelve enlaces con una base que no es https
def test_build_ticket_url_returns_none_when_base_is_not_https():
    assert build_ticket_url("http://example.atlassian.net", "TEST-1") is None
    assert build_ticket_url("javascript:alert(1)", "TEST-1") is None


# verifica que devuelve none si la base no tiene host
def test_build_ticket_url_returns_none_when_base_has_no_host():
    assert build_ticket_url("https://", "TEST-1") is None


# verifica que devuelve none si la base trae credenciales o parametros incrustados
def test_build_ticket_url_returns_none_when_base_has_credentials_or_query():
    assert build_ticket_url("https://user:pass@example.atlassian.net", "TEST-1") is None
    assert build_ticket_url("https://example.atlassian.net/?a=1", "TEST-1") is None


# verifica que devuelve none si la base esta mal formada y no rompe
def test_build_ticket_url_returns_none_when_base_is_malformed():
    assert build_ticket_url("https://[invalid", "TEST-1") is None


# verifica que codifica los caracteres raros de la key para no romper la url
def test_build_ticket_url_encodes_special_characters_in_ticket_key():
    assert build_ticket_url("https://example.atlassian.net", "TEST 1/2") == "https://example.atlassian.net/browse/TEST%201%2F2"