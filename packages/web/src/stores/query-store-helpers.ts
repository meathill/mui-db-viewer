import type { QuerySessionMessageRole } from '@/lib/api';
import type { QueryMessage } from './query-store-types';

export function createMessageId(): string {
  return crypto.randomUUID();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '未知错误';
}

export function createSessionTitle(prompt: string): string {
  const text = prompt.trim().replaceAll(/\s+/g, ' ');
  if (!text) return '未命名查询';
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

export function toApiMessage(message: QueryMessage): {
  id: string;
  role: QuerySessionMessageRole;
  content: string;
  sql?: string;
  warning?: string;
  error?: string;
} {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sql: message.sql,
    warning: message.warning,
    error: message.error,
  };
}
