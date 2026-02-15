import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { ApiResponse } from '../types';
import {
  handleCreateDatabaseConnection,
  handleDeleteDatabaseConnection,
  handleGetDatabaseConnection,
  handleListDatabaseConnections,
} from './database-connection-handlers';
import {
  handleExecuteSql,
  handleGetDatabaseSchema,
  handleGetTableData,
  handleGetTables,
  handleRefreshDatabaseSchema,
  loadTableData,
  type TableDataResponse,
} from './database-query-handlers';
import { parseCreateDatabaseRequest, parseValidateSqlRequest } from './request-validation';

export { loadTableData };
export type { TableDataResponse };

export const databaseConnectionRoutes = new Hono<{ Bindings: CloudflareBindings }>();

databaseConnectionRoutes.post(
  '/:id/query',
  validator('json', (body, c) => {
    const result = parseValidateSqlRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  handleExecuteSql,
);

databaseConnectionRoutes.post(
  '/',
  validator('json', (body, c) => {
    const result = parseCreateDatabaseRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  handleCreateDatabaseConnection,
);

databaseConnectionRoutes.get('/', handleListDatabaseConnections);

databaseConnectionRoutes.get('/:id', handleGetDatabaseConnection);

databaseConnectionRoutes.delete('/:id', handleDeleteDatabaseConnection);

databaseConnectionRoutes.get('/:id/schema', handleGetDatabaseSchema);

databaseConnectionRoutes.post('/:id/schema/refresh', handleRefreshDatabaseSchema);

databaseConnectionRoutes.get('/:id/tables', handleGetTables);

databaseConnectionRoutes.get('/:id/tables/:tableName/data', handleGetTableData);
