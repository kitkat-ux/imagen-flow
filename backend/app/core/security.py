import base64
import hashlib
from cryptography.fernet import Fernet

from .config import get_settings


def _derive_key(master: str) -> bytes:
    """Derive 32-byte url-safe base64 key from master string."""
    digest = hashlib.sha256(master.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_value(plain: str) -> bytes:
    key = _derive_key(get_settings().MASTER_KEY)
    return Fernet(key).encrypt(plain.encode("utf-8"))


def decrypt_value(token: bytes) -> str:
    key = _derive_key(get_settings().MASTER_KEY)
    return Fernet(key).decrypt(token).decode("utf-8")
