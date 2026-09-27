# M9 AuthModule: hashing y verificacion de contraseñas con bcrypt

import bcrypt


# genera el hash de una contraseña en texto plano, para guardar en app_user.password_hash
def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


# compara una contraseña en texto plano contra el hash guardado en la bd
def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)