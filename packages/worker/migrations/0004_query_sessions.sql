-- Migration number: 0004 	 2026-02-14T00:00:00.000Z
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

