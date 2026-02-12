import type { TableColumn, TableQueryFilters } from '../../types';
import { parseSearchExpression, expressionToSql } from '../search-parser';
import { getColumnFieldNames } from './helpers';

interface WhereClauseResult {
  whereClause: string;
  params: unknown[];
}

type LoadSchema = () => Promise<TableColumn[]>;

const TEXT_LIKE_TYPES = ['char', 'text', 'date', 'time'];
const NUMERIC_EQUAL_TYPES = ['int', 'float', 'double', 'decimal', 'real', 'numeric'];

function isTextLikeType(type: string): boolean {
  return TEXT_LIKE_TYPES.some((keyword) => type.includes(keyword));
}

function isNumericLikeType(type: string): boolean {
  return NUMERIC_EQUAL_TYPES.some((keyword) => type.includes(keyword));
}

export async function buildQuestionMarkWhereClause(filters: TableQueryFilters | undefined, loadSchema: LoadSchema) {
  if (!filters || Object.keys(filters).length === 0) {
    return { whereClause: '', params: [] } satisfies WhereClauseResult;
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  const search = filters._search;
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
      const sqlResult = expressionToSql(parsed.expression, validColumns);

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
          searchConditions.push(`\`${column.Field}\` LIKE ?`);
          params.push(`%${search}%`);
          return;
        }

        if (isNumericLikeType(type)) {
          searchConditions.push(`\`${column.Field}\` = ?`);
          params.push(search);
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
      conditions.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }

  if (conditions.length > 0) {
    return { whereClause: `WHERE ${conditions.join(' AND ')}`, params } satisfies WhereClauseResult;
  }

  return { whereClause: '', params: [] } satisfies WhereClauseResult;
}
