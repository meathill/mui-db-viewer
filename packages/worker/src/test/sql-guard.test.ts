/**
 * SQL Guard 安全沙箱测试
 */

import { describe, it, expect } from 'vitest';
import { validateAndSanitizeSql, getSqlStatementType } from '../services/sql-guard';

describe('SQL Guard', () => {
  describe('validateAndSanitizeSql', () => {
    describe('允许的语句', () => {
      it('允许 SELECT 语句', () => {
        const result = validateAndSanitizeSql('SELECT * FROM users');
        expect(result.valid).toBe(true);
        expect(result.sql).toContain('SELECT * FROM users');
      });

      it('允许 SHOW 语句', () => {
        const result = validateAndSanitizeSql('SHOW TABLES');
        expect(result.valid).toBe(true);
      });

      it('允许 DESCRIBE 语句', () => {
        const result = validateAndSanitizeSql('DESCRIBE users');
        expect(result.valid).toBe(true);
      });

      it('允许 EXPLAIN 语句', () => {
        const result = validateAndSanitizeSql('EXPLAIN SELECT * FROM users');
        expect(result.valid).toBe(true);
      });
    });

    describe('禁止的语句', () => {
      it('拒绝 DELETE 语句', () => {
        const result = validateAndSanitizeSql('DELETE FROM users WHERE id = 1');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('只允许');
      });

      it('拒绝 DROP 语句', () => {
        const result = validateAndSanitizeSql('DROP TABLE users');
        expect(result.valid).toBe(false);
      });

      it('拒绝 UPDATE 语句', () => {
        const result = validateAndSanitizeSql("UPDATE users SET name = 'test'");
        expect(result.valid).toBe(false);
      });

      it('拒绝 INSERT 语句', () => {
        const result = validateAndSanitizeSql("INSERT INTO users VALUES (1, 'test')");
        expect(result.valid).toBe(false);
      });

      it('拒绝 ALTER 语句', () => {
        const result = validateAndSanitizeSql('ALTER TABLE users ADD COLUMN age INT');
        expect(result.valid).toBe(false);
      });

      it('拒绝 TRUNCATE 语句', () => {
        const result = validateAndSanitizeSql('TRUNCATE TABLE users');
        expect(result.valid).toBe(false);
      });
    });

    describe('LIMIT 处理', () => {
      it('自动添加 LIMIT 100', () => {
        const result = validateAndSanitizeSql('SELECT * FROM users');
        expect(result.valid).toBe(true);
        expect(result.sql).toBe('SELECT * FROM users LIMIT 100');
      });

      it('保留已有的 LIMIT', () => {
        const result = validateAndSanitizeSql('SELECT * FROM users LIMIT 50');
        expect(result.valid).toBe(true);
        expect(result.sql).toBe('SELECT * FROM users LIMIT 50');
      });

      it('移除末尾分号并添加 LIMIT', () => {
        const result = validateAndSanitizeSql('SELECT * FROM users;');
        expect(result.valid).toBe(true);
        expect(result.sql).toBe('SELECT * FROM users LIMIT 100');
      });
    });

    describe('边界情况', () => {
      it('拒绝空 SQL', () => {
        const result = validateAndSanitizeSql('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('SQL 语句不能为空');
      });

      it('拒绝只有空格的 SQL', () => {
        const result = validateAndSanitizeSql('   ');
        expect(result.valid).toBe(false);
      });

      it('不误判包含关键字的字段名', () => {
        // updated_at 包含 update，但不应被拒绝
        const result = validateAndSanitizeSql('SELECT updated_at FROM users');
        expect(result.valid).toBe(true);
      });

      it('不误判包含 delete 的字段名', () => {
        const result = validateAndSanitizeSql('SELECT deleted_at FROM users WHERE deleted_at IS NULL');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getSqlStatementType', () => {
    it('识别 SELECT 语句', () => {
      expect(getSqlStatementType('SELECT * FROM users')).toBe('SELECT');
    });

    it('识别 SHOW 语句', () => {
      expect(getSqlStatementType('SHOW TABLES')).toBe('SHOW');
    });

    it('返回 UNKNOWN 对于不允许的语句', () => {
      expect(getSqlStatementType('DELETE FROM users')).toBe('UNKNOWN');
    });
  });
});
