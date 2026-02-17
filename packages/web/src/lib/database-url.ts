type DatabaseProtocol = 'mysql' | 'postgres';

export interface DatabaseUrlHint {
  level: 'info' | 'warning';
  message: string;
}

export interface ParsedDatabaseUrl {
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  hint?: DatabaseUrlHint;
}

const MYSQL_PROTOCOLS = new Set(['mysql:', 'mariadb:', 'tidb:']);
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const SSL_QUERY_KEYS = ['sslmode', 'ssl', 'tls', 'ssl-mode'] as const;

function parseProtocol(protocol: string): DatabaseProtocol | null {
  if (MYSQL_PROTOCOLS.has(protocol)) {
    return 'mysql';
  }

  if (POSTGRES_PROTOCOLS.has(protocol)) {
    return 'postgres';
  }

  return null;
}

function resolveDatabaseType(protocol: DatabaseProtocol, currentType: string): string {
  if (protocol === 'mysql') {
    if (currentType === 'tidb') {
      return 'tidb';
    }
    return 'mysql';
  }

  if (currentType === 'supabase') {
    return 'supabase';
  }
  return 'postgres';
}

function resolveDefaultPort(type: string): string {
  if (type === 'postgres' || type === 'supabase') {
    return '5432';
  }

  return '3306';
}

function normalizeDatabaseName(pathname: string): string {
  const rawName = pathname.replace(/^\/+/, '').trim();
  return decodeURIComponent(rawName);
}

function findSslQueryParam(searchParams: URLSearchParams): { key: string; value: string } | null {
  for (const key of SSL_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value !== null) {
      return { key, value };
    }
  }

  return null;
}

function resolveSslPreference(param: { key: string; value: string }): 'enable' | 'disable' | 'unknown' {
  const normalized = param.value.trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (param.key === 'sslmode') {
    if (normalized === 'disable') {
      return 'disable';
    }

    if (['require', 'verify-ca', 'verify-full', 'prefer', 'allow'].includes(normalized)) {
      return 'enable';
    }

    return 'unknown';
  }

  if (['1', 'true', 'yes', 'on', 'enable', 'enabled', 'require', 'required'].includes(normalized)) {
    return 'enable';
  }

  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) {
    return 'disable';
  }

  return 'unknown';
}

function buildSslHint(url: URL): DatabaseUrlHint | undefined {
  const param = findSslQueryParam(url.searchParams);
  if (!param) {
    return undefined;
  }

  const preference = resolveSslPreference(param);
  const parameter = `${param.key}=${param.value}`;

  if (preference === 'disable') {
    return {
      level: 'warning',
      message: `检测到 URL 参数要求禁用 SSL（${parameter}），但当前服务端驱动默认启用 TLS。请确认目标数据库允许 TLS 连接。`,
    };
  }

  if (preference === 'enable') {
    return {
      level: 'info',
      message: `检测到 URL 参数要求启用 SSL（${parameter}）。当前服务端驱动默认启用 TLS。`,
    };
  }

  return {
    level: 'info',
    message: `检测到 URL 包含 SSL 参数（${parameter}）。当前服务端驱动默认启用 TLS，请确认与目标数据库配置一致。`,
  };
}

export function parseDatabaseUrl(databaseUrl: string, currentType: string): ParsedDatabaseUrl {
  const rawUrl = databaseUrl.trim();
  if (!rawUrl) {
    throw new Error('请先输入数据库 URL');
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('数据库 URL 格式不正确');
  }

  const protocol = parseProtocol(url.protocol);
  if (!protocol) {
    throw new Error('暂不支持该 URL 协议，请使用 mysql:// 或 postgresql://');
  }

  const host = url.hostname.trim();
  if (!host) {
    throw new Error('数据库 URL 缺少主机地址');
  }

  const database = normalizeDatabaseName(url.pathname);
  if (!database) {
    throw new Error('数据库 URL 缺少数据库名');
  }

  const type = resolveDatabaseType(protocol, currentType);
  const port = url.port || resolveDefaultPort(type);

  return {
    type,
    host,
    port,
    database,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    hint: buildSslHint(url),
  };
}
