import json
import uuid
from datetime import datetime

from database import get_db
from exceptions import NotFoundException


def row_to_dict(row) -> dict:
    d = dict(row)
    for key in ("dependencies", "metadata", "attachments", "mentions"):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return d


def verify_artifact_exists(artifact_id: str, conn) -> dict:
    row = conn.execute("SELECT * FROM artifacts WHERE id = ?", (artifact_id,)).fetchone()
    if not row:
        raise NotFoundException("Artifact")
    return row_to_dict(row)


def log_activity(artifact_id: str, actor_id: str, event_type: str, detail: str = ""):
    conn = get_db()
    event_id = str(uuid.uuid4())
    now = int(datetime.now().timestamp())
    conn.execute(
        "INSERT INTO activity_events (id, type, artifact_id, actor_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (event_id, event_type, artifact_id, actor_id, detail, now),
    )
    conn.commit()
