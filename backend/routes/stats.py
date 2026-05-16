from fastapi import APIRouter, Depends

from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["Stats"])


@router.get("")
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
