/**
 * VibeDB Worker 入口
 * API 服务：数据库连接管理、AI 查询等
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { databaseRoutes } from './routes/database';
import { queryRoutes } from './routes/query';

interface Env {
  HSM_URL: string;
  HSM_SECRET: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS 支持开发环境
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3015'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }),
);

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 数据库路由
app.route('/api/v1/databases', databaseRoutes);

// 查询路由
app.route('/api/v1/query', queryRoutes);

export default app;
