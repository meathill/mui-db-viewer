import type { SqlExecutionRequest, SqlParameterValue } from './api-types';

export type SqlParameterFieldKind = 'positional' | 'named';
export type SqlParameterInputType = 'text' | 'number' | 'boolean' | 'null';

export interface SqlParameterDraft {
  type: SqlParameterInputType;
  value: string;
}

interface SqlParameterToken {
  key: string;
}

export interface SqlParameterField {
  key: string;
  kind: SqlParameterFieldKind;
  label: string;
  name: string | null;
  order: number;
  occurrences: number;
}

export interface ParsedSqlParameters {
  normalizedSql: string;
  tokens: SqlParameterToken[];
  fields: SqlParameterField[];
}

function isIdentifierStart(char: string | undefined): boolean {
  return typeof char === 'string' && /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string | undefined): boolean {
  return typeof char === 'string' && /[A-Za-z0-9_]/.test(char);
}

function createPositionalField(index: number): SqlParameterField {
  return {
    key: `pos:${index}`,
    kind: 'positional',
    label: `参数 ${index}`,
    name: null,
    order: index,
    occurrences: 1,
  };
}

function createNamedField(name: string, order: number): SqlParameterField {
  return {
    key: `named:${name}`,
    kind: 'named',
    label: name,
    name,
    order,
    occurrences: 1,
  };
}

export function createDefaultSqlParameterDraft(): SqlParameterDraft {
  return {
    type: 'text',
    value: '',
  };
}

export function syncSqlParameterDrafts(
  fields: SqlParameterField[],
  previous: Record<string, SqlParameterDraft>,
): Record<string, SqlParameterDraft> {
  let changed = false;
  const next: Record<string, SqlParameterDraft> = {};

  for (const field of fields) {
    const existing = previous[field.key];
    if (existing) {
      next[field.key] = existing;
      continue;
    }

    next[field.key] = createDefaultSqlParameterDraft();
    changed = true;
  }

  if (!changed && Object.keys(previous).length === fields.length) {
    return previous;
  }

  return next;
}

export function parseSqlParameters(sql: string): ParsedSqlParameters {
  const fields: SqlParameterField[] = [];
  const fieldMap = new Map<string, SqlParameterField>();
  const tokens: SqlParameterToken[] = [];
  let positionalIndex = 0;
  let namedOrder = 0;
  let normalizedSql = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      normalizedSql += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      normalizedSql += char;
      if (char === '*' && next === '/') {
        normalizedSql += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      if (char === '-' && next === '-') {
        normalizedSql += '--';
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        normalizedSql += '/*';
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDoubleQuote && !inBacktickQuote && char === "'") {
      const escaped = inSingleQuote && next === "'";
      normalizedSql += char;
      if (escaped) {
        normalizedSql += next;
        index += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inBacktickQuote && char === '"') {
      const escaped = inDoubleQuote && next === '"';
      normalizedSql += char;
      if (escaped) {
        normalizedSql += next;
        index += 1;
      } else {
        inDoubleQuote = !inDoubleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '`') {
      inBacktickQuote = !inBacktickQuote;
      normalizedSql += char;
      continue;
    }

    const canParseToken = !inSingleQuote && !inDoubleQuote && !inBacktickQuote;
    if (canParseToken && char === '?') {
      positionalIndex += 1;
      const field = createPositionalField(positionalIndex);
      fields.push(field);
      tokens.push({ key: field.key });
      normalizedSql += '?';
      continue;
    }

    const isNamedMarker = canParseToken && (char === ':' || char === '@' || char === '$');
    const isValidNamedToken =
      isNamedMarker &&
      isIdentifierStart(next) &&
      !(char === ':' && sql[index - 1] === ':') &&
      !(char === '$' && /\d/.test(next ?? ''));

    if (isValidNamedToken) {
      let end = index + 1;
      while (isIdentifierPart(sql[end])) {
        end += 1;
      }

      if (!(char === '$' && sql[end] === '$')) {
        const name = sql.slice(index + 1, end);
        const key = `named:${name}`;
        let field = fieldMap.get(key);
        if (field) {
          field.occurrences += 1;
        } else {
          namedOrder += 1;
          field = createNamedField(name, positionalIndex + namedOrder);
          fieldMap.set(key, field);
          fields.push(field);
        }
        tokens.push({ key });
        normalizedSql += '?';
        index = end - 1;
        continue;
      }
    }

    normalizedSql += char;
  }

  return {
    normalizedSql,
    tokens,
    fields,
  };
}

function toSqlParameterValue(field: SqlParameterField, draft?: SqlParameterDraft): SqlParameterValue {
  const current = draft ?? createDefaultSqlParameterDraft();

  if (current.type === 'null') {
    return null;
  }

  if (current.type === 'boolean') {
    if (current.value === 'true') {
      return true;
    }

    if (current.value === 'false') {
      return false;
    }

    throw new Error(`${field.label} 需要选择 true 或 false`);
  }

  if (current.type === 'number') {
    const trimmed = current.value.trim();
    if (!trimmed) {
      throw new Error(`${field.label} 需要填写数字`);
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      throw new Error(`${field.label} 不是有效数字`);
    }
    return value;
  }

  return current.value;
}

export function buildSqlExecutionRequest(
  sql: string,
  drafts: Record<string, SqlParameterDraft>,
  parsed = parseSqlParameters(sql),
): SqlExecutionRequest {
  const fieldMap = new Map(parsed.fields.map((field) => [field.key, field] as const));
  const params = parsed.tokens.map((token) => {
    const field = fieldMap.get(token.key);
    if (!field) {
      throw new Error(`缺少参数定义：${token.key}`);
    }

    return toSqlParameterValue(field, drafts[token.key]);
  });

  return {
    sql: parsed.normalizedSql,
    params,
  };
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      if (char === '-' && next === '-') {
        current += '--';
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        current += '/*';
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDoubleQuote && !inBacktickQuote && char === "'") {
      const escaped = inSingleQuote && next === "'";
      current += char;
      if (escaped) {
        current += next;
        index += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inBacktickQuote && char === '"') {
      const escaped = inDoubleQuote && next === '"';
      current += char;
      if (escaped) {
        current += next;
        index += 1;
      } else {
        inDoubleQuote = !inDoubleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '`') {
      inBacktickQuote = !inBacktickQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote && char === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}
