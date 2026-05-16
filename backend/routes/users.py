from fastapi import APIRouter, Depends

from database import get_db
from auth import get_current_user
from exceptions import NotFoundException

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/online")
async def get_online_users(_=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT user_id, role, display_name, current_artifact, last_seen FROM active_users ORDER BY last_seen DESC",
    )
    return [dict(r) for r in rows.fetchall()]


@router.get("/{user_id}")
async def get_user(user_id: str, _=Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM active_users WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        raise NotFoundException("User")
    return dict(row)
