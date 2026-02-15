import type { Context } from 'hono';

export type WorkerContext = Context<{ Bindings: CloudflareBindings }>;

export interface CreateQuerySessionBody {
  databaseId: string;
  title: string;
  preview?: string;
  messages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    warning?: string;
    error?: string;
  }>;
}

export interface AppendQuerySessionMessagesBody {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    warning?: string;
    error?: string;
  }>;
}

export interface UpdateQuerySessionBody {
  title?: string;
}
