import json
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import get_db, init_db, close_db
from auth import decode_token, get_current_user
from connection_manager import manager
from exceptions import AppException, ConflictException, app_exception_handler, generic_exception_handler
from rate_limit import rate_limit_middleware
from security import SecurityHeadersMiddleware

from routes import (
    auth_router,
    teams_router,
    artifacts_router,
    threads_router,
    files_router,
    users_router,
    activity_router,
    stats_router,
)

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
    conn = get_db()
    conn.execute("DELETE FROM rate_limits WHERE window_start < ?", (int(time.time()) - 120,))
    conn.commit()
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

app.include_router(auth_router)
app.include_router(teams_router)
app.include_router(artifacts_router)
app.include_router(threads_router)
app.include_router(files_router)
app.include_router(users_router)
app.include_router(activity_router)
app.include_router(stats_router)

app.mount("/files", StaticFiles(directory=str(UPLOAD_DIR)), name="files")


#  Sync Points

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


# Health

@app.get("/api/health")
async def health():
    conn = get_db()
    conn.execute("SELECT 1")
    return {"status": "healthy", "database": "connected", "version": settings.app_version}


# WebSocket-

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


#  Root

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
