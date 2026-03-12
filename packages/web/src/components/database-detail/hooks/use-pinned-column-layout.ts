import { useEffect, useMemo, useRef, useState } from 'react';
import type { TableColumn } from '@/lib/api';

const SELECTION_COLUMN_WIDTH = 50;

function orderColumns(columns: TableColumn[], pinnedColumns: string[]): TableColumn[] {
  if (pinnedColumns.length === 0) {
    return columns;
  }

  const pinnedSet = new Set(pinnedColumns);
  const leadingColumns: TableColumn[] = [];
  const trailingColumns: TableColumn[] = [];

  columns.forEach((column) => {
    if (pinnedSet.has(column.Field)) {
      leadingColumns.push(column);
      return;
    }

    trailingColumns.push(column);
  });

  return [...leadingColumns, ...trailingColumns];
}

function areOffsetsEqual(current: Record<string, number>, next: Record<string, number>): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => current[key] === next[key]);
}

function getColumnHeaderElement(container: HTMLDivElement | null, field: string): HTMLTableCellElement | null {
  if (!container) {
    return null;
  }

  const headers = container.querySelectorAll<HTMLTableCellElement>('[data-column-field]');
  return Array.from(headers).find((header) => header.dataset.columnField === field) ?? null;
}

export function usePinnedColumnLayout(columns: TableColumn[], pinnedColumns: string[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickyOffsets, setStickyOffsets] = useState<Record<string, number>>({});
  const pinnedSet = useMemo(() => new Set(pinnedColumns), [pinnedColumns]);
  const orderedColumns = useMemo(() => orderColumns(columns, pinnedColumns), [columns, pinnedColumns]);
  const orderedPinnedFields = useMemo(
    () => orderedColumns.filter((column) => pinnedSet.has(column.Field)).map((column) => column.Field),
    [orderedColumns, pinnedSet],
  );
  const lastPinnedField = orderedPinnedFields.at(-1) ?? null;

  useEffect(() => {
    if (orderedPinnedFields.length === 0) {
      setStickyOffsets((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    function updateStickyOffsets() {
      const selectionHeader = containerRef.current?.querySelector<HTMLTableCellElement>('[data-selection-column]');
      let left = selectionHeader?.offsetWidth ?? SELECTION_COLUMN_WIDTH;
      const nextOffsets: Record<string, number> = {};

      orderedPinnedFields.forEach((field) => {
        nextOffsets[field] = left;
        left += getColumnHeaderElement(containerRef.current, field)?.offsetWidth ?? 0;
      });

      setStickyOffsets((current) => (areOffsetsEqual(current, nextOffsets) ? current : nextOffsets));
    }

    updateStickyOffsets();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateStickyOffsets();
          });

    const selectionHeader = containerRef.current?.querySelector<HTMLTableCellElement>('[data-selection-column]');
    if (resizeObserver && selectionHeader) {
      resizeObserver.observe(selectionHeader);
    }

    if (resizeObserver) {
      orderedPinnedFields.forEach((field) => {
        const header = getColumnHeaderElement(containerRef.current, field);
        if (header) {
          resizeObserver.observe(header);
        }
      });
    }

    window.addEventListener('resize', updateStickyOffsets);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateStickyOffsets);
    };
  }, [orderedPinnedFields]);

  function getPinnedStyle(field: string) {
    if (!pinnedSet.has(field)) {
      return undefined;
    }

    return {
      left: stickyOffsets[field] ?? SELECTION_COLUMN_WIDTH,
    };
  }

  return {
    containerRef,
    orderedColumns,
    lastPinnedField,
    isPinnedColumn: (field: string) => pinnedSet.has(field),
    getPinnedStyle,
  };
}
