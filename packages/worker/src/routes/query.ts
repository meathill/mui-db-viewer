/**
 * 查询路由
 * 处理 AI SQL 生成和执行
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { createAiService } from '../services/ai';
import { validateAndSanitizeSql } from '../services/sql-guard';
import type { ApiResponse } from '../types';
import { parseGenerateSqlRequest, parseValidateSqlRequest } from './request-validation';

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
}

interface GenerateResponse {
  sql: string;
  explanation?: string;
  warning?: string;
}

const queryRoutes = new Hono<{ Bindings: Env }>();

// 模拟 Schema（后续从缓存获取）
const MOCK_SCHEMA = `
表: orders
  - id: INT PRIMARY KEY
  - user_id: INT
  - total_amount: DECIMAL(10,2)
  - status: VARCHAR(20)
  - created_at: DATETIME
  - updated_at: DATETIME

表: users
  - id: INT PRIMARY KEY
  - name: VARCHAR(100)
  - email: VARCHAR(255)
  - created_at: DATETIME

表: products
  - id: INT PRIMARY KEY
  - name: VARCHAR(200)
  - price: DECIMAL(10,2)
  - stock: INT
`;

/**
 * 生成 SQL
 * POST /api/v1/query/generate
 */
queryRoutes.post(
  '/generate',
  validator('json', (body, c) => {
    const result = parseGenerateSqlRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const { prompt } = c.req.valid('json');

    try {
      const ai = createAiService({
        apiKey: c.env.OPENAI_API_KEY,
        model: c.env.OPENAI_MODEL,
        baseUrl: c.env.OPENAI_BASE_URL,
      });

      const schema = MOCK_SCHEMA;

      const result = await ai.generateSql({
        prompt,
        schema,
        databaseType: 'MySQL',
      });

      const guardResult = validateAndSanitizeSql(result.sql);

      if (!guardResult.valid) {
        return c.json<ApiResponse<GenerateResponse>>({
          success: true,
          data: {
            sql: result.sql,
            explanation: result.explanation,
            warning: guardResult.error,
          },
        });
      }

      return c.json<ApiResponse<GenerateResponse>>({
        success: true,
        data: {
          sql: guardResult.sql!,
          explanation: result.explanation,
        },
      });
    } catch (error) {
      console.error('生成 SQL 失败:', error);
      return c.json<ApiResponse>(
        {
          success: false,
          error: error instanceof Error ? error.message : '生成失败',
        },
        500,
      );
    }
  },
);

/**
 * 校验 SQL（不调用 AI）
 * POST /api/v1/query/validate
 */
queryRoutes.post(
  '/validate',
  validator('json', (body, c) => {
    const result = parseValidateSqlRequest(body);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return result.data;
  }),
  async (c) => {
    const { sql } = c.req.valid('json');
    const result = validateAndSanitizeSql(sql);

    return c.json<ApiResponse<{ valid: boolean; sql?: string; error?: string }>>({
      success: true,
      data: result,
    });
  },
);

export { queryRoutes };
