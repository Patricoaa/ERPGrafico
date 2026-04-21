"""
Utility de cifrado simétrico para secretos almacenados en JSONField
(ej. API keys de proveedores de terminales de pago).

La clave se deriva de settings.SECRET_KEY. En producción se puede sobreescribir
definiendo TUU_ENCRYPTION_KEY como una clave Fernet válida en el entorno.
"""
from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class CryptoError(Exception):
    """Error genérico al cifrar/descifrar secretos."""


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    raw = getattr(settings, "TUU_ENCRYPTION_KEY", None) or settings.SECRET_KEY
    if isinstance(raw, str):
        raw_bytes = raw.encode("utf-8")
    else:
        raw_bytes = raw

    try:
        return Fernet(raw_bytes)
    except (ValueError, TypeError):
        digest = hashlib.sha256(raw_bytes).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    if plaintext is None:
        raise CryptoError("plaintext no puede ser None")
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(token: str) -> str:
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise CryptoError("Token inválido o clave de cifrado incorrecta") from exc
