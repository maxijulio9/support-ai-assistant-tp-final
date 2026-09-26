"""Tests unitarios para password_hasher (M9). Corren bcrypt real, sin mocks."""

from app.modules.auth.password_hasher import hash_password, verify_password


def test_hash_password_generates_bcrypt_hash():
    hashed = hash_password("Test1234!")

    assert hashed.startswith("$2b$")
    assert hashed != "Test1234!"


def test_verify_password_with_correct_password():
    hashed = hash_password("Test1234!")

    assert verify_password("Test1234!", hashed) is True


def test_verify_password_with_incorrect_password():
    hashed = hash_password("Test1234!")

    assert verify_password("OtraClave!", hashed) is False


def test_hash_password_generates_different_hash_each_time():
    hashed_1 = hash_password("Test1234!")
    hashed_2 = hash_password("Test1234!")

    assert hashed_1 != hashed_2