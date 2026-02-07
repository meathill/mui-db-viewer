/**
 * 工具函数测试
 */

import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn (className merge)', () => {
  it('合并多个类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('处理条件类名', () => {
    expect(cn('base', true && 'active')).toBe('base active');
    expect(cn('base', false && 'active')).toBe('base');
  });

  it('合并 Tailwind 冲突类', () => {
    // twMerge 会合并冲突的 Tailwind 类
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('处理数组输入', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('处理对象输入', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('处理 undefined 和 null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('处理空输入', () => {
    expect(cn()).toBe('');
  });
});
