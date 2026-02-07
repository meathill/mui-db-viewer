/**
 * 数据库路由测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock HSM 模块 - 必须在导入路由之前
vi.mock("../services/hsm", () => ({
  createHsmClient: vi.fn(() => ({
    encrypt: vi.fn().mockResolvedValue(undefined),
    decrypt: vi.fn().mockResolvedValue("decrypted-password"),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

// 导入被测模块
import { databaseRoutes } from "../routes/database";

describe("Database Routes", () => {
  let app: Hono<{ Bindings: { HSM_URL: string; HSM_SECRET: string } }>;

  beforeEach(() => {
    // 创建带有 mock 环境变量的 app
    app = new Hono<{ Bindings: { HSM_URL: string; HSM_SECRET: string } }>();

    // 添加中间件注入环境变量
    app.use("*", async (c, next) => {
      // @ts-expect-error mock env
      c.env = {
        HSM_URL: "https://hsm.example.com",
        HSM_SECRET: "test-secret",
      };
      await next();
    });

    app.route("/databases", databaseRoutes);
  });

  describe("POST /databases", () => {
    it("成功创建数据库连接", async () => {
      const res = await app.request("/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "测试数据库",
          type: "mysql",
          host: "localhost",
          port: "3306",
          database: "test_db",
          username: "root",
          password: "secret",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as { success: boolean; data?: { name: string; type: string; id: string; keyPath: string; password?: string } };
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        name: "测试数据库",
        type: "mysql",
        host: "localhost",
      });
      expect(json.data?.id).toBeDefined();
      expect(json.data?.keyPath).toContain("vibedb/databases");
      // 确保密码未被存储
      expect(json.data?.password).toBeUndefined();
    });

    it("缺少必填字段时返回 400", async () => {
      const res = await app.request("/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "测试数据库",
          // 缺少其他必填字段
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("缺少必填字段");
    });

    it("使用默认端口 3306", async () => {
      const res = await app.request("/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "无端口指定",
          type: "mysql",
          host: "localhost",
          // 不指定 port
          database: "test_db",
          username: "root",
          password: "secret",
        }),
      });

      const json = await res.json() as { data?: { port: string } };
      expect(json.data?.port).toBe("3306");
    });
  });

  describe("GET /databases", () => {
    it("返回数据库列表", async () => {
      const res = await app.request("/databases");

      expect(res.status).toBe(200);
      const json = await res.json() as { success: boolean; data?: unknown[] };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("GET /databases/:id", () => {
    it("不存在的 ID 返回 404", async () => {
      const res = await app.request("/databases/non-existent-id");

      expect(res.status).toBe(404);
      const json = await res.json() as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("数据库连接不存在");
    });
  });

  describe("DELETE /databases/:id", () => {
    it("删除不存在的 ID 返回 404", async () => {
      const res = await app.request("/databases/non-existent-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const json = await res.json() as { success: boolean };
      expect(json.success).toBe(false);
    });
  });
});
