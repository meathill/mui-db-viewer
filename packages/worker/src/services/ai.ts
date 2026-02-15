/**
 * AI 服务
 * 封装 LLM API 调用，用于生成 SQL
 * 支持 OpenAI, Gemini, Replicate
 */

export type AiProviderType = 'openai' | 'gemini' | 'replicate';

export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface GenerateSqlRequest {
  prompt: string;
  schema: string;
  databaseType: string;
}

export interface GenerateSqlResponse {
  sql: string;
  explanation?: string;
}

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

const SYSTEM_PROMPT = `你是一个 SQL 专家。根据用户的自然语言描述和数据库 Schema，生成对应的 SQL 查询语句。

规则：
1. 只生成 SELECT、SHOW 或 DESCRIBE 语句
2. 不要生成任何修改数据的语句（DELETE、UPDATE、INSERT、DROP 等）
3. 尽量使用有意义的别名
4. 添加适当的 LIMIT 限制
5. 返回格式必须为严格的 JSON，格式如下：{"sql": "你的SQL", "explanation": "简短解释"}
`;

/**
 * AI Provider 接口
 */
export interface AiService {
  generateSql(request: GenerateSqlRequest): Promise<GenerateSqlResponse>;
}

function normalizeBaseUrl(input: string | undefined): string {
  const trimmed = input?.trim();
  if (!trimmed) return DEFAULT_OPENAI_BASE_URL;

  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  try {
    // 保证是绝对 URL，避免 fetch 在 Node/Worker 下抛出 Invalid URL
    const url = new URL(withScheme);
    return url.toString().replace(/\/+$/, '');
  } catch {
    return DEFAULT_OPENAI_BASE_URL;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBaseUrl}/${normalizedPath}`;
}

/**
 * OpenAI 实现
 */
class OpenAIProvider implements AiService {
  constructor(private config: AiConfig) {}

  async generateSql(request: GenerateSqlRequest): Promise<GenerateSqlResponse> {
    const { prompt, schema, databaseType } = request;
    const apiKey = this.config.apiKey;
    const model = this.config.model?.trim() || 'gpt-4o-mini';
    const baseUrl = normalizeBaseUrl(this.config.baseUrl);

    if (!apiKey?.trim()) {
      throw new Error('未配置 OpenAI API Key');
    }

    const userMessage = `数据库类型: ${databaseType}

Schema 信息:
${schema}

用户需求: ${prompt}

请生成 JSON 格式的响应。`;

    const response = await fetch(joinUrl(baseUrl, 'chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI 调用失败: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    return parseResponse(content);
  }
}

/**
 * Google Gemini 实现
 */
class GeminiProvider implements AiService {
  constructor(private config: AiConfig) {}

  async generateSql(request: GenerateSqlRequest): Promise<GenerateSqlResponse> {
    const { prompt, schema, databaseType } = request;
    const { apiKey, model = 'gemini-1.5-flash' } = this.config;

    // Gemini API URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const userMessage = `${SYSTEM_PROMPT}

数据库类型: ${databaseType}

Schema 信息:
${schema}

用户需求: ${prompt}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini 调用失败: ${error}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return parseResponse(content);
  }
}

/**
 * Replicate 实现
 */
class ReplicateProvider implements AiService {
  constructor(private config: AiConfig) {}

  async generateSql(request: GenerateSqlRequest): Promise<GenerateSqlResponse> {
    const { prompt, schema, databaseType } = request;
    const { apiKey, model = 'meta/meta-llama-3-8b-instruct' } = this.config;

    const userMessage = `${SYSTEM_PROMPT}

数据库类型: ${databaseType}

Schema 信息:
${schema}

用户需求: ${prompt}`;

    // 1. 创建预测
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait', // 尝试等待完成
      },
      body: JSON.stringify({
        version: model.includes(':') ? model.split(':')[1] : undefined, // 如果 model 是 "owner/name:version" 格式
        model: !model.includes(':') ? model : undefined, // 如果 model 是 "owner/name" 格式 (Replicate 新 API 支持)
        input: {
          prompt: userMessage,
          max_tokens: 1000,
          temperature: 0.1,
          system_prompt: SYSTEM_PROMPT, // 某些 Llama 模型支持此参数
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate 调用失败: ${error}`);
    }

    let prediction = (await response.json()) as {
      id: string;
      status: string;
      output: string[] | string | null;
      urls: { get: string };
    };

    // 如果没有 wait 或者超时，需要轮询
    let attempts = 0;
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < 10
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const pollResponse = await fetch(prediction.urls.get, {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!pollResponse.ok) break;
      prediction = (await pollResponse.json()) as typeof prediction;
      attempts++;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`Replicate 预测失败或超时: ${prediction.status}`);
    }

    // Replicate 的 output 通常是一个字符串数组（tokens）或单个字符串
    const content = Array.isArray(prediction.output) ? prediction.output.join('') : prediction.output;

    return parseResponse(content);
  }
}

/**
 * 解析并验证 JSON 响应
 */
function parseResponse(content: string | undefined | null): GenerateSqlResponse {
  if (!content) {
    throw new Error('AI 未返回有效响应');
  }

  try {
    // 尝试清理 Markdown 代码块标记 (Gemini/Replicate 有时会包含)
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as GenerateSqlResponse;
    return {
      sql: parsed.sql || '',
      explanation: parsed.explanation,
    };
  } catch (e) {
    // 如果解析失败，尝试直接作为 SQL 返回（虽然不符合 JSON 要求，但在某些弱模型下可能发生）
    console.warn('JSON 解析失败，回退到纯文本:', e);
    return { sql: content };
  }
}

/**
 * 工厂函数
 */
export function createAiService(config: AiConfig): AiService {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config);
    case 'replicate':
      return new ReplicateProvider(config);
    case 'openai':
    default:
      return new OpenAIProvider(config);
  }
}
