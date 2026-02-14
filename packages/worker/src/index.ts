/**
 * VibeDB Worker 入口
 * API 服务：数据库连接管理、AI 查询等
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { databaseRoutes } from './routes/database';
import { fileRoutes } from './routes/file-routes';
import { queryRoutes } from './routes/query';
import { savedQueryRoutes } from './routes/saved-query-routes';
import type { Env } from './types';

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

// 文件浏览路由
app.route('/api/v1/files', fileRoutes);

// 保存查询路由
app.route('/api/v1/saved-queries', savedQueryRoutes);

export default app;
