/**
 * SQL Guard 安全沙箱
 * 校验 SQL 语句安全性，只允许只读操作
 */

/** 允许的 SQL 语句类型 */
const ALLOWED_STATEMENTS = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'];

/** 禁止的关键字 */
const FORBIDDEN_KEYWORDS = [
  'DELETE',
  'DROP',
  'UPDATE',
  'INSERT',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
];

/** 默认 LIMIT 值 */
const DEFAULT_LIMIT = 100;

export interface SqlGuardResult {
  valid: boolean;
  sql?: string;
  error?: string;
}

/**
 * 校验并处理 SQL 语句
 */
export function validateAndSanitizeSql(sql: string): SqlGuardResult {
  const trimmedSql = sql.trim();

  if (!trimmedSql) {
    return { valid: false, error: 'SQL 语句不能为空' };
  }

  // 转换为大写用于检查
  const upperSql = trimmedSql.toUpperCase();

  // 检查是否以允许的语句开头
  const startsWithAllowed = ALLOWED_STATEMENTS.some((stmt) => upperSql.startsWith(stmt));

  if (!startsWithAllowed) {
    return {
      valid: false,
      error: `只允许 ${ALLOWED_STATEMENTS.join('、')} 语句`,
    };
  }

  // 检查是否包含禁止的关键字
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // 使用单词边界检查，避免误判（如 UPDATED_AT 字段）
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(trimmedSql)) {
      return {
        valid: false,
        error: `禁止使用 ${keyword} 语句`,
      };
    }
  }

  // 处理 SELECT 语句的 LIMIT
  let processedSql = trimmedSql;
  if (upperSql.startsWith('SELECT')) {
    processedSql = ensureLimit(trimmedSql, DEFAULT_LIMIT);
  }

  return {
    valid: true,
    sql: processedSql,
  };
}

/**
 * 确保 SELECT 语句有 LIMIT
 */
function ensureLimit(sql: string, limit: number): string {
  const upperSql = sql.toUpperCase();

  // 如果已有 LIMIT，不修改
  if (/\bLIMIT\s+\d+/i.test(sql)) {
    return sql;
  }

  // 移除末尾分号（如果有）
  let cleanSql = sql.replace(/;\s*$/, '');

  // 添加 LIMIT
  cleanSql = `${cleanSql} LIMIT ${limit}`;

  return cleanSql;
}

/**
 * 提取 SQL 语句类型
 */
export function getSqlStatementType(sql: string): string {
  const trimmed = sql.trim().toUpperCase();
  for (const stmt of ALLOWED_STATEMENTS) {
    if (trimmed.startsWith(stmt)) {
      return stmt;
    }
  }
  return 'UNKNOWN';
}
