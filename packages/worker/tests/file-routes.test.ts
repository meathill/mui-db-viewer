import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { fileRoutes } from '@/routes/file-routes';

const tempDirs: string[] = [];

function createApp() {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.route('/files', fileRoutes);
  return app;
}

function createTempDirectory() {
  const dir = mkdtempSync(join(tmpdir(), 'mui-db-viewer-files-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('file routes', () => {
  it('GET /files 应返回目录与 SQLite 文件，并过滤隐藏项', async () => {
    const dir = createTempDirectory();
    mkdirSync(join(dir, 'alpha'));
    mkdirSync(join(dir, 'beta'));
    writeFileSync(join(dir, 'main.sqlite'), 'sqlite');
    writeFileSync(join(dir, 'backup.db'), 'sqlite');
    writeFileSync(join(dir, 'note.txt'), 'text');
    writeFileSync(join(dir, '.secret.db'), 'sqlite');

    const app = createApp();
    const response = await app.request(`/files?path=${encodeURIComponent(dir)}`);
    const json = (await response.json()) as {
      success: boolean;
      data: {
        currentPath: string;
        parentPath: string;
        files: Array<{ name: string; isDirectory: boolean; size?: number }>;
      };
    };

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.currentPath).toBe(dir);
    expect(json.data.parentPath).toBe(dirname(dir));
    expect(json.data.files.map((item) => item.name)).toEqual(['alpha', 'beta', 'backup.db', 'main.sqlite']);
    expect(json.data.files[0]?.isDirectory).toBe(true);
    expect(json.data.files[2]?.size).toBeGreaterThan(0);
  });

  it('GET /files 查询文件路径时返回 400', async () => {
    const dir = createTempDirectory();
    const filePath = join(dir, 'single.sqlite');
    writeFileSync(filePath, 'sqlite');

    const app = createApp();
    const response = await app.request(`/files?path=${encodeURIComponent(filePath)}`);
    const json = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('路径不是目录');
  });

  it('GET /files 目录不存在时返回 500', async () => {
    const app = createApp();
    const response = await app.request('/files?path=%2Ftmp%2Fmissing-mui-db-viewer-dir');
    const json = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toContain('ENOENT');
  });
});
