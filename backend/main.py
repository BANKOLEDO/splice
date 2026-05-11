import uuid
import json
import re
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import get_db, init_db, close_db, db_connection
from auth import hash_password, verify_password, create_access_token, get_current_user
from models import (
    ArtifactCreate, ArtifactUpdate, MessageCreate,
    ArtifactType, ArtifactStatus, OwnerRole, Role,
)
from connection_manager import manager
from exceptions import AppException, NotFoundException, ConflictException, app_exception_handler, generic_exception_handler
from rate_limit import rate_limit_middleware
from security import SecurityHeadersMiddleware

logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("splice")

UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized")
    yield
    close_db()
    logger.info("Database connections closed")


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if settings.cors_origins != ["*"] else ["*"],
    allow_credentials=settings.cors_origins != ["*"],
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.middleware("http")(rate_limit_middleware)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


# ─── Helpers ────────────────────────────────────────────────────────────────

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


# ─── Auth Endpoints ─────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def register(data: dict):
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    display_name = data.get("display_name", username)
    role = data.get("role", "dev")

    if not username or len(username) < 2:
        raise AppException(422, "Username must be at least 2 characters")
    if not password or len(password) < 6:
        raise AppException(422, "Password must be at least 6 characters")
    if role not in ("dev", "designer", "pm", "backend", "frontend"):
        raise AppException(422, "Invalid role")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        raise ConflictException("Username already taken")

    user_id = str(uuid.uuid4())
    now = int(datetime.now().timestamp())
    conn.execute(
        "INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, username, display_name, hash_password(password), role, now),
    )
    conn.commit()

    token = create_access_token(user_id, role)
    return {
        "token": token,
        "user": {"id": user_id, "username": username, "display_name": display_name, "role": role},
    }


@app.post("/api/auth/login")
async def login(data: dict):
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")

    if not username or not password:
        raise AppException(422, "Username and password required")

    conn = get_db()
    user = conn.execute(
        "SELECT id, username, display_name, password_hash, role FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if not user or not verify_password(password, user["password_hash"]):
        raise AppException(401, "Invalid username or password")

    now = int(datetime.now().timestamp())
    conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user["id"]))
    conn.commit()

    token = create_access_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
        },
    }


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, display_name, role, created_at, last_login FROM users WHERE id = ?",
        (current_user["user_id"],),
    ).fetchone()
    if not user:
        raise NotFoundException("User")
    return dict(user)


# ─── Artifacts ──────────────────────────────────────────────────────────────

@app.get("/api/artifacts")
async def get_artifacts(
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    _=Depends(get_current_user),
):
    conn = get_db()
    query = "SELECT * FROM artifacts WHERE 1=1"
    params = []

    if status:
        query += " AND status = ?"
        params.append(status)
    if owner:
        query += " AND owner_role = ?"
        params.append(owner)
    if type:
        query += " AND type = ?"
        params.append(type)

    query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor = conn.execute(query, params)
    artifacts = [row_to_dict(row) for row in cursor.fetchall()]
    return artifacts


@app.get("/api/artifacts/{artifact_id}")
async def get_artifact(artifact_id: str, _=Depends(get_current_user)):
    conn = get_db()
    return verify_artifact_exists(artifact_id, conn)


