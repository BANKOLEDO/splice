from fastapi import APIRouter, Depends, Query

from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/activity", tags=["Activity"])


@router.get("")
async def get_activity(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    rows = conn.execute(
        """SELECT ae.*, a.title as artifact_title
           FROM activity_events ae
           JOIN artifacts a ON ae.artifact_id = a.id
           JOIN team_members tm ON a.team_id = tm.team_id
           WHERE tm.user_id = ?
           ORDER BY ae.created_at DESC LIMIT ? OFFSET ?""",
        (current_user["user_id"], limit, offset),
    ).fetchall()
    return [dict(r) for r in rows]
