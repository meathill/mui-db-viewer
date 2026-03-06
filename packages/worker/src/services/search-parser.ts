/**
 * 搜索表达式解析器
 * 支持类似 `id > 100 && name = 'Alice'` 的表达式语法
 *
 * 支持的运算符：>, <, >=, <=, =, !=, LIKE
 * 支持的连接符：&& (AND), || (OR)
 * 值支持：数字、带引号的字符串、不带引号的字符串
 */

/** 单个过滤条件 */
export interface FilterCondition {
  field: string;
  operator: string;
  value: string | number | Array<string | number>;
}

/** 解析后的表达式组 */
export interface ParsedExpression {
  conditions: FilterCondition[];
  connectors: Array<'AND' | 'OR'>;
}

/** 解析结果 */
export interface ParseResult {
  /** 是否成功解析为表达式 */
  isExpression: boolean;
  /** 解析后的表达式（仅当 isExpression 为 true） */
  expression?: ParsedExpression;
  /** 原始搜索文本（当 isExpression 为 false 时用于全局搜索） */
  rawText?: string;
}

const OPERATORS = ['>=', '<=', '!=', '>', '<', '=', ' LIKE ', ' like ', ' IN ', ' in ', ' NOT IN ', ' not in '] as const;
const OPERATOR_PATTERN = /^(>=|<=|!=|>|<|=| LIKE | like | IN | in | NOT IN | not in )$/i;

/**
 * 判断输入是否包含表达式特征
 */
function looksLikeExpression(input: string): boolean {
  return /[><=!]/.test(input) || input.includes('&&') || input.includes('||') || / like /i.test(input) || / in\s*\(/i.test(input);
}

/**
 * 将值字符串转换为合适的类型
 */
function parseValue(raw: string): string | number {
  const trimmed = raw.trim();

  // 带引号的字符串
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // 尝试解析为数字
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') {
    return num;
  }

  // 其他情况作为字符串
  return trimmed;
}

/**
 * 解析单个条件表达式，如 `id > 100` 或 `name like '%Alice%'` 或 `id in (1, 2, 3)`
 */
function parseCondition(expr: string): FilterCondition | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;

  // 优先匹配 IN 和 NOT IN (包含前后确定的空格与括号)
  const inMatch = trimmed.match(/^(.*?)\s+(NOT\s+IN|IN|not\s+in|in)\s*\((.*)\)$/i);
  if (inMatch) {
    const field = inMatch[1].trim();
    const opRaw = inMatch[2].toUpperCase().replace(/\s+/g, ' '); // 统一为 'IN' 或 'NOT IN'
    const valuesStr = inMatch[3];
    const values = valuesStr.split(',').map(v => parseValue(v.trim())).filter(v => v !== '');
    if (field && values.length > 0) {
      return {
        field,
        operator: opRaw,
        value: values,
      };
    }
  }

  // 匹配 LIKE (包含前后空格，忽略大小写)
  const likeMatch = trimmed.match(/^(.*?)\s+(LIKE|like)\s+(.*)$/i);
  if (likeMatch) {
    const field = likeMatch[1].trim();
    const valueStr = likeMatch[3].trim();
    if (field && valueStr) {
      return {
        field,
        operator: 'LIKE', // 统一转换为大写
        value: parseValue(valueStr),
      };
    }
  }

  // 按其他运算符分割（优先匹配多字符运算符）
  const basicOperators = ['>=', '<=', '!=', '>', '<', '='];
  for (const op of basicOperators) {
    const idx = trimmed.indexOf(op);
    if (idx > 0) {
      const field = trimmed.substring(0, idx).trim();
      const valueStr = trimmed.substring(idx + op.length).trim();

      if (!field || !valueStr) continue;

      return {
        field,
        operator: op,
        value: parseValue(valueStr),
      };
    }
  }

  return null;
}

/**
 * 解析搜索表达式
 *
 * @param input 用户输入的搜索文本
 * @returns 解析结果
 */
