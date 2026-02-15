-- Migration number: 0001 	 2026-02-15T00:00:00.000Z
CREATE TABLE database_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  host TEXT NOT NULL,
  port TEXT NOT NULL,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  key_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE saved_queries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sql TEXT NOT NULL,
  database_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE CASCADE
);

CREATE TABLE database_schema_cache (
  database_id TEXT PRIMARY KEY,
  schema_text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_database_schema_cache_expires_at ON database_schema_cache(expires_at);

CREATE TABLE query_sessions (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL,
  title TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_query_sessions_database_id ON query_sessions(database_id);
CREATE INDEX idx_query_sessions_updated_at ON query_sessions(updated_at);

CREATE TABLE query_session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sql TEXT,
  warning TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES query_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_query_session_messages_session_id_sequence ON query_session_messages(session_id, sequence);
