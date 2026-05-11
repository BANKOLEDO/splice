import sqlite3
import threading
from contextlib import contextmanager
from config import settings

_local = threading.local()


def get_db() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        conn = sqlite3.connect(settings.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=-4000")
        _local.conn = conn
    return _local.conn


@contextmanager
def db_connection():
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def close_db():
    if hasattr(_local, "conn") and _local.conn:
        _local.conn.close()
        _local.conn = None


def init_db():
    import os
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    conn = get_db()
    with open(schema_path) as f:
        conn.executescript(f.read())
    conn.commit()
