import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
from exceptions import AppException, ConflictException, NotFoundException

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register")
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
        "INSERT INTO users (id, username, display_name, password_hash, role, temp_password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, username, display_name, hash_password(password), role, True, now),
    )

    team_id = str(uuid.uuid4())
    team_slug = f"{username}-team"
    conn.execute(
        "INSERT INTO teams (id, name, slug, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
        (team_id, f"{display_name}'s Team", team_slug, user_id, now),
    )
    conn.execute(
        "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
        (team_id, user_id, "admin", now),
    )
    conn.commit()

    token = create_access_token(user_id, role)
    return JSONResponse(status_code=201, content={
        "token": token,
        "user": {"id": user_id, "username": username, "display_name": display_name, "role": role, "team_id": team_id},
    })


@router.post("/login")
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

    team = conn.execute(
        "SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ? LIMIT 1", (user["id"],)
    ).fetchone()
    team_id = team["team_id"] if team else ""

    token = create_access_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
            "team_id": team_id,
        },
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, display_name, role, created_at, last_login FROM users WHERE id = ?",
        (current_user["user_id"],),
    ).fetchone()
    if not user:
        raise NotFoundException("User")
    return dict(user)


@router.post("/set-password")
async def set_password(data: dict, current_user: dict = Depends(get_current_user)):
    password = data.get("password", "")
    if not password or len(password) < 6:
        raise AppException(422, "Password must be at least 6 characters")

    conn = get_db()
    conn.execute("UPDATE users SET password_hash = ?, temp_password = 0 WHERE id = ?",
        (hash_password(password), current_user["user_id"]))
    conn.commit()
    return {"success": True}
