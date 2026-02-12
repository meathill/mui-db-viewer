/**
 * 内联编辑 Store
 * 管理表格单元格编辑状态和暂存数据
 */

import { create } from 'zustand';
import type { RowUpdate } from '@/lib/api';

/** 单元格编辑位置标识 */
interface EditingCell {
  rowKey: string | number;
  field: string;
}

/** 暂存的编辑内容，key 格式为 `${rowKey}` */
type PendingEdits = Map<string | number, Record<string, unknown>>;

interface EditStore {
  /** 当前正在编辑的单元格 */
  editingCell: EditingCell | null;
  /** 暂存的编辑数据 */
  pendingEdits: PendingEdits;

  /** 开始编辑某个单元格 */
  startEditing: (rowKey: string | number, field: string) => void;
  /** 停止编辑 */
  stopEditing: () => void;
  /** 暂存一个字段的修改 */
  setEdit: (rowKey: string | number, field: string, value: unknown) => void;
  /** 检查某个单元格是否有暂存修改 */
  isCellEdited: (rowKey: string | number, field: string) => boolean;
  /** 获取单元格的暂存值（如果有） */
  getCellValue: (rowKey: string | number, field: string) => unknown;
  /** 是否有待提交的修改 */
  hasPendingEdits: () => boolean;
  /** 获取所有暂存数据（转为提交格式） */
  getPendingRows: () => RowUpdate[];
  /** 清空所有暂存 */
  clearEdits: () => void;
}

export const useEditStore = create<EditStore>((set, get) => ({
  editingCell: null,
  pendingEdits: new Map(),

  startEditing(rowKey, field) {
    set({ editingCell: { rowKey, field } });
  },

  stopEditing() {
    set({ editingCell: null });
  },

  setEdit(rowKey, field, value) {
    set((state) => {
      const newEdits = new Map(state.pendingEdits);
      const rowEdits = newEdits.get(rowKey) || {};
      rowEdits[field] = value;
      newEdits.set(rowKey, rowEdits);
      return { pendingEdits: newEdits };
    });
  },

  isCellEdited(rowKey, field) {
    const rowEdits = get().pendingEdits.get(rowKey);
    return rowEdits !== undefined && field in rowEdits;
  },

  getCellValue(rowKey, field) {
    const rowEdits = get().pendingEdits.get(rowKey);
    return rowEdits?.[field];
  },

  hasPendingEdits() {
    return get().pendingEdits.size > 0;
  },

  getPendingRows() {
    const rows: RowUpdate[] = [];
    get().pendingEdits.forEach((data, pk) => {
      rows.push({ pk, data });
    });
    return rows;
  },

  clearEdits() {
    set({ pendingEdits: new Map(), editingCell: null });
  },
}));
