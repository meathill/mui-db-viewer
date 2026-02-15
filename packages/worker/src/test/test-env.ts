export function createTestEnv(db: unknown): CloudflareBindings {
  return {
    HSM_URL: 'https://hsm.example.com',
    HSM_SECRET: 'test-secret',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    REPLICATE_API_KEY: 'test-replicate-key',
    REPLICATE_MODEL: 'meta/meta-llama-3-8b-instruct',
    DB: db as CloudflareBindings['DB'],
  } as unknown as CloudflareBindings;
}
