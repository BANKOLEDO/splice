import json
from typing import Dict, List, Optional, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[str, WebSocket] = {}
        self.artifact_viewers: Dict[str, Set[str]] = {}
        self.user_artifact: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_connections[user_id] = websocket

    def disconnect(self, websocket: WebSocket, user_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]
        current_artifact = self.user_artifact.get(user_id)
        if current_artifact and current_artifact in self.artifact_viewers:
            self.artifact_viewers[current_artifact].discard(user_id)
            if not self.artifact_viewers[current_artifact]:
                del self.artifact_viewers[current_artifact]
        if user_id in self.user_artifact:
            del self.user_artifact[user_id]

    def join_artifact(self, user_id: str, artifact_id: str):
        old_artifact = self.user_artifact.get(user_id)
        if old_artifact and old_artifact in self.artifact_viewers:
            self.artifact_viewers[old_artifact].discard(user_id)
            if not self.artifact_viewers[old_artifact]:
                del self.artifact_viewers[old_artifact]
        self.user_artifact[user_id] = artifact_id
        if artifact_id not in self.artifact_viewers:
            self.artifact_viewers[artifact_id] = set()
        self.artifact_viewers[artifact_id].add(user_id)

    def get_artifact_users(self, artifact_id: str) -> List[str]:
        return list(self.artifact_viewers.get(artifact_id, set()))

    async def broadcast_to_artifact(self, artifact_id: str, message: dict, exclude_user: Optional[str] = None):
        viewer_ids = self.artifact_viewers.get(artifact_id, set())
        for uid in viewer_ids:
            if uid == exclude_user:
                continue
            ws = self.user_connections.get(uid)
            if ws:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    pass

    async def broadcast_to_all(self, message: dict):
        for ws in self.active_connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                pass

    async def send_to_user(self, user_id: str, message: dict):
        ws = self.user_connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                pass

    def get_online_users(self) -> List[str]:
        return list(self.user_connections.keys())


manager = ConnectionManager()
