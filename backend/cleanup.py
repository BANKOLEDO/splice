import os
import time
import shutil
from pathlib import Path


UPLOAD_DIR = Path("uploads")
MAX_FILE_AGE_HOURS = 72
CLEANUP_INTERVAL_SECONDS = 3600


def cleanup_old_files(max_age_hours: int = MAX_FILE_AGE_HOURS):
    if not UPLOAD_DIR.exists():
        return {"removed": 0, "errors": 0}

    now = time.time()
    max_age_seconds = max_age_hours * 3600
    removed = 0
    errors = 0

    for file_path in UPLOAD_DIR.iterdir():
        if file_path.is_file():
            try:
                file_age = now - file_path.stat().st_mtime
                if file_age > max_age_seconds:
                    file_path.unlink()
                    removed += 1
            except Exception:
                errors += 1

    return {"removed": removed, "errors": errors}


def cleanup_orphaned_db_records(db_path: str = "splice.db"):
    import sqlite3
    if not os.path.exists(db_path):
        return {"cleaned": 0}

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, path FROM files")
    files = cursor.fetchall()

    cleaned = 0
    for file_id, file_path in files:
        full_path = UPLOAD_DIR / file_path
        if not full_path.exists():
            cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
            cleaned += 1

    conn.commit()
    conn.close()
    return {"cleaned": cleaned}


def get_storage_usage() -> dict:
    if not UPLOAD_DIR.exists():
        return {"total_files": 0, "total_bytes": 0}

    total_bytes = sum(
        f.stat().st_size for f in UPLOAD_DIR.iterdir() if f.is_file()
    )
    total_files = sum(1 for f in UPLOAD_DIR.iterdir() if f.is_file())

    return {
        "total_files": total_files,
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 2),
    }
