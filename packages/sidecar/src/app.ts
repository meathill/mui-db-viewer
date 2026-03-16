import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SIDECAR_HOST, SIDECAR_PORT } from './config';
import { executeSqliteQuery, sqliteQuerySchema } from './sqlite-executor';

export function createSidecarApp() {
  const app = new Hono();

  app.use('*', cors());

  app.get('/health', (c) => {
    return c.json({
      ok: true,
      host: SIDECAR_HOST,
      port: SIDECAR_PORT,
      runtime: 'node:sqlite',
      now: new Date().toISOString(),
    });
  });

  app.post('/api/v1/sqlite/query', zValidator('json', sqliteQuerySchema), async (c) => {
    const { path, sql, params } = c.req.valid('json');

    try {
      const result = executeSqliteQuery(path, sql, params);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return c.json({ error: message }, 400);
    }
  });

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  app.onError((error, c) => {
    const message = error.message || 'Server Error';
    // biome-ignore lint/suspicious/noConsole: sidecar 错误需要打印
    console.error(`[sidecar] error: ${message}`);
    return c.json({ error: message }, 500);
  });

  return app;
}
