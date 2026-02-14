-- Migration number: 0003 	 2026-02-14T00:00:00.000Z
CREATE TABLE database_schema_cache (
  database_id TEXT PRIMARY KEY,
  schema_text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_database_schema_cache_expires_at ON database_schema_cache(expires_at);

