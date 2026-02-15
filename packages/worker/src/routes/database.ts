/**
 * 数据库连接配置路由
 * 实现密码的 HSM 加密存储与数据浏览能力
 */

import { Hono } from 'hono';
import { databaseConnectionRoutes, loadTableData } from './database-connection-routes';
import { databaseRowRoutes } from './database-row-routes';

const databaseRoutes = new Hono<{ Bindings: CloudflareBindings }>();

databaseRoutes.route('/', databaseConnectionRoutes);
databaseRoutes.route('/', databaseRowRoutes);

export { databaseRoutes, loadTableData };