@app.post("/api/artifacts")
async def create_artifact(artifact: ArtifactCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    now = int(datetime.now().timestamp())
    try:
        conn.execute(
            """INSERT INTO artifacts (id, type, title, content, owner_role, status,
               dependencies, created_by, created_at, updated_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                artifact.id,
                artifact.type.value,
                artifact.title,
                artifact.content,
                artifact.owner_role.value,
                artifact.status.value,
                json.dumps(artifact.dependencies),
                artifact.created_by,
                now,
                now,
                json.dumps(artifact.metadata),
            ),
        )
        conn.commit()
    except Exception as e:
        if "UNIQUE" in str(e):
            raise ConflictException("Artifact with this ID already exists")
        raise

    await manager.broadcast_to_all({"type": "artifact_created", "artifact_id": artifact.id})
    return {"success": True, "id": artifact.id}


@app.patch("/api/artifacts/{artifact_id}")
async def update_artifact(artifact_id: str, update: ArtifactUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    verify_artifact_exists(artifact_id, conn)

    fields = update.model_dump(exclude_unset=True)
    if not fields:
        return {"success": True, "id": artifact_id}

    now = int(datetime.now().timestamp())
    set_clauses = []
    params = []
    for key, val in fields.items():
        if key in ("dependencies", "metadata"):
            val = json.dumps(val)
        set_clauses.append(f"{key} = ?")
        params.append(val)
    set_clauses.append("updated_at = ?")
    params.append(now)
    params.append(artifact_id)

    conn.execute(f"UPDATE artifacts SET {', '.join(set_clauses)} WHERE id = ?", params)
    conn.commit()

    updated = verify_artifact_exists(artifact_id, conn)
    await manager.broadcast_to_all({"type": "artifact_updated", "artifact_id": artifact_id})
    return updated


@app.delete("/api/artifacts/{artifact_id}")
async def delete_artifact(artifact_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    verify_artifact_exists(artifact_id, conn)
    conn.execute("DELETE FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE artifact_id = ?)", (artifact_id,))
    conn.execute("DELETE FROM threads WHERE artifact_id = ?", (artifact_id,))
    conn.execute("DELETE FROM artifacts WHERE id = ?", (artifact_id,))
    conn.commit()

    await manager.broadcast_to_all({"type": "artifact_deleted", "artifact_id": artifact_id})
    return {"success": True}


# ─── Threads & Messages ─────────────────────────────────────────────────────

@app.get("/api/artifacts/{artifact_id}/thread")
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


@app.post("/api/artifacts/{artifact_id}/messages")
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
    conn.execute(
        """INSERT INTO messages (id, thread_id, author, role, content, attachments, mentions, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (message_id, thread_id, message.author, message.role.value, message.content,
         json.dumps(message.attachments), json.dumps(message.mentions), now),
    )
    conn.execute("UPDATE threads SET last_message_at = ? WHERE id = ?", (now, thread_id))
    conn.execute("UPDATE artifacts SET updated_at = ? WHERE id = ?", (now, artifact_id))
    conn.commit()

    msg_data = {"id": message_id, "author": message.author, "role": message.role.value,
                "content": message.content, "attachments": message.attachments,
                "mentions": message.mentions, "created_at": now}
    await manager.broadcast_to_artifact(artifact_id, {"type": "new_message", "artifact_id": artifact_id, "message": msg_data})

    if "/resolve" in message.content:
        conn.execute("UPDATE threads SET resolved = 1 WHERE artifact_id = ?", (artifact_id,))
        conn.commit()
        await manager.broadcast_to_artifact(artifact_id, {"type": "thread_resolved", "artifact_id": artifact_id})

    return {"success": True, "message_id": message_id}


@app.post("/api/threads/{thread_id}/resolve")
async def resolve_thread(thread_id: str, _=Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE threads SET resolved = 1 WHERE id = ?", (thread_id,))
    conn.commit()
    return {"success": True}


@app.post("/api/threads/{thread_id}/unresolve")
async def unresolve_thread(thread_id: str, _=Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE threads SET resolved = 0 WHERE id = ?", (thread_id,))
    conn.commit()
    return {"success": True}


# ─── File Upload ────────────────────────────────────────────────────────────

ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/markdown",
}


@app.post("/api/upload")
async def upload_file(
    file: UploadFile,
    current_user: dict = Depends(get_current_user),
    artifact_id: Optional[str] = Form(None),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppException(400, f"File type '{file.content_type}' not allowed. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}")

    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix if file.filename else ".bin"
    file_path = f"{file_id}{ext}"
    full_path = UPLOAD_DIR / file_path

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise AppException(413, f"File too large. Max: {settings.max_upload_size_mb}MB")

    full_path.write_bytes(content)

    conn = get_db()
    conn.execute(
        "INSERT INTO files (id, filename, path, uploaded_by, artifact_id, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (file_id, file.filename, file_path, current_user["user_id"], artifact_id, len(content), int(datetime.now().timestamp())),
    )
    conn.commit()

    return {"file_id": file_id, "url": f"/files/{file_path}", "filename": file.filename, "size": len(content)}


@app.get("/api/files")
async def list_files(artifact_id: Optional[str] = Query(None), _=Depends(get_current_user)):
    conn = get_db()
    if artifact_id:
        rows = conn.execute("SELECT * FROM files WHERE artifact_id = ? ORDER BY created_at DESC", (artifact_id,))
    else:
        rows = conn.execute("SELECT * FROM files ORDER BY created_at DESC")
    return [row_to_dict(r) for r in rows.fetchall()]


app.mount("/files", StaticFiles(directory=str(UPLOAD_DIR)), name="files")


# ─── User Presence ──────────────────────────────────────────────────────────

@app.get("/api/users/online")
async def get_online_users(_=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT user_id, role, display_name, current_artifact, last_seen FROM active_users ORDER BY last_seen DESC",
    )
    return [dict(r) for r in rows.fetchall()]


@app.get("/api/users/{user_id}")
async def get_user(user_id: str, _=Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM active_users WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        raise NotFoundException("User")
    return dict(row)


# ─── Sync Points ────────────────────────────────────────────────────────────

@app.post("/api/sync-points")
async def create_sync_point(sync: dict, _=Depends(get_current_user)):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO sync_points (id, source_tool, source_id, artifact_id, direction, last_sync) VALUES (?, ?, ?, ?, ?, ?)",
            (sync["id"], sync["source_tool"], sync["source_id"], sync["artifact_id"],
             sync["direction"], int(datetime.now().timestamp())),
        )
        conn.commit()
    except Exception as e:
        if "UNIQUE" in str(e):
            raise ConflictException("Sync point already exists")
        raise
    return {"success": True, "id": sync["id"]}


@app.get("/api/sync-points")
async def get_sync_points(artifact_id: Optional[str] = Query(None), _=Depends(get_current_user)):
    conn = get_db()
    if artifact_id:
        rows = conn.execute("SELECT * FROM sync_points WHERE artifact_id = ?", (artifact_id,))
    else:
        rows = conn.execute("SELECT * FROM sync_points")
    return [dict(r) for r in rows.fetchall()]


# ─── Spec Generation ────────────────────────────────────────────────────────

REQUIREMENT_PATTERN = re.compile(r"(requirement|acceptance criteria|must|should|needs?\s+to|requires?\b)", re.IGNORECASE)
QUESTION_PATTERN = re.compile(r"(\?|clarify|what about|how about|why\b)", re.IGNORECASE)
BLOCKER_PATTERN = re.compile(r"(blocked|blocking|cannot|can't|waiting on|depends on)", re.IGNORECASE)


@app.post("/api/artifacts/{artifact_id}/generate-spec")
async def generate_spec_from_thread(artifact_id: str, _=Depends(get_current_user)):
    conn = get_db()
    artifact = verify_artifact_exists(artifact_id, conn)
    thread = conn.execute("SELECT id FROM threads WHERE artifact_id = ?", (artifact_id,)).fetchone()
    if not thread:
        raise AppException(400, "No thread found for this artifact. Add messages first.")

    messages = conn.execute(
        "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC",
        (thread["id"],),
    ).fetchall()

    requirements = []
    questions = []
    blockers = []
    for msg in messages:
        m = dict(msg)
        content = m["content"]
        if REQUIREMENT_PATTERN.search(content):
            requirements.append({"author": m["author"], "content": content})
        if QUESTION_PATTERN.search(content):
            questions.append({"author": m["author"], "content": content})
        if BLOCKER_PATTERN.search(content):
            blockers.append({"author": m["author"], "content": content})

    lines = [f"# {artifact['title']}", ""]
    lines.append(f"> Generated from thread on {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"> Artifact: `{artifact['id']}` ({artifact['type']}) | Status: {artifact['status']}")
    lines.append("")
    lines.append("---")
    lines.append("")

    lines.append("## Requirements")
    lines.append("")
    if requirements:
        for r in requirements:
            lines.append(f"- {r['content']} (@{r['author']})")
    else:
        lines.append("_No explicit requirements extracted._")

    lines.append("")
    lines.append("## Open Questions")
    lines.append("")
    if questions:
        for q in questions:
            lines.append(f"- {q['content']} (@{q['author']})")
    else:
        lines.append("_No open questions._")

    lines.append("")
    lines.append("## Blockers")
    lines.append("")
    if blockers:
        for b in blockers:
            lines.append(f"- {b['content']} (@{b['author']})")
    else:
        lines.append("_No blockers identified._")

    return {
        "spec": "\n".join(lines),
        "metadata": {
            "total_messages": len(messages),
            "requirements_found": len(requirements),
            "questions_found": len(questions),
            "blockers_found": len(blockers),
        },
    }


# ─── Typing Indicators ──────────────────────────────────────────────────────

@app.post("/api/artifacts/{artifact_id}/typing")
async def broadcast_typing(artifact_id: str, data: dict, _=Depends(get_current_user)):
    user_id = data.get("user_id", "unknown")
    await manager.broadcast_to_artifact(artifact_id, {
        "type": "typing", "user_id": user_id, "artifact_id": artifact_id,
    }, exclude_user=user_id)
    return {"success": True}


# ─── Stats ──────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats(_=Depends(get_current_user)):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
    by_status = {r["status"]: r["count"] for r in conn.execute(
        "SELECT status, COUNT(*) as count FROM artifacts GROUP BY status").fetchall()}
    by_type = {r["type"]: r["count"] for r in conn.execute(
        "SELECT type, COUNT(*) as count FROM artifacts GROUP BY type").fetchall()}
    total_msgs = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    unresolved = conn.execute("SELECT COUNT(*) FROM threads WHERE resolved = 0").fetchone()[0]
    total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    return {
        "total_artifacts": total,
        "by_status": by_status, "by_type": by_type,
        "total_messages": total_msgs,
        "unresolved_threads": unresolved,
        "total_users": total_users,
    }


# ─── Health ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    conn = get_db()
    conn.execute("SELECT 1")
    return {"status": "healthy", "database": "connected", "version": settings.app_version}


# ─── WebSocket ──────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = None

    try:
        auth_msg = await websocket.receive_text()
        auth_data = json.loads(auth_msg)
        if auth_data.get("type") != "auth" or not auth_data.get("token"):
            await websocket.send_text(json.dumps({"type": "error", "detail": "Authentication required"}))
            await websocket.close()
            return

        from auth import decode_token
        payload = decode_token(auth_data["token"])
        if not payload:
            await websocket.send_text(json.dumps({"type": "error", "detail": "Invalid token"}))
            await websocket.close()
            return

        user_id = payload["sub"]
        user_role = payload.get("role", "dev")
        await manager.connect(websocket, user_id)

        conn = get_db()
        conn.execute(
            "INSERT OR REPLACE INTO active_users (user_id, role, display_name, last_seen, websocket_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, user_role, user_id, int(datetime.now().timestamp()), str(id(websocket))),
        )
        conn.commit()

        await manager.broadcast_to_all({"type": "user_online", "user_id": user_id, "timestamp": int(datetime.now().timestamp())})

        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "view_artifact":
                artifact_id = data["artifact_id"]
                manager.join_artifact(user_id, artifact_id)
                conn = get_db()
                conn.execute("UPDATE active_users SET current_artifact = ? WHERE user_id = ?", (artifact_id, user_id))
                conn.commit()
                await manager.broadcast_to_artifact(artifact_id, {
                    "type": "user_joined", "user_id": user_id, "artifact_id": artifact_id,
                }, exclude_user=user_id)

            elif msg_type == "leave_artifact":
                old_artifact = manager.user_artifact.get(user_id)
                manager.join_artifact(user_id, "")
                if old_artifact:
                    await manager.broadcast_to_artifact(old_artifact, {
                        "type": "user_left", "user_id": user_id, "artifact_id": old_artifact,
                    })

            elif msg_type == "cursor_move":
                artifact_id = data.get("artifact_id")
                if artifact_id:
                    await manager.broadcast_to_artifact(artifact_id, {
                        "type": "cursor_move", "user_id": user_id,
                        "artifact_id": artifact_id, "position": data.get("position", {}),
                    }, exclude_user=user_id)

            elif msg_type == "typing":
                artifact_id = data.get("artifact_id")
                if artifact_id:
                    await manager.broadcast_to_artifact(artifact_id, {
                        "type": "typing", "user_id": user_id, "artifact_id": artifact_id,
                    }, exclude_user=user_id)

            elif msg_type == "ping":
                await manager.send_to_user(user_id, {"type": "pong"})

    except WebSocketDisconnect:
        if user_id:
            manager.disconnect(websocket, user_id)
            conn = get_db()
            conn.execute("DELETE FROM active_users WHERE user_id = ?", (user_id,))
            conn.commit()
            await manager.broadcast_to_all({"type": "user_offline", "user_id": user_id, "timestamp": int(datetime.now().timestamp())})
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        if user_id:
            manager.disconnect(websocket, user_id)
            conn = get_db()
            conn.execute("DELETE FROM active_users WHERE user_id = ?", (user_id,))
            conn.commit()


# ─── Root ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "description": "Real-time visual communication bridge for teams",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.debug)
