import type { TableFilterConditionDraft, TableFilterDraft } from '@/lib/table-filter-builder';

function isLegacyFilterVisible(draft: TableFilterDraft, normalizedValue: string): boolean {
  return (
    draft.sourceWarning !== null &&
    draft.legacyTextValue.trim() !== '' &&
    normalizedValue === draft.legacyTextValue.trim()
  );
}

export function buildTableFilterConditionLabel(condition: TableFilterConditionDraft): string {
  if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
    const items = condition.value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
    return `${condition.field} ${condition.operator} [${items.join(', ')}]`;
  }

  return `${condition.field} ${condition.operator} ${condition.value}`;
}

export function getTableFilterStatusTitle(
  draft: TableFilterDraft,
  isValid: boolean,
  isDirty: boolean,
  normalizedValue: string,
): string {
  if (!isValid) {
    return '条件未生效';
  }

  if (isLegacyFilterVisible(draft, normalizedValue)) {
    return '检测到旧版筛选';
  }

  if (!normalizedValue) {
    return '当前未筛选';
  }

  if (isDirty) {
    return '待应用的新条件';
  }

  return '筛选条件已生效';
}

export function getTableFilterStatusVariant(
  draft: TableFilterDraft,
  isValid: boolean,
  isDirty: boolean,
  normalizedValue: string,
) {
  if (!isValid) {
    return 'error' as const;
  }

  if (isLegacyFilterVisible(draft, normalizedValue)) {
    return 'warning' as const;
  }

  if (!normalizedValue) {
    return 'default' as const;
  }

  if (isDirty) {
    return 'info' as const;
  }

  return 'success' as const;
}

export function getTableFilterStatusDescription(
  draft: TableFilterDraft,
  normalizedValue: string,
  activeConditionCount: number,
  error: string | null,
): string {
  if (error) {
    return error;
  }

  if (isLegacyFilterVisible(draft, normalizedValue)) {
    return `当前仍保留旧版文本筛选：${draft.legacyTextValue}`;
  }

  if (!normalizedValue) {
    return '从列、运算符和值依次添加条件，筛选会在点击“应用筛选”后生效。';
  }

  if (activeConditionCount === 0) {
    return normalizedValue;
  }

  return `将按 ${activeConditionCount} 条条件筛选：${normalizedValue}`;
}
