技术栈约定
===

1. 平台 Cloudflare worker + Cloudflare D1，KV 等全家桶
2. 网站部分：Next.js + OpenNext
3. Worker：Hono
4. 移动端：React Native + Expo
5. TailwindCSS
6. Coss UI https://coss.com/ui/docs/get-started
7. Drizzle ORM
8. TypeScript
9. pnpm


项目结构
---

此项目使用 Monorepo 管理

packages/
├── web/ # Next.js PWA
├── worker/ # Cloudflare Worker
├── mobile/ # React Native + Expo 应用（将来在做）
└── shared/ # 共享代码

