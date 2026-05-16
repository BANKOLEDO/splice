import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from database import get_db
from auth import get_current_user
from models import TeamCreate
from exceptions import AppException, NotFoundException, ConflictException

router = APIRouter(prefix="/api/teams", tags=["Teams"])


@router.get("")
async def list_teams(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        """SELECT t.* FROM teams t
           JOIN team_members tm ON t.id = tm.team_id
           WHERE tm.user_id = ?
           ORDER BY t.created_at DESC""",
        (current_user["user_id"],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("")
async def create_team(team: TeamCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    now = int(datetime.now().timestamp())
    team_id = str(uuid.uuid4())
    try:
        conn.execute(
            "INSERT INTO teams (id, name, slug, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
            (team_id, team.name, team.slug, current_user["user_id"], now),
        )
        conn.execute(
            "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
            (team_id, current_user["user_id"], "admin", now),
        )
        conn.commit()
    except Exception as e:
        if "UNIQUE" in str(e):
            raise ConflictException("Team slug already exists")
        raise
    return JSONResponse(status_code=201, content={"success": True, "id": team_id, "name": team.name})


@router.post("/{team_id}/join")
async def join_team(team_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    team = conn.execute("SELECT id FROM teams WHERE id = ?", (team_id,)).fetchone()
    if not team:
        raise NotFoundException("Team")
    existing = conn.execute(
        "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?",
        (team_id, current_user["user_id"]),
    ).fetchone()
    if existing:
        return {"success": True, "already_member": True}
    now = int(datetime.now().timestamp())
    conn.execute(
        "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
        (team_id, current_user["user_id"], "member", now),
    )
    conn.commit()
    return {"success": True, "already_member": False}


@router.delete("/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    team = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    if not team:
        raise NotFoundException("Team")
    if team["created_by"] != current_user["user_id"]:
        raise AppException(403, "Only the team creator can delete this team")
    conn.execute("DELETE FROM artifacts WHERE team_id = ?", (team_id,))
    conn.execute("DELETE FROM team_members WHERE team_id = ?", (team_id,))
    conn.execute("DELETE FROM teams WHERE id = ?", (team_id,))
    conn.commit()
    return {"success": True}


@router.get("/{team_id}/members")
async def list_team_members(team_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        """SELECT u.id, u.username, u.display_name, u.role, tm.role as member_role
           FROM team_members tm JOIN users u ON tm.user_id = u.id
           WHERE tm.team_id = ?""",
        (team_id,),
    ).fetchall()
    return [dict(r) for r in rows]
