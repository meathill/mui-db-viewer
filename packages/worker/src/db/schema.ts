import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const databaseConnections = sqliteTable('database_connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  host: text('host').notNull(),
  port: text('port').notNull(),
  databaseName: text('database_name').notNull(),
  username: text('username').notNull(),
  keyPath: text('key_path').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const savedQueries = sqliteTable('saved_queries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  sql: text('sql').notNull(),
  databaseId: text('database_id')
    .notNull()
    .references(() => databaseConnections.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const databaseSchemaCache = sqliteTable(
  'database_schema_cache',
  {
    databaseId: text('database_id')
      .primaryKey()
      .references(() => databaseConnections.id, { onDelete: 'cascade' }),
    schemaText: text('schema_text').notNull(),
    updatedAt: integer('updated_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => ({
    expiresAtIndex: index('idx_database_schema_cache_expires_at').on(table.expiresAt),
  }),
);

export const querySessions = sqliteTable(
  'query_sessions',
  {
    id: text('id').primaryKey(),
    databaseId: text('database_id')
      .notNull()
      .references(() => databaseConnections.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    preview: text('preview').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    databaseIdIndex: index('idx_query_sessions_database_id').on(table.databaseId),
    updatedAtIndex: index('idx_query_sessions_updated_at').on(table.updatedAt),
  }),
);

export const querySessionMessages = sqliteTable(
  'query_session_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => querySessions.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    sql: text('sql'),
    warning: text('warning'),
    error: text('error'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    sessionIdSequenceIndex: index('idx_query_session_messages_session_id_sequence').on(table.sessionId, table.sequence),
  }),
);

export type DatabaseConnectionRow = typeof databaseConnections.$inferSelect;
export type NewDatabaseConnectionRow = typeof databaseConnections.$inferInsert;
