"""SQLite store (data/platform/platform.db) + append-only audit log. Secrets never go in this DB in plain text."""
from __future__ import annotations
import json, sqlite3, threading, time, uuid
from contextlib import contextmanager
from pathlib import Path
from ..config import DATA

PDIR = DATA / "platform"; PDIR.mkdir(parents=True, exist_ok=True)
DB = PDIR / "platform.db"
_lock = threading.RLock()
SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, actor TEXT, action TEXT, target TEXT, outcome TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS scans(id TEXT PRIMARY KEY, ts REAL, kind TEXT, target TEXT, target_hash TEXT, score INTEGER, tier TEXT,
  confidence TEXT, files_total INTEGER, files_scanned INTEGER, files_skipped INTEGER, findings TEXT, summary TEXT, duration_s REAL, report_html TEXT);
CREATE TABLE IF NOT EXISTS threats(id TEXT PRIMARY KEY, ts REAL, scan_id TEXT, target TEXT, rule_id TEXT, severity TEXT, file TEXT, line INTEGER, title TEXT, status TEXT DEFAULT 'open');
CREATE TABLE IF NOT EXISTS watches(id TEXT PRIMARY KEY, ts REAL, kind TEXT, path TEXT, interval_s INTEGER, last_hash TEXT, last_scan_ts REAL, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY, ts REAL, level TEXT, message TEXT, source TEXT, read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS quarantine(id TEXT PRIMARY KEY, ts REAL, original TEXT, stored TEXT, sha256 TEXT, reason TEXT, state TEXT DEFAULT 'quarantined');
CREATE TABLE IF NOT EXISTS whitelist(id TEXT PRIMARY KEY, ts REAL, rule_id TEXT, path_glob TEXT, sha256 TEXT, reason TEXT, approved_by TEXT);
CREATE TABLE IF NOT EXISTS trust_reviews(target TEXT PRIMARY KEY, ts REAL, decision TEXT, reviewer TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS usage(id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, service TEXT, operation TEXT, units REAL, unit TEXT, est_cost_usd REAL, note TEXT);
CREATE TABLE IF NOT EXISTS credit_balances(service TEXT PRIMARY KEY, ts REAL, balance REAL, unit TEXT, source TEXT);
CREATE TABLE IF NOT EXISTS library(id TEXT PRIMARY KEY, ts REAL, name TEXT, kind TEXT, path TEXT, size INTEGER, sha256 TEXT, tags TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS secrets_meta(name TEXT PRIMARY KEY, ts REAL, fingerprint TEXT);
"""


@contextmanager
def conn():
    with _lock:
        c = sqlite3.connect(DB, timeout=30); c.row_factory = sqlite3.Row
        try: yield c; c.commit()
        finally: c.close()


def init():
    with conn() as c: c.executescript(SCHEMA)


init()


def audit(action: str, target: str = "", outcome: str = "ok", detail: dict | None = None, actor: str = "user"):
    """Audit trail. `detail` must never contain secrets: callers pass only identifiers/counts."""
    safe = json.dumps(detail or {}, ensure_ascii=False)[:2000]
    with conn() as c: c.execute("INSERT INTO audit_log(ts,actor,action,target,outcome,detail) VALUES(?,?,?,?,?,?)", (time.time(), actor, action, str(target)[:300], outcome, safe))


def audit_list(limit=200):
    with conn() as c: return [dict(r) for r in c.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))]


def setting_get(key, default=None):
    with conn() as c:
        r = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return json.loads(r["value"]) if r else default


def setting_set(key, value):
    with conn() as c: c.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))


def new_id(prefix=""): return prefix + uuid.uuid4().hex[:12]
