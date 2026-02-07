/**
 * 数据库连接配置路由
 * 实现密码的 HSM 加密存储
 */

import { Hono } from "hono";
import { createHsmClient } from "../services/hsm";
import type {
  DatabaseConnection,
  CreateDatabaseRequest,
  ApiResponse,
} from "../types";

interface Env {
  HSM_URL: string;
  HSM_SECRET: string;
  // TODO: 后续添加 KV 或 D1 存储
}

// 内存存储（临时方案，后续改为 KV/D1）
const databases = new Map<string, DatabaseConnection>();

const databaseRoutes = new Hono<{ Bindings: Env }>();

/**
 * 创建数据库连接
 * POST /api/v1/databases
 */
databaseRoutes.post("/", async (c) => {
  const body = await c.req.json<CreateDatabaseRequest>();
  const { name, type, host, port, database, username, password } = body;

  // 参数验证
  if (!name || !type || !host || !database || !username || !password) {
    return c.json<ApiResponse>({
      success: false,
      error: "缺少必填字段",
    }, 400);
  }

  // 生成唯一 ID 和密钥路径
  const id = crypto.randomUUID();
  const keyPath = `vibedb/databases/${id}/password`;

  try {
    // 通过 HSM 加密存储密码
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    await hsm.encrypt(keyPath, password);

    // 存储连接配置（不含明文密码）
    const connection: DatabaseConnection = {
      id,
      name,
      type: type as DatabaseConnection["type"],
      host,
      port: port || "3306",
      database,
      username,
      keyPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    databases.set(id, connection);

    return c.json<ApiResponse<DatabaseConnection>>({
      success: true,
      data: connection,
    }, 201);
  } catch (error) {
    console.error("创建数据库连接失败:", error);
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    }, 500);
  }
});

/**
 * 获取所有数据库连接
 * GET /api/v1/databases
 */
databaseRoutes.get("/", (c) => {
  const list = Array.from(databases.values());
  return c.json<ApiResponse<DatabaseConnection[]>>({
    success: true,
    data: list,
  });
});

/**
 * 获取单个数据库连接
 * GET /api/v1/databases/:id
 */
databaseRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  const connection = databases.get(id);

  if (!connection) {
    return c.json<ApiResponse>({
      success: false,
      error: "数据库连接不存在",
    }, 404);
  }

  return c.json<ApiResponse<DatabaseConnection>>({
    success: true,
    data: connection,
  });
});

/**
 * 删除数据库连接
 * DELETE /api/v1/databases/:id
 */
databaseRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const connection = databases.get(id);

  if (!connection) {
    return c.json<ApiResponse>({
      success: false,
      error: "数据库连接不存在",
    }, 404);
  }

  try {
    // 从 HSM 删除密钥
    const hsm = createHsmClient({
      url: c.env.HSM_URL,
      secret: c.env.HSM_SECRET,
    });
    await hsm.delete(connection.keyPath);

    // 删除本地记录
    databases.delete(id);

    return c.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error("删除数据库连接失败:", error);
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    }, 500);
  }
});

export { databaseRoutes };
