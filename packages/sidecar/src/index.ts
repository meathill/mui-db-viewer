import { serve } from '@hono/node-server';
import { createSidecarApp } from './app';
import { SIDECAR_HOST, SIDECAR_PORT } from './config';

const app = createSidecarApp();

// biome-ignore lint/suspicious/noConsole: sidecar 启动信息
console.log(`[sidecar] listening on http://${SIDECAR_HOST}:${SIDECAR_PORT}`);

serve({
  fetch: app.fetch,
  port: SIDECAR_PORT,
  hostname: SIDECAR_HOST,
});
