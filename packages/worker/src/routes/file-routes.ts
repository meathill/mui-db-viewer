/**
 * 文件浏览路由
 * 提供本地文件系统浏览功能，用于 SQLite 文件选择
 */

import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

const fileRoutes = new Hono<{ Bindings: CloudflareBindings }>();

fileRoutes.get('/', async (c) => {
  const targetPath = c.req.query('path') || os.homedir();

  try {
    const resolvedPath = path.resolve(targetPath);
    const stat = fs.statSync(resolvedPath);

    if (!stat.isDirectory()) {
      return c.json({ success: false, error: '路径不是目录' }, 400);
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const files: FileEntry[] = [];

    for (const entry of entries) {
      // 跳过隐藏文件
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(resolvedPath, entry.name);

      if (entry.isDirectory()) {
        files.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
        });
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // 只显示 SQLite 相关文件和常见数据库文件
        if (['.db', '.sqlite', '.sqlite3', '.s3db'].includes(ext)) {
          try {
            const fileStat = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              isDirectory: false,
              size: fileStat.size,
            });
          } catch {
            // 无法读取文件信息，跳过
          }
        }
      }
    }

    // 目录优先，然后按名称排序
    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return c.json({
      success: true,
      data: {
        currentPath: resolvedPath,
        parentPath: path.dirname(resolvedPath),
        files,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '无法读取目录',
      },
      500,
    );
  }
});

export { fileRoutes };
