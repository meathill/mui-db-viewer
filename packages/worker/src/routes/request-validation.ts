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

const createDatabaseRequiredFieldsSchema = z.object({
  name: nonEmptyStringSchema,
  type: databaseTypeSchema,
  host: nonEmptyStringSchema,
  database: nonEmptyStringSchema,
  username: nonEmptyStringSchema,
  password: nonEmptyStringSchema,
});

const createDatabasePayloadSchema = createDatabaseRequiredFieldsSchema.extend({
  port: z.string().optional(),
});

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
  databaseId: nonEmptyStringSchema,
  prompt: nonEmptyStringSchema,
});

const validateSqlRequestSchema = z.object({
  sql: nonEmptyStringSchema,
});

function isNonEmptyString(value: unknown): value is string {
  return nonEmptyStringSchema.safeParse(value).success;
}

export function hasRequiredCreateFields(payload: unknown): payload is CreateDatabaseRequest {
  return createDatabaseRequiredFieldsSchema.safeParse(payload).success;
}

export function parseCreateDatabaseRequest(payload: unknown): ValidationResult<CreateDatabaseRequest> {
  const result = createDatabasePayloadSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, error: '缺少必填字段' };
  }

  const port = isNonEmptyString(result.data.port) ? result.data.port : '3306';

  return {
    success: true,
    data: {
      name: result.data.name,
      type: result.data.type,
      host: result.data.host,
      port,
      database: result.data.database,
      username: result.data.username,
      password: result.data.password,
    },
  };
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

export function parseGenerateSqlRequest(payload: unknown): ValidationResult<{ databaseId: string; prompt: string }> {
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
