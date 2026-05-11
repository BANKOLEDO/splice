CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'dev' CHECK(role IN ('dev', 'designer', 'pm', 'backend', 'frontend')),
    created_at INTEGER NOT NULL,
    last_login INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('spec', 'design', 'api', 'ui', 'task', 'question')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    owner_role TEXT NOT NULL CHECK(owner_role IN ('design', 'dev', 'pm', 'backend', 'frontend')),
    status TEXT NOT NULL CHECK(status IN ('draft', 'needs_review', 'approved', 'blocked', 'done')),
    dependencies TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(owner_role);
CREATE INDEX IF NOT EXISTS idx_artifacts_updated ON artifacts(updated_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);

CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    resolved BOOLEAN DEFAULT 0,
    last_message_at INTEGER,
    FOREIGN KEY(artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_threads_artifact ON threads(artifact_id);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    author TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('dev', 'designer', 'pm', 'backend', 'frontend')),
    content TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',
    mentions TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL,
    FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS sync_points (
    id TEXT PRIMARY KEY,
    source_tool TEXT NOT NULL CHECK(source_tool IN ('figma', 'github', 'linear', 'slack', 'custom')),
    source_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('import', 'export', 'bidirectional')),
    last_sync INTEGER,
    UNIQUE(source_tool, source_id)
);

CREATE TABLE IF NOT EXISTS active_users (
    user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    current_artifact TEXT,
    current_cursor TEXT DEFAULT '{}',
    last_seen INTEGER NOT NULL,
    websocket_id TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    artifact_id TEXT,
    size INTEGER,
    created_at INTEGER
);

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
