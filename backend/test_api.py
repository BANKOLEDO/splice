import pytest
from starlette.testclient import TestClient
import uuid
import os

os.environ["SPLICE_DB_PATH"] = ":memory:"
os.environ["SPLICE_JWT_SECRET"] = "test-secret-key-for-testing-only"
os.environ["SPLICE_RATE_LIMIT"] = "9999"

from main import app
from database import init_db, get_db


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    yield
    conn = get_db()
    for table in ["messages", "threads", "sync_points", "active_users", "files", "artifacts", "users"]:
        conn.execute(f"DELETE FROM {table}")
    conn.commit()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def user_data():
    uid = str(uuid.uuid4())[:8]
    return {"username": f"testuser_{uid}", "password": "testpass123", "display_name": "Test User", "role": "dev"}


def register_user(client, data):
    return client.post("/api/auth/register", json=data)


def login_user(client, data):
    return client.post("/api/auth/login", json={"username": data["username"], "password": data["password"]})


class TestAuth:
    def test_register(self, client, user_data):
        resp = register_user(client, user_data)
        assert resp.status_code == 200
        body = resp.json()
        assert "token" in body
        assert body["user"]["username"] == user_data["username"]
        assert body["user"]["role"] == user_data["role"]

    def test_register_duplicate(self, client, user_data):
        register_user(client, user_data)
        resp = register_user(client, user_data)
        assert resp.status_code == 409

    def test_login(self, client, user_data):
        register_user(client, user_data)
        resp = login_user(client, user_data)
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_login_wrong_password(self, client, user_data):
        register_user(client, user_data)
        resp = client.post("/api/auth/login", json={"username": user_data["username"], "password": "wrongpass"})
        assert resp.status_code == 401

    def test_me(self, client, user_data):
        reg = register_user(client, user_data)
        token = reg.json()["token"]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["username"] == user_data["username"]

    def test_me_no_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_invalid_token(self, client):
        resp = client.get("/api/artifacts", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401


class TestArtifacts:
    def _auth(self, client, user_data):
        reg = register_user(client, user_data)
        return reg.json()["token"]

    def test_create_artifact(self, client, user_data):
        token = self._auth(client, user_data)
        artifact_id = f"test_{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/artifacts",
            json={
                "id": artifact_id,
                "type": "spec",
                "title": "Test Spec",
                "content": "Test content",
                "owner_role": "dev",
                "status": "draft",
                "dependencies": [],
                "created_by": user_data["username"],
                "metadata": {},
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == artifact_id

    def test_get_artifacts(self, client, user_data):
        token = self._auth(client, user_data)
        resp = client.get("/api/artifacts", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_artifact_not_found(self, client, user_data):
        token = self._auth(client, user_data)
        resp = client.get("/api/artifacts/nonexistent", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    def test_update_artifact(self, client, user_data):
        token = self._auth(client, user_data)
        aid = f"upd_{uuid.uuid4().hex[:8]}"
        client.post(
            "/api/artifacts",
            json={"id": aid, "type": "task", "title": "Original", "content": "Original", "owner_role": "dev", "status": "draft", "dependencies": [], "created_by": "test", "metadata": {}},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.patch(
            f"/api/artifacts/{aid}",
            json={"title": "Updated", "status": "needs_review"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_delete_artifact(self, client, user_data):
        token = self._auth(client, user_data)
        aid = f"del_{uuid.uuid4().hex[:8]}"
        client.post(
            "/api/artifacts",
            json={"id": aid, "type": "task", "title": "Delete Me", "content": "Bye", "owner_role": "dev", "status": "draft", "dependencies": [], "created_by": "test", "metadata": {}},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.delete(f"/api/artifacts/{aid}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        get_resp = client.get(f"/api/artifacts/{aid}", headers={"Authorization": f"Bearer {token}"})
        assert get_resp.status_code == 404

    def test_filter_by_status(self, client, user_data):
        token = self._auth(client, user_data)
        for s in ["draft", "approved"]:
            client.post(
                "/api/artifacts",
                json={"id": f"f_{s}_{uuid.uuid4().hex[:8]}", "type": "task", "title": s, "content": s, "owner_role": "dev", "status": s, "dependencies": [], "created_by": "test", "metadata": {}},
                headers={"Authorization": f"Bearer {token}"},
            )
        resp = client.get("/api/artifacts?status=draft", headers={"Authorization": f"Bearer {token}"})
        assert all(a["status"] == "draft" for a in resp.json())


class TestMessages:
    def _setup(self, client, user_data):
        token = register_user(client, user_data).json()["token"]
        aid = f"msg_{uuid.uuid4().hex[:8]}"
        client.post(
            "/api/artifacts",
            json={"id": aid, "type": "question", "title": "Q", "content": "Question", "owner_role": "dev", "status": "draft", "dependencies": [], "created_by": "test", "metadata": {}},
            headers={"Authorization": f"Bearer {token}"},
        )
        return token, aid

    def test_add_message(self, client, user_data):
        token, aid = self._setup(client, user_data)
        resp = client.post(
            f"/api/artifacts/{aid}/messages",
            json={"author": "test", "role": "dev", "content": "Hello world", "attachments": [], "mentions": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "message_id" in resp.json()

    def test_get_thread(self, client, user_data):
        token, aid = self._setup(client, user_data)
        client.post(
            f"/api/artifacts/{aid}/messages",
            json={"author": "test", "role": "dev", "content": "First message", "attachments": [], "mentions": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(f"/api/artifacts/{aid}/thread", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()["messages"]) == 1

    def test_resolve_command(self, client, user_data):
        token, aid = self._setup(client, user_data)
        client.post(
            f"/api/artifacts/{aid}/messages",
            json={"author": "test", "role": "dev", "content": "/resolve this thread", "attachments": [], "mentions": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        thread = client.get(f"/api/artifacts/{aid}/thread", headers={"Authorization": f"Bearer {token}"})
        assert thread.json()["resolved"] == 1 or thread.json()["resolved"] is True

    def test_generate_spec(self, client, user_data):
        token, aid = self._setup(client, user_data)
        client.post(
            f"/api/artifacts/{aid}/messages",
            json={"author": "pm", "role": "pm", "content": "Requirement: users must be able to login", "attachments": [], "mentions": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        client.post(
            f"/api/artifacts/{aid}/messages",
            json={"author": "dev", "role": "dev", "content": "Should we also support OAuth?", "attachments": [], "mentions": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.post(f"/api/artifacts/{aid}/generate-spec", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "spec" in data
        assert data["metadata"]["requirements_found"] >= 1
        assert data["metadata"]["questions_found"] >= 1


class TestFileUpload:
    def test_upload(self, client, user_data):
        token = register_user(client, user_data).json()["token"]
        resp = client.post(
            "/api/upload",
            files={"file": ("test.txt", b"Hello world", "text/plain")},
            data={"user_id": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "test.txt"


class TestStats:
    def test_stats(self, client, user_data):
        token = register_user(client, user_data).json()["token"]
        resp = client.get("/api/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "total_artifacts" in data
        assert "total_messages" in data
        assert "total_users" in data


class TestHealth:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
