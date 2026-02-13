import type { TableColumn, TableQueryFilters } from '../../types';
import { parseSearchExpression, expressionToSql, expressionToSqlPg, type ParsedExpression } from '../search-parser';
import { getColumnFieldNames } from './helpers';

interface WhereClauseResult {
  whereClause: string;
  params: unknown[];
}

type LoadSchema = () => Promise<TableColumn[]>;

interface DialectOptions {
  startIndex: number;
  requireNumericSearchValue: boolean;
  buildExpressionSql: (
    expression: ParsedExpression,
    validColumns: string[],
    startIndex: number,
  ) => { whereClause: string; params: Array<string | number> } | null;
  buildTextSearchCondition: (field: string, index: number) => string;
  buildNumericSearchCondition: (field: string, index: number) => string;
  buildEqualsCondition: (field: string, index: number) => string;
}

const TEXT_LIKE_TYPES = ['char', 'text', 'date', 'time'];
const NUMERIC_EQUAL_TYPES = ['int', 'float', 'double', 'decimal', 'real', 'numeric'];

function isTextLikeType(type: string): boolean {
  return TEXT_LIKE_TYPES.some((keyword) => type.includes(keyword));
}

function isNumericLikeType(type: string): boolean {
  return NUMERIC_EQUAL_TYPES.some((keyword) => type.includes(keyword));
}

async function buildWhereClauseByDialect(
  filters: TableQueryFilters | undefined,
  loadSchema: LoadSchema,
  options: DialectOptions,
) {
  if (!filters || Object.keys(filters).length === 0) {
    return { whereClause: '', params: [] } satisfies WhereClauseResult;
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  const search = filters._search;
  let parameterIndex = options.startIndex;
  let schemaCache: TableColumn[] | null = null;

  async function getSchema() {
    if (!schemaCache) {
      schemaCache = await loadSchema();
    }

    return schemaCache;
  }

  if (search) {
    const parsed = parseSearchExpression(search);

    if (parsed.isExpression && parsed.expression) {
      const schema = await getSchema();
      const validColumns = getColumnFieldNames(schema);
      const sqlResult = options.buildExpressionSql(parsed.expression, validColumns, options.startIndex);

      if (sqlResult) {
        return { whereClause: sqlResult.whereClause, params: sqlResult.params } satisfies WhereClauseResult;
      }
    }

    if (!parsed.isExpression || !parsed.expression) {
      const schema = await getSchema();
      const searchConditions: string[] = [];

      schema.forEach((column) => {
        const type = (column.Type || '').toLowerCase();
        if (isTextLikeType(type)) {
          searchConditions.push(options.buildTextSearchCondition(column.Field, parameterIndex));
          params.push(`%${search}%`);
          parameterIndex += 1;
          return;
        }

        if (isNumericLikeType(type)) {
          if (options.requireNumericSearchValue && Number.isNaN(Number(search))) {
            return;
          }

          searchConditions.push(options.buildNumericSearchCondition(column.Field, parameterIndex));
          params.push(search);
          parameterIndex += 1;
        }
      });

      if (searchConditions.length > 0) {
        conditions.push(`(${searchConditions.join(' OR ')})`);
      }
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key === '_search') {
      continue;
    }

    if (value !== undefined && value !== '') {
      conditions.push(options.buildEqualsCondition(key, parameterIndex));
      params.push(value);
      parameterIndex += 1;
    }
  }

  if (conditions.length > 0) {
    return { whereClause: `WHERE ${conditions.join(' AND ')}`, params } satisfies WhereClauseResult;
  }

  return { whereClause: '', params: [] } satisfies WhereClauseResult;
}

export async function buildQuestionMarkWhereClause(filters: TableQueryFilters | undefined, loadSchema: LoadSchema) {
  return buildWhereClauseByDialect(filters, loadSchema, {
    startIndex: 1,
    requireNumericSearchValue: false,
    buildExpressionSql: (expression, validColumns) => expressionToSql(expression, validColumns),
    buildTextSearchCondition: (field) => `\`${field}\` LIKE ?`,
    buildNumericSearchCondition: (field) => `\`${field}\` = ?`,
    buildEqualsCondition: (field) => `\`${field}\` = ?`,
  });
}

export async function buildPostgresWhereClause(
  filters: TableQueryFilters | undefined,
  loadSchema: LoadSchema,
  startIndex: number = 1,
) {
  return buildWhereClauseByDialect(filters, loadSchema, {
    startIndex,
    requireNumericSearchValue: true,
    buildExpressionSql: (expression, validColumns, initialIndex) => expressionToSqlPg(expression, validColumns, initialIndex),
    buildTextSearchCondition: (field, index) => `"${field}"::text LIKE $${index}`,
    buildNumericSearchCondition: (field, index) => `"${field}" = $${index}`,
    buildEqualsCondition: (field, index) => `"${field}" = $${index}`,
  });
}
