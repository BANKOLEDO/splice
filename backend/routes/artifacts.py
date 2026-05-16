import json
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from database import get_db
from auth import get_current_user
from models import ArtifactCreate, ArtifactUpdate
from sanitize import sanitize_text
from connection_manager import manager
from helpers import row_to_dict, verify_artifact_exists, log_activity
from exceptions import AppException, ConflictException

router = APIRouter(prefix="/api/artifacts", tags=["Artifacts"])

REQUIREMENT_PATTERN = re.compile(r"(requirement|acceptance criteria|must|should|needs?\s+to|requires?\b)", re.IGNORECASE)
QUESTION_PATTERN = re.compile(r"(\?|clarify|what about|how about|why\b)", re.IGNORECASE)
BLOCKER_PATTERN = re.compile(r"(blocked|blocking|cannot|can't|waiting on|depends on)", re.IGNORECASE)


@router.get("")
async def get_artifacts(
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    team_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    query = "SELECT artifacts.* FROM artifacts JOIN team_members ON artifacts.team_id = team_members.team_id"
    params = []

    conditions = ["team_members.user_id = ?"]
    params.append(current_user["user_id"])

    if team_id:
        conditions.append("artifacts.team_id = ?")
        params.append(team_id)
    if status:
        conditions.append("artifacts.status = ?")
        params.append(status)
    if owner:
        conditions.append("artifacts.owner_role = ?")
        params.append(owner)
    if type:
        conditions.append("artifacts.type = ?")
        params.append(type)

    query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY artifacts.updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor = conn.execute(query, params)
    artifacts_list = [row_to_dict(row) for row in cursor.fetchall()]
    return artifacts_list


@router.get("/{artifact_id}")
async def get_artifact(artifact_id: str, _=Depends(get_current_user)):
    conn = get_db()
    return verify_artifact_exists(artifact_id, conn)


@router.post("")
async def create_artifact(artifact: ArtifactCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    now = int(datetime.now().timestamp())
    team_id = artifact.team_id or ""
    content = sanitize_text(artifact.content)
    title = sanitize_text(artifact.title, max_length=255)
    try:
        conn.execute(
            """INSERT INTO artifacts (id, team_id, type, title, content, owner_role, status,
               dependencies, created_by, created_at, updated_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                artifact.id,
                team_id,
                artifact.type.value,
                title,
                content,
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
    log_activity(artifact.id, current_user["user_id"], "created")
    return JSONResponse(status_code=201, content={"success": True, "id": artifact.id})


@router.patch("/{artifact_id}")
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
    if "status" in fields:
        log_activity(artifact_id, current_user["user_id"], "status_change", f"status: {fields['status']}")
    else:
        log_activity(artifact_id, current_user["user_id"], "updated")
    return updated


@router.delete("/{artifact_id}")
async def delete_artifact(artifact_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    verify_artifact_exists(artifact_id, conn)
    conn.execute("DELETE FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE artifact_id = ?)", (artifact_id,))
    conn.execute("DELETE FROM threads WHERE artifact_id = ?", (artifact_id,))
    conn.execute("DELETE FROM artifacts WHERE id = ?", (artifact_id,))
    conn.commit()

    log_activity(artifact_id, current_user["user_id"], "deleted")
    await manager.broadcast_to_all({"type": "artifact_deleted", "artifact_id": artifact_id})
    return {"success": True}


@router.post("/{artifact_id}/generate-spec")
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


@router.post("/{artifact_id}/typing")
async def broadcast_typing(artifact_id: str, data: dict, _=Depends(get_current_user)):
    user_id = data.get("user_id", "unknown")
    await manager.broadcast_to_artifact(artifact_id, {
        "type": "typing", "user_id": user_id, "artifact_id": artifact_id,
    }, exclude_user=user_id)
    return {"success": True}
