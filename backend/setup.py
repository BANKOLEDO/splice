import os
import sys
import sqlite3
import json
from datetime import datetime

DB_PATH = "splice.db"


def init_database():
    if not os.path.exists("schema.sql"):
        print("Error: schema.sql not found")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    with open("schema.sql") as f:
        conn.executescript(f.read())
    conn.close()
    print(f"Database initialized: {DB_PATH}")


def seed_demo_data():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    now = int(datetime.now().timestamp())

    demo_artifacts = [
        {
            "id": "spec_001",
            "type": "spec",
            "title": "User Authentication Flow",
            "content": "## Requirements\n\n- Users must be able to sign up with email/password\n- OAuth2 support for Google and GitHub\n- Password reset via email\n- Session management with JWT tokens\n\n## Acceptance Criteria\n\n1. POST /auth/signup creates a new user\n2. POST /auth/login returns JWT token\n3. GET /auth/me returns current user profile\n4. Token refresh every 24 hours",
            "owner_role": "pm",
            "status": "needs_review",
            "dependencies": [],
            "created_by": "alice_pm",
            "metadata": json.dumps({"priority": "high", "sprint": "Sprint 12"}),
        },
        {
            "id": "design_001",
            "type": "design",
            "title": "Login Screen Mockup",
            "content": "Figma mockup for the login and registration screens.\n\nDesign includes:\n- Email/password form\n- Social login buttons (Google, GitHub)\n- Password strength indicator\n- Error state handling\n\nFigma: https://www.figma.com/file/abc123/login-flow?node-id=1:2",
            "owner_role": "design",
            "status": "needs_review",
            "dependencies": ["spec_001"],
            "created_by": "bob_designer",
            "metadata": json.dumps({
                "figma_url": "https://www.figma.com/file/abc123/login-flow?node-id=1:2",
                "frames": ["login", "register", "forgot-password"],
            }),
        },
        {
            "id": "api_001",
            "type": "api",
            "title": "POST /api/auth/login",
            "content": "Authenticates a user and returns a JWT token.\n\n## Request\n```json\n{\n  \"email\": \"user@example.com\",\n  \"password\": \"securepassword\"\n}\n```\n\n## Response\n```json\n{\n  \"token\": \"eyJhbGci...\",\n  \"user\": {\n    \"id\": \"usr_123\",\n    \"email\": \"user@example.com\"\n  }\n}\n```\n\n## Errors\n- 401: Invalid credentials\n- 429: Too many attempts",
            "owner_role": "backend",
            "status": "draft",
            "dependencies": ["spec_001"],
            "created_by": "charlie_dev",
            "metadata": json.dumps({"method": "POST", "path": "/api/auth/login", "auth": "none"}),
        },
        {
            "id": "ui_001",
            "type": "ui",
            "title": "Login Button Component",
            "content": "Primary action button for authentication flows.\n\nProps:\n- `variant`: 'primary' | 'secondary' | 'social'\n- `loading`: boolean (shows spinner)\n- `disabled`: boolean\n- `onPress`: () => void\n\nStates: default, hover, active, loading, disabled, error",
            "owner_role": "frontend",
            "status": "draft",
            "dependencies": ["design_001"],
            "created_by": "diana_frontend",
            "metadata": json.dumps({"component": "Button", "library": "react-native"}),
        },
        {
            "id": "task_001",
            "type": "task",
            "title": "Implement JWT Token Refresh",
            "content": "Build the token refresh endpoint that issues new access tokens using valid refresh tokens.\n\n- POST /auth/refresh\n- Rotate refresh tokens\n- Blacklist old tokens\n- Set appropriate expiry (7 days for refresh, 1 hour for access)",
            "owner_role": "backend",
            "status": "blocked",
            "dependencies": ["api_001", "spec_001"],
            "created_by": "charlie_dev",
            "metadata": json.dumps({"estimated_hours": 8, "priority": "medium"}),
        },
        {
            "id": "question_001",
            "type": "question",
            "title": "Should we support magic link login?",
            "content": "The PM mentioned passwordless login as a nice-to-have. Do we want to include this in the initial release or push to v2?\n\nPros:\n- Better UX\n- No password management\n\nCons:\n- Additional API complexity\n- Email delivery dependency",
            "owner_role": "pm",
            "status": "draft",
            "dependencies": ["spec_001"],
            "created_by": "alice_pm",
            "metadata": json.dumps({"votes": {"for": 3, "against": 1}}),
        },
    ]

    for a in demo_artifacts:
        a["created_at"] = now - 3600 * (6 - demo_artifacts.index(a))
        a["updated_at"] = a["created_at"]

        existing = conn.execute("SELECT id FROM artifacts WHERE id = ?", (a["id"],)).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO artifacts (id, type, title, content, owner_role, status,
                   dependencies, created_by, created_at, updated_at, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    a["id"], a["type"], a["title"], a["content"],
                    a["owner_role"], a["status"],
                    json.dumps(a["dependencies"]),
                    a["created_by"], a["created_at"], a["updated_at"],
                    a["metadata"],
                ),
            )

    demo_messages = [
        {
            "thread_id": "thread_spec_001",
            "artifact_id": "spec_001",
            "messages": [
                {"author": "bob_designer", "role": "designer", "content": "Do we need to support OTP as well?", "attachments": [], "mentions": ["alice_pm"]},
                {"author": "alice_pm", "role": "pm", "content": "Good question. Let's keep it simple for v1 - email/password + OAuth2 only. OTP can be v2.", "attachments": [], "mentions": []},
                {"author": "charlie_dev", "role": "dev", "content": "For the OAuth flow, should we use the implicit grant or authorization code with PKCE?", "attachments": [], "mentions": []},
                {"author": "alice_pm", "role": "pm", "content": "Authorization code with PKCE is the recommended approach. Let's go with that.", "attachments": [], "mentions": ["charlie_dev"]},
                {"author": "diana_frontend", "role": "frontend", "content": "What's the session timeout? Need to know for the token refresh UI.", "attachments": [], "mentions": []},
                {"author": "charlie_dev", "role": "dev", "content": "Access token: 1 hour. Refresh token: 7 days. I'll add the refresh endpoint.", "attachments": [], "mentions": []},
            ],
        },
        {
            "thread_id": "thread_design_001",
            "artifact_id": "design_001",
            "messages": [
                {"author": "diana_frontend", "role": "frontend", "content": "The padding on the login button looks off. Should be 16px vertical, 32px horizontal based on the design system.", "attachments": [], "mentions": ["bob_designer"]},
                {"author": "bob_designer", "role": "designer", "content": "Good catch. Updated the Figma frame. Here's the new spec: https://figma.com/file/abc123?node-id=5:8", "attachments": [], "mentions": []},
                {"author": "charlie_dev", "role": "dev", "content": "The error state design - should the error message appear inline below the input or as a toast?", "attachments": [], "mentions": ["bob_designer"]},
                {"author": "bob_designer", "role": "designer", "content": "Inline below the input for form validation errors. Toast for server errors like 'network error'.", "attachments": [], "mentions": []},
            ],
        },
    ]

    for tdata in demo_messages:
        existing = conn.execute("SELECT id FROM threads WHERE artifact_id = ?", (tdata["artifact_id"],)).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO threads (id, artifact_id, resolved, last_message_at) VALUES (?, ?, 0, ?)",
                (tdata["thread_id"], tdata["artifact_id"], now - 1800),
            )
            for m in tdata["messages"]:
                conn.execute(
                    """INSERT INTO messages (id, thread_id, author, role, content, attachments, mentions, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        f"msg_{tdata['artifact_id']}_{tdata['messages'].index(m)}",
                        tdata["thread_id"],
                        m["author"],
                        m["role"],
                        m["content"],
                        json.dumps(m["attachments"]),
                        json.dumps(m["mentions"]),
                        now - 3600 + tdata["messages"].index(m) * 600,
                    ),
                )

    conn.commit()
    conn.close()
    print("Demo data seeded successfully")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "seed":
        seed_demo_data()
    else:
        init_database()
        seed_demo_data()
