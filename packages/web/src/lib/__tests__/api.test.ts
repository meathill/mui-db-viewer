/**
 * API 客户端测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("API Client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("databases", () => {
    describe("list", () => {
      it("成功获取数据库列表", async () => {
        const mockData = [
          { id: "1", name: "测试数据库", type: "mysql" },
        ];
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.list();

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/databases"),
          expect.objectContaining({ method: "GET" })
        );
      });

      it("请求失败时抛出错误", async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: "服务器错误" }),
        });

        await expect(api.databases.list()).rejects.toThrow("服务器错误");
      });
    });

    describe("create", () => {
      it("成功创建数据库连接", async () => {
        const mockData = { id: "new-id", name: "新数据库" };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.create({
          name: "新数据库",
          type: "mysql",
          host: "localhost",
          port: "3306",
          database: "test",
          username: "root",
          password: "secret",
        });

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/databases"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("新数据库"),
          })
        );
      });

      it("创建失败时抛出错误", async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: "密码加密失败" }),
        });

        await expect(
          api.databases.create({
            name: "test",
            type: "mysql",
            host: "localhost",
            port: "3306",
            database: "db",
            username: "user",
            password: "pass",
          })
        ).rejects.toThrow("密码加密失败");
      });
    });

    describe("get", () => {
      it("成功获取单个数据库", async () => {
        const mockData = { id: "123", name: "获取测试" };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.databases.get("123");

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/databases/123"),
          expect.anything()
        );
      });

      it("不存在时抛出错误", async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: "数据库连接不存在" }),
        });

        await expect(api.databases.get("404")).rejects.toThrow("数据库连接不存在");
      });
    });

    describe("delete", () => {
      it("成功删除数据库", async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await expect(api.databases.delete("123")).resolves.toBeUndefined();
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/databases/123"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("删除失败时抛出错误", async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: "删除失败" }),
        });

        await expect(api.databases.delete("123")).rejects.toThrow("删除失败");
      });
    });
  });

  describe("query", () => {
    describe("generate", () => {
      it("成功生成 SQL", async () => {
        const mockData = { sql: "SELECT * FROM users", explanation: "查询用户" };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.query.generate("db-id", "查看所有用户");

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/query/generate"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("db-id"),
          })
        );
      });

      it("生成失败时抛出错误", async () => {
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, error: "API 限流" }),
        });

        await expect(api.query.generate("id", "prompt")).rejects.toThrow("API 限流");
      });
    });

    describe("validate", () => {
      it("成功验证 SQL", async () => {
        const mockData = { valid: true, sql: "SELECT * FROM users LIMIT 100" };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.query.validate("SELECT * FROM users");

        expect(result).toEqual(mockData);
      });

      it("验证失败时返回错误信息", async () => {
        const mockData = { valid: false, error: "禁止使用 DELETE" };
        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true, data: mockData }),
        });

        const result = await api.query.validate("DELETE FROM users");

        expect(result.valid).toBe(false);
        expect(result.error).toBe("禁止使用 DELETE");
      });
    });
  });
});
