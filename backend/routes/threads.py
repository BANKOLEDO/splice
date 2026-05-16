import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from database import get_db
from auth import get_current_user
from models import MessageCreate
from sanitize import sanitize_text
from connection_manager import manager
from helpers import row_to_dict, verify_artifact_exists, log_activity

router = APIRouter(tags=["Threads"])


@router.get("/api/artifacts/{artifact_id}/thread")
async def get_thread(artifact_id: str, _=Depends(get_current_user)):
    conn = get_db()
    verify_artifact_exists(artifact_id, conn)
    thread = conn.execute("SELECT * FROM threads WHERE artifact_id = ?", (artifact_id,)).fetchone()
    if not thread:
        return {"id": None, "artifact_id": artifact_id, "resolved": False, "messages": []}

    thread_dict = dict(thread)
    thread_dict["messages"] = [
        row_to_dict(m) for m in conn.execute(
            "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread["id"],),
        ).fetchall()
    ]
    return thread_dict


@router.post("/api/artifacts/{artifact_id}/messages")
async def add_message(artifact_id: str, message: MessageCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    now = int(datetime.now().timestamp())
    verify_artifact_exists(artifact_id, conn)

    thread = conn.execute("SELECT id FROM threads WHERE artifact_id = ?", (artifact_id,)).fetchone()
    thread_id = thread["id"] if thread else str(uuid.uuid4())
    if not thread:
        conn.execute(
            "INSERT INTO threads (id, artifact_id, resolved, last_message_at) VALUES (?, ?, 0, ?)",
            (thread_id, artifact_id, now),
        )

    message_id = str(uuid.uuid4())
    sanitized_content = sanitize_text(message.content)
    conn.execute(
        """INSERT INTO messages (id, thread_id, author, role, content, attachments, mentions, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (message_id, thread_id, message.author, message.role.value, sanitized_content,
         json.dumps(message.attachments), json.dumps(message.mentions), now),
    )
    conn.execute("UPDATE threads SET last_message_at = ? WHERE id = ?", (now, thread_id))
    conn.execute("UPDATE artifacts SET updated_at = ? WHERE id = ?", (now, artifact_id))
    conn.commit()

    msg_data = {"id": message_id, "author": message.author, "role": message.role.value,
                "content": sanitized_content, "attachments": message.attachments,
                "mentions": message.mentions, "created_at": now}
    await manager.broadcast_to_artifact(artifact_id, {"type": "new_message", "artifact_id": artifact_id, "message": msg_data})

    if "/resolve" in message.content:
        conn.execute("UPDATE threads SET resolved = 1 WHERE artifact_id = ?", (artifact_id,))
        conn.commit()
        await manager.broadcast_to_artifact(artifact_id, {"type": "thread_resolved", "artifact_id": artifact_id})

    log_activity(artifact_id, message.author, "message")
    return JSONResponse(status_code=201, content={"success": True, "message_id": message_id})


@router.post("/api/threads/{thread_id}/resolve")
async def resolve_thread(thread_id: str, _=Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE threads SET resolved = 1 WHERE id = ?", (thread_id,))
    conn.commit()
    return JSONResponse(status_code=200, content={"success": True})


@router.post("/api/threads/{thread_id}/unresolve")
async def unresolve_thread(thread_id: str, _=Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE threads SET resolved = 0 WHERE id = ?", (thread_id,))
    conn.commit()
    return JSONResponse(status_code=200, content={"success": True})
