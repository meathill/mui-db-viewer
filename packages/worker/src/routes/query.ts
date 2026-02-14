/**
 * 查询路由
 * 处理 AI SQL 生成和执行
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { createAiService, type AiConfig } from '../services/ai';
import { formatDatabaseTypeLabel, getDatabaseSchemaContext } from '../services/schema-context';
import { validateAndSanitizeSql } from '../services/sql-guard';
import type { ApiResponse, Env } from '../types';
import { findConnectionById, getErrorMessage } from './database-shared';
import { parseGenerateSqlRequest, parseValidateSqlRequest } from './request-validation';

interface GenerateResponse {
  sql: string;
  explanation?: string;
  warning?: string;
}

const queryRoutes = new Hono<{ Bindings: Env }>();

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
    const { databaseId, prompt, provider = 'openai', apiKey, model, baseUrl } = c.req.valid('json');
    const connection = await findConnectionById(c.env, databaseId);

    if (!connection) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: '数据库连接不存在',
        },
        404,
      );
    }

    try {
      let aiConfig: AiConfig;

      switch (provider) {
        case 'gemini': {
          const geminiKey = apiKey || c.env.GEMINI_API_KEY;
          if (!geminiKey) throw new Error('未配置 Gemini API Key');
          aiConfig = {
            provider: 'gemini',
            apiKey: geminiKey,
            model: model || c.env.GEMINI_MODEL || 'gemini-1.5-flash',
          };
          break;
        }
        case 'replicate': {
          const replicateKey = apiKey || c.env.REPLICATE_API_KEY;
          if (!replicateKey) throw new Error('未配置 Replicate API Key');
          aiConfig = {
            provider: 'replicate',
            apiKey: replicateKey,
            model: model || c.env.REPLICATE_MODEL || 'meta/meta-llama-3-8b-instruct',
          };
          break;
        }
        case 'openai':
        default: {
          const openaiKey = apiKey || c.env.OPENAI_API_KEY;
          if (!openaiKey) throw new Error('未配置 OpenAI API Key');
          aiConfig = {
            provider: 'openai',
            apiKey: openaiKey,
            model: model || c.env.OPENAI_MODEL,
            baseUrl: baseUrl || c.env.OPENAI_BASE_URL,
          };
          break;
        }
      }

      const ai = createAiService(aiConfig);

      const schemaContext = await getDatabaseSchemaContext(c.env, connection);
      const schema = schemaContext.schema;

      const result = await ai.generateSql({
        prompt,
        schema,
        databaseType: formatDatabaseTypeLabel(connection.type),
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
          error: getErrorMessage(error, '生成失败'),
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
