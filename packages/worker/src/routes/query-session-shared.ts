import type { QuerySession, QuerySessionMessage } from '../types';

export interface QuerySessionRow {
  id: string;
  database_id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
}

export interface QuerySessionMessageRow {
  id: string;
  session_id: string;
  sequence: number;
  role: 'user' | 'assistant';
  content: string;
  sql?: string | null;
  warning?: string | null;
  error?: string | null;
  created_at: string;
}

export interface QuerySessionCursor {
  updatedAt: string;
  id: string;
}

export interface QuerySessionListResponse {
  sessions: QuerySession[];
  nextCursor: QuerySessionCursor | null;
  hasMore: boolean;
}

export interface QuerySessionDetailResponse {
  session: QuerySession;
  messages: QuerySessionMessage[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function toQuerySession(row: QuerySessionRow): QuerySession {
  return {
    id: row.id,
    databaseId: row.database_id,
    title: row.title,
    preview: row.preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toQuerySessionMessage(row: QuerySessionMessageRow): QuerySessionMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: Number(row.sequence),
    role: row.role,
    content: row.content,
    sql: row.sql ?? undefined,
    warning: row.warning ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
  };
}

export function clampLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? String(DEFAULT_LIMIT), 10);
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

export function normalizeSearch(value: string | undefined): string | null {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : null;
}

export function derivePreviewFromMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  const source = lastUser?.content.trim() ?? messages[0]?.content?.trim() ?? '';
  return source.slice(0, 160);
}

export function deriveCursorFromSessions(sessions: QuerySession[]): QuerySessionCursor | null {
  if (sessions.length === 0) return null;
  const last = sessions[sessions.length - 1];
  return { updatedAt: last.updatedAt, id: last.id };
}
