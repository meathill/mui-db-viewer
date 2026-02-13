import { z } from 'zod';
import { DATABASE_TYPES, type CreateDatabaseRequest, type RowUpdate } from '../types';

interface ValidationSuccess<T> {
  success: true;
  data: T;
}

interface ValidationFailure {
  success: false;
  error: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const nonEmptyStringSchema = z.string().trim().min(1);
const databaseTypeSchema = z.enum(DATABASE_TYPES);
const rowIdSchema = z.union([z.string(), z.number()]);
const plainObjectSchema = z.object({}).catchall(z.unknown());

const baseCreateDatabaseSchema = z.object({
  name: nonEmptyStringSchema,
  type: databaseTypeSchema,
  host: z.string().optional().default(''),
  port: z.string().optional().default(''),
  database: nonEmptyStringSchema,
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
});

const createDatabasePayloadSchema = baseCreateDatabaseSchema.superRefine((data, ctx) => {
  if (data.type === 'sqlite') return;

  if (!data.host || data.host.trim().length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '主机地址不能为空', path: ['host'] });
  }
  if (!data.username || data.username.trim().length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '用户名不能为空', path: ['username'] });
  }
  if (!data.password || data.password.trim().length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '密码不能为空', path: ['password'] });
  }
});

const createDatabaseRequiredFieldsSchema = baseCreateDatabaseSchema;

export function hasRequiredCreateFields(payload: unknown): payload is CreateDatabaseRequest {
  return createDatabaseRequiredFieldsSchema.safeParse(payload).success;
}

export function parseCreateDatabaseRequest(payload: unknown): ValidationResult<CreateDatabaseRequest> {
  const result = createDatabasePayloadSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '缺少必填字段' };
  }

  const isSqlite = result.data.type === 'sqlite';
  const port = isSqlite ? '' : result.data.port && result.data.port.trim() ? result.data.port : '3306';

  return {
    success: true,
    data: {
      name: result.data.name,
      type: result.data.type,
      host: result.data.host ?? '',
      port,
      database: result.data.database,
      username: result.data.username ?? '',
      password: result.data.password ?? '',
    },
  };
}

const rowIdArraySchema = z.array(rowIdSchema).nonempty();
const rowUpdateSchema = z.object({
  pk: rowIdSchema,
  data: plainObjectSchema,
});
const rowUpdateArraySchema = z.array(rowUpdateSchema).nonempty();

const deleteRowsRequestSchema = z.object({
  ids: rowIdArraySchema,
});

const updateRowsRequestSchema = z.object({
  rows: rowUpdateArraySchema,
});

const generateSqlRequestSchema = z.object({
  databaseId: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  provider: z.enum(['openai', 'gemini', 'replicate']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
});

const validateSqlRequestSchema = z.object({
  sql: z.string().trim().min(1),
});

const createSavedQuerySchema = z.object({
  name: nonEmptyStringSchema,
  description: z.string().optional(),
  sql: nonEmptyStringSchema,
  databaseId: nonEmptyStringSchema,
});

const updateSavedQuerySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  sql: z.string().trim().min(1).optional(),
});

export function parseCreateSavedQueryRequest(
  payload: unknown,
): ValidationResult<{ name: string; description?: string; sql: string; databaseId: string }> {
  const result = createSavedQuerySchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '缺少必填字段' };
  }
  return { success: true, data: result.data };
}

export function parseUpdateSavedQueryRequest(
  payload: unknown,
): ValidationResult<{ name?: string; description?: string; sql?: string }> {
  const result = updateSavedQuerySchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '无效的更新数据' };
  }
  return { success: true, data: result.data };
}

export function isValidRowIdArray(value: unknown): value is Array<string | number> {
  return rowIdArraySchema.safeParse(value).success;
}

export function parseDeleteRowsRequest(payload: unknown): ValidationResult<{ ids: Array<string | number> }> {
  const result = deleteRowsRequestSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '请选择要删除的行' };
  }

  return { success: true, data: result.data };
}

export function parseInsertRowRequest(payload: unknown): ValidationResult<Record<string, unknown>> {
  const result = plainObjectSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '无效的数据格式' };
  }

  return { success: true, data: result.data };
}

export function isRowUpdateArray(value: unknown): value is RowUpdate[] {
  return rowUpdateArraySchema.safeParse(value).success;
}

export function parseUpdateRowsRequest(payload: unknown): ValidationResult<{ rows: RowUpdate[] }> {
  const result = updateRowsRequestSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '缺少有效的更新数据' };
  }

  return { success: true, data: result.data };
}

export function parseGenerateSqlRequest(payload: unknown): ValidationResult<{
  databaseId: string;
  prompt: string;
  provider?: 'openai' | 'gemini' | 'replicate';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}> {
  const result = generateSqlRequestSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '缺少 databaseId 或 prompt' };
  }

  return {
    success: true,
    data: result.data,
  };
}

export function parseValidateSqlRequest(payload: unknown): ValidationResult<{ sql: string }> {
  const result = validateSqlRequestSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '缺少 SQL' };
  }

  return { success: true, data: result.data };
}
