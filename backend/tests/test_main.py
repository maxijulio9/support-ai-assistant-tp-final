"""Test de regresion para app/main.py (TF-164).
Confirma que los routers reales quedan registrados en la app, para que esto
no vuelva a pasar desapercibido como paso con internal_api."""

from app.main import app


def test_internal_api_router_is_registered():
    rutas = [route.path for route in app.routes]
    assert "/api/config/countries" in rutas


def test_auth_router_is_registered():
    rutas = [route.path for route in app.routes]
    assert "/auth/login" in rutas


def test_webhook_router_is_registered():
    rutas = [route.path for route in app.routes]
    assert any("/webhook" in ruta for ruta in rutas)