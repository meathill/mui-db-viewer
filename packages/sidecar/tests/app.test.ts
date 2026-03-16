import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createSidecarApp } from '@/app';

const tempDirs: string[] = [];

function createTempDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'mui-db-viewer-sidecar-app-'));
  const path = join(dir, 'fixture.sqlite');
  const db = new DatabaseSync(path);

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    INSERT INTO users (name) VALUES ('Alice');
  `);
  db.close();

  tempDirs.push(dir);
  return path;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('sidecar app', () => {
  it('GET /health 返回运行状态', async () => {
    const app = createSidecarApp();

    const response = await app.request('/health');
    const json = (await response.json()) as {
      ok: boolean;
      host: string;
      port: number;
      runtime: string;
      now: string;
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.runtime).toBe('node:sqlite');
    expect(typeof json.now).toBe('string');
  });

  it('POST /api/v1/sqlite/query 应返回查询结果', async () => {
    const app = createSidecarApp();
    const dbPath = createTempDatabase();

    const response = await app.request('/api/v1/sqlite/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: dbPath,
        sql: 'SELECT id, name FROM users ORDER BY id',
      }),
    });

    const json = (await response.json()) as {
      rows: Array<{ id: number; name: string }>;
      total: number;
      columns: Array<{ Field: string; Type: string }>;
    };

    expect(response.status).toBe(200);
    expect(json.total).toBe(1);
    expect(json.rows).toEqual([{ id: 1, name: 'Alice' }]);
    expect(json.columns.map((column) => column.Field)).toEqual(['id', 'name']);
  });

  it('POST /api/v1/sqlite/query 应支持参数化查询', async () => {
    const app = createSidecarApp();
    const dbPath = createTempDatabase();

    const response = await app.request('/api/v1/sqlite/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: dbPath,
        sql: 'SELECT name FROM users WHERE id = ?',
        params: [1],
      }),
    });

    const json = (await response.json()) as {
      rows: Array<{ name: string }>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(json.rows).toEqual([{ name: 'Alice' }]);
    expect(json.total).toBe(1);
  });

  it('POST /api/v1/sqlite/query 文件不存在时返回 400', async () => {
    const app = createSidecarApp();

    const response = await app.request('/api/v1/sqlite/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/tmp/not-found.sqlite',
        sql: 'SELECT 1',
      }),
    });

    const json = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(json.error).toContain('SQLite 文件不存在');
  });

  it('未知路由返回 404', async () => {
    const app = createSidecarApp();

    const response = await app.request('/missing');
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(json.error).toBe('Not Found');
  });
});
