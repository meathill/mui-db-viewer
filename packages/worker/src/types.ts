/**
 * 数据库连接配置类型
 */

export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'tidb' | 'd1' | 'supabase' | 'mysql' | 'postgres';
  host: string;
  port: string;
  database: string;
  username: string;
  /** HSM 密钥路径（用于解密密码） */
  keyPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDatabaseRequest {
  name: string;
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
