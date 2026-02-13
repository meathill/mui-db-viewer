-- Migration number: 0002 	 2026-02-13T00:00:00.000Z
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
