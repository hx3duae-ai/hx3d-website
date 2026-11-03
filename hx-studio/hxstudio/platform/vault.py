"""Encrypted secret vault (Fernet / AES-128-CBC + HMAC from `cryptography`).
Key: env HX_VAULT_KEY (recommended) or data/platform/.vault.key (created with owner-only permissions on first use).
Secrets are write-only from the API: they are never returned, only a fingerprint (last 4 chars) is shown."""
from __future__ import annotations
import base64, hashlib, os, stat, time
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken
from . import store
KEYFILE = store.PDIR / ".vault.key"


def _key() -> bytes:
    env = os.environ.get("HX_VAULT_KEY")
    if env: return env.encode()
    if not KEYFILE.exists():
        KEYFILE.write_bytes(Fernet.generate_key())
        try: os.chmod(KEYFILE, stat.S_IRUSR | stat.S_IWUSR)
        except Exception: pass
    return KEYFILE.read_bytes().strip()


def _f() -> Fernet: return Fernet(_key())


def put(name: str, value: str):
    if not value or len(value) > 4096: raise ValueError("secret is empty or too long")
    token = _f().encrypt(value.encode()).decode()
    fp = value[-4:] if len(value) >= 8 else "****"
    with store.conn() as c:
        c.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (f"secret:{name}", token))
        c.execute("INSERT INTO secrets_meta(name,ts,fingerprint) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET ts=excluded.ts, fingerprint=excluded.fingerprint", (name, time.time(), fp))
    store.audit("secret.set", name, detail={"fingerprint": fp})


def get(name: str) -> str | None:
    with store.conn() as c: r = c.execute("SELECT value FROM settings WHERE key=?", (f"secret:{name}",)).fetchone()
    if not r: return None
    try: return _f().decrypt(r["value"].encode()).decode()
    except InvalidToken: return None


def delete(name: str):
    with store.conn() as c:
        c.execute("DELETE FROM settings WHERE key=?", (f"secret:{name}",)); c.execute("DELETE FROM secrets_meta WHERE name=?", (name,))
    store.audit("secret.delete", name)


def status(name: str) -> dict:
    with store.conn() as c: r = c.execute("SELECT ts, fingerprint FROM secrets_meta WHERE name=?", (name,)).fetchone()
    return {"configured": bool(r), "fingerprint": r["fingerprint"] if r else None, "updated": r["ts"] if r else None}


def mask(text: str) -> str:
    """Mask anything that looks like a secret before it is shown or stored in a report."""
    import re
    text = re.sub(r"(gh[pousr]_[A-Za-z0-9]{20,})", lambda m: m.group(1)[:4] + "…[masked]", text)
    text = re.sub(r"(AKIA[0-9A-Z]{16})", lambda m: m.group(1)[:4] + "…[masked]", text)
    text = re.sub(r"((?:api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?)([^'\"\s]{6,})", lambda m: m.group(1) + "[masked]", text, flags=re.I)
    return text
