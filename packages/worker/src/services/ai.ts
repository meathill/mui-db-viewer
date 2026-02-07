/**
 * AI 服务
 * 封装 LLM API 调用，用于生成 SQL
 */

export interface AiConfig {
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

const SYSTEM_PROMPT = `你是一个 SQL 专家。根据用户的自然语言描述和数据库 Schema，生成对应的 SQL 查询语句。

规则：
1. 只生成 SELECT、SHOW 或 DESCRIBE 语句
2. 不要生成任何修改数据的语句（DELETE、UPDATE、INSERT、DROP 等）
3. 尽量使用有意义的别名
4. 添加适当的 LIMIT 限制
5. 返回格式为 JSON：{"sql": "你的SQL", "explanation": "简短解释"}
`;

export function createAiService(config: AiConfig) {
  const { apiKey, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1' } = config;

  return {
    async generateSql(request: GenerateSqlRequest): Promise<GenerateSqlResponse> {
      const { prompt, schema, databaseType } = request;

      const userMessage = `数据库类型: ${databaseType}

Schema 信息:
${schema}

用户需求: ${prompt}

请生成 SQL 查询。`;

      const response = await fetch(`${baseUrl}/chat/completions`, {
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
        throw new Error(`AI 服务调用失败: ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI 未返回有效响应');
      }

      try {
        const parsed = JSON.parse(content) as GenerateSqlResponse;
        return {
          sql: parsed.sql || '',
          explanation: parsed.explanation,
        };
      } catch {
        // 如果不是 JSON，尝试直接提取 SQL
        return { sql: content };
      }
    },
  };
}
