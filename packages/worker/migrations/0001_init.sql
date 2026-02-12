-- Migration number: 0001 	 2024-02-12T03:00:00.000Z
DROP TABLE IF EXISTS database_connections;
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