export function parseSearchExpression(input: string): ParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { isExpression: false, rawText: '' };
  }

  // 快速判断是否像表达式
  if (!looksLikeExpression(trimmed)) {
    return { isExpression: false, rawText: trimmed };
  }

  // 按 && 和 || 分割
  const parts: string[] = [];
  const connectors: Array<'AND' | 'OR'> = [];

  // 用正则按 && 和 || 分割，同时记录连接符
  const segments = trimmed.split(/(&&|\|\|)/);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i].trim();
    if (seg === '&&') {
      connectors.push('AND');
    } else if (seg === '||') {
      connectors.push('OR');
    } else if (seg) {
      parts.push(seg);
    }
  }

  // 解析每个条件
  const conditions: FilterCondition[] = [];
  for (const part of parts) {
    const condition = parseCondition(part);
    if (!condition) {
      // 解析失败，回退到全局搜索
      return { isExpression: false, rawText: trimmed };
    }
    conditions.push(condition);
  }

  if (conditions.length === 0) {
    return { isExpression: false, rawText: trimmed };
  }

  return {
    isExpression: true,
    expression: { conditions, connectors },
  };
}

/**
 * 将 ParsedExpression 转换为参数化 SQL WHERE 子句
 *
 * @param expression 解析后的表达式
 * @param validColumns 合法的列名列表（用于防止 SQL 注入）
 * @returns WHERE 子句和参数数组，或在列名不合法时返回 null
 */
export function expressionToSql(
  expression: ParsedExpression,
  validColumns: string[],
): { whereClause: string; params: (string | number)[] } | null {
  const columnSet = new Set(validColumns);
  const sqlParts: string[] = [];
  const params: (string | number)[] = [];

  for (let i = 0; i < expression.conditions.length; i++) {
    const cond = expression.conditions[i];

    // 验证列名
    if (!columnSet.has(cond.field)) {
      return null;
    }

    if (cond.operator === 'IN' || cond.operator === 'NOT IN') {
      if (Array.isArray(cond.value)) {
        const placeholders = cond.value.map(() => '?').join(', ');
        sqlParts.push(`\`${cond.field}\` ${cond.operator} (${placeholders})`);
        params.push(...cond.value);
      }
    } else {
      // 构建 SQL 片段
      const sqlOp =
        cond.operator === '='
          ? '='
          : cond.operator === '!='
            ? '!='
            : cond.operator === '>'
              ? '>'
              : cond.operator === '<'
                ? '<'
                : cond.operator === '>='
                  ? '>='
                  : cond.operator === '<='
                    ? '<='
                    : cond.operator === 'LIKE'
                      ? 'LIKE'
                      : '=';

      sqlParts.push(`\`${cond.field}\` ${sqlOp} ?`);
      params.push(cond.value as string | number);
    }

    // 添加连接符
    if (i < expression.connectors.length) {
      sqlParts.push(expression.connectors[i]);
    }
  }

  return {
    whereClause: `WHERE ${sqlParts.join(' ')}`,
    params,
  };
}

/**
 * 将 ParsedExpression 转换为 PostgreSQL 参数化 SQL WHERE 子句（使用 $N 占位符）
 *
 * @param expression 解析后的表达式
 * @param validColumns 合法的列名列表
 * @param startIndex 参数索引起始值（默认 1）
 * @returns WHERE 子句和参数数组，或在列名不合法时返回 null
 */
export function expressionToSqlPg(
  expression: ParsedExpression,
  validColumns: string[],
  startIndex = 1,
): { whereClause: string; params: (string | number)[] } | null {
  const columnSet = new Set(validColumns);
  const sqlParts: string[] = [];
  const params: (string | number)[] = [];
  let pIdx = startIndex;

  for (let i = 0; i < expression.conditions.length; i++) {
    const cond = expression.conditions[i];

    if (!columnSet.has(cond.field)) {
      return null;
    }

    if (cond.operator === 'IN' || cond.operator === 'NOT IN') {
      if (Array.isArray(cond.value)) {
        const placeholders = cond.value.map(() => {
          const ph = `$${pIdx}`;
          pIdx++;
          return ph;
        }).join(', ');
        sqlParts.push(`"${cond.field}" ${cond.operator} (${placeholders})`);
        params.push(...cond.value);
      }
    } else {
      sqlParts.push(`"${cond.field}" ${cond.operator} $${pIdx}`);
      params.push(cond.value as string | number);
      pIdx++;
    }

    if (i < expression.connectors.length) {
      sqlParts.push(expression.connectors[i]);
    }
  }

  return {
    whereClause: `WHERE ${sqlParts.join(' ')}`,
    params,
  };
}
