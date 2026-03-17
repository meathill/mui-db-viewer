import type { TableColumn } from './api-types';
import { parseSearchExpression } from './table-filter';

export type TableFilterConnector = 'AND' | 'OR';
export type TableFilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';

export interface TableFilterConditionDraft {
  id: string;
  connector: TableFilterConnector;
  field: string;
  operator: TableFilterOperator;
  value: string;
}

export interface TableFilterDraft {
  conditions: TableFilterConditionDraft[];
  legacyTextValue: string;
  sourceWarning: string | null;
}

export interface PersistedTableFilterConditionDraft {
  connector: TableFilterConnector;
  field: string;
  operator: TableFilterOperator;
  value: string;
}

export interface PersistedTableFilterDraft {
  conditions: PersistedTableFilterConditionDraft[];
  legacyTextValue: string;
  sourceWarning: string | null;
}

export interface TableFilterDraftValidation {
  isValid: boolean;
  normalizedValue: string;
  activeConditionCount: number;
  error: string | null;
  rowErrors: string[];
}

export interface TableFilterOperatorOption {
  value: TableFilterOperator;
  label: string;
  hint: string;
  group: 'comparison' | 'matching';
}

const NUMERIC_LIKE_TYPES = ['int', 'float', 'double', 'decimal', 'real', 'numeric', 'serial'];

const TABLE_FILTER_OPERATOR_OPTIONS: TableFilterOperatorOption[] = [
  { value: '=', label: '等于', hint: '=', group: 'comparison' },
  { value: '!=', label: '不等于', hint: '!=', group: 'comparison' },
  { value: '>', label: '大于', hint: '>', group: 'comparison' },
  { value: '<', label: '小于', hint: '<', group: 'comparison' },
  { value: '>=', label: '大于等于', hint: '>=', group: 'comparison' },
  { value: '<=', label: '小于等于', hint: '<=', group: 'comparison' },
  { value: 'LIKE', label: '包含', hint: 'LIKE', group: 'matching' },
  { value: 'IN', label: '在列表中', hint: 'IN', group: 'matching' },
  { value: 'NOT IN', label: '不在列表中', hint: 'NOT IN', group: 'matching' },
];

let conditionSequence = 0;

function createConditionId(): string {
  conditionSequence += 1;
  return `filter-condition-${conditionSequence}`;
}

function normalizeLegacyTextValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function quoteStringValue(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function isNumericLikeColumn(column: TableColumn | undefined): boolean {
  const type = column?.Type?.toLowerCase() ?? '';
  return NUMERIC_LIKE_TYPES.some((keyword) => type.includes(keyword));
}

function isBlankCondition(condition: Pick<TableFilterConditionDraft, 'field' | 'value'>): boolean {
  return condition.field.trim() === '' && condition.value.trim() === '';
}

function serializeScalarValue(rawValue: string, column: TableColumn | undefined): { value?: string; error?: string } {
  const normalizedValue = stripWrappingQuotes(rawValue);
  if (!normalizedValue) {
    return { error: '请输入筛选值' };
  }

  if (isNumericLikeColumn(column)) {
    if (!Number.isFinite(Number(normalizedValue))) {
      return { error: '该列需要数字值' };
    }

    return { value: normalizedValue };
  }

  return { value: quoteStringValue(normalizedValue) };
}

function serializeCondition(
  condition: TableFilterConditionDraft,
  columns: TableColumn[],
): { value?: string; error?: string } {
  const field = condition.field.trim();
  const operator = condition.operator;
  const rawValue = condition.value.trim();

  if (!field) {
    return { error: '请选择列' };
  }

  const column = columns.find((item) => item.Field === field);
  if (!column) {
    return { error: `列不存在：${field}` };
  }

  if (!rawValue) {
    return { error: '请输入筛选值' };
  }

  if (operator === 'IN' || operator === 'NOT IN') {
    const items = rawValue
      .split(',')
      .map((item) => stripWrappingQuotes(item))
      .filter((item) => item !== '');

    if (items.length === 0) {
      return { error: '请至少填写一个列表项' };
    }

    const serializedItems = items.map((item) => serializeScalarValue(item, column));
    const invalidItem = serializedItems.find((item) => item.error);
    if (invalidItem?.error) {
      return { error: invalidItem.error };
    }

    return {
      value: `${field} ${operator} (${serializedItems.map((item) => item.value).join(', ')})`,
    };
  }

  const serializedValue = serializeScalarValue(rawValue, column);
  if (!serializedValue.value) {
    return { error: serializedValue.error ?? '请输入筛选值' };
  }

  return {
    value: `${field} ${operator} ${serializedValue.value}`,
  };
}

function toDraftValue(value: string | number | Array<string | number>): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }

  return String(value);
}

function createEmptyCondition(connector: TableFilterConnector = 'AND'): TableFilterConditionDraft {
  return {
    id: createConditionId(),
    connector,
    field: '',
    operator: '=',
    value: '',
  };
}

function createEmptyBuilderDraft(): TableFilterDraft {
  return {
    conditions: [createEmptyCondition()],
    legacyTextValue: '',
    sourceWarning: null,
  };
}

export function getTableFilterOperatorOptions(): TableFilterOperatorOption[] {
  return TABLE_FILTER_OPERATOR_OPTIONS;
}

export function getDefaultTableFilterOperator(_column: TableColumn | undefined): TableFilterOperator {
  return '=';
}

export function createEmptyTableFilterCondition(connector: TableFilterConnector = 'AND'): TableFilterConditionDraft {
  return createEmptyCondition(connector);
}

export function clearTableFilterDraft(draft: TableFilterDraft): TableFilterDraft {
  return {
    ...draft,
    conditions: [createEmptyCondition()],
    legacyTextValue: '',
    sourceWarning: null,
  };
}

export function deserializeTableFilterDraft(value: string): TableFilterDraft {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return createEmptyBuilderDraft();
  }

  const parsed = parseSearchExpression(normalizedValue);
  if (parsed.isExpression && parsed.expression) {
    return {
      conditions: parsed.expression.conditions.map((condition, index) => ({
        id: createConditionId(),
        connector: index === 0 ? 'AND' : (parsed.expression?.connectors[index - 1] ?? 'AND'),
        field: condition.field,
        operator: condition.operator as TableFilterOperator,
        value: toDraftValue(condition.value),
      })),
      legacyTextValue: '',
      sourceWarning: null,
    };
  }

  return {
    conditions: [createEmptyCondition()],
    legacyTextValue: normalizeLegacyTextValue(normalizedValue),
    sourceWarning: '检测到旧版自由文本筛选，当前界面只支持结构化条件。请清空后重新添加条件。',
  };
}

export function validateTableFilterDraft(draft: TableFilterDraft, columns: TableColumn[]): TableFilterDraftValidation {
  const rowErrors = draft.conditions.map(() => '');
  const activeConditions = draft.conditions.filter((condition) => !isBlankCondition(condition));

  if (activeConditions.length === 0) {
    const normalizedLegacyValue = normalizeLegacyTextValue(draft.legacyTextValue);

    return {
      isValid: true,
      normalizedValue: normalizedLegacyValue,
      activeConditionCount: 0,
      error: null,
      rowErrors,
    };
  }

  const serializedConditions: string[] = [];

  for (let index = 0; index < draft.conditions.length; index += 1) {
    const condition = draft.conditions[index];

    if (isBlankCondition(condition)) {
      continue;
    }

    const serialized = serializeCondition(condition, columns);
    if (!serialized.value) {
      rowErrors[index] = serialized.error ?? '条件不完整';
      return {
        isValid: false,
        normalizedValue: '',
        activeConditionCount: activeConditions.length,
        error: `第 ${index + 1} 条条件：${rowErrors[index]}`,
        rowErrors,
      };
    }

    if (serializedConditions.length > 0) {
      serializedConditions.push(condition.connector === 'OR' ? '||' : '&&');
    }

    serializedConditions.push(serialized.value);
  }

  return {
    isValid: true,
    normalizedValue: serializedConditions.join(' '),
    activeConditionCount: activeConditions.length,
    error: null,
    rowErrors,
  };
}

export function getTableFilterValuePlaceholder(condition: TableFilterConditionDraft, columns: TableColumn[]): string {
  const column = columns.find((item) => item.Field === condition.field);

  if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
    return isNumericLikeColumn(column) ? '例如 30001, 30002' : '例如 active, paused';
  }

  if (condition.operator === 'LIKE') {
    return '例如 %active%';
  }

  return isNumericLikeColumn(column) ? '例如 30001' : '例如 active';
}

export function serializeTableFilterDraft(draft: TableFilterDraft): PersistedTableFilterDraft {
  return {
    conditions: draft.conditions.map((condition, index) => ({
      connector: index === 0 ? 'AND' : condition.connector,
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    })),
    legacyTextValue: draft.legacyTextValue,
    sourceWarning: draft.sourceWarning,
  };
}

export function deserializePersistedTableFilterDraft(
  persistedDraft: PersistedTableFilterDraft | null | undefined,
): TableFilterDraft | null {
  if (!persistedDraft) {
    return null;
  }

  const persistedConditions = Array.isArray(persistedDraft.conditions) ? persistedDraft.conditions : [];
  const conditions =
    persistedConditions.length > 0
      ? persistedConditions.map((condition, index) => ({
          id: createConditionId(),
          connector: (index === 0 ? 'AND' : condition.connector === 'OR' ? 'OR' : 'AND') as TableFilterConnector,
          field: typeof condition.field === 'string' ? condition.field : '',
          operator: condition.operator,
          value: typeof condition.value === 'string' ? condition.value : '',
        }))
      : [createEmptyCondition()];

  return {
    conditions,
    legacyTextValue: typeof persistedDraft.legacyTextValue === 'string' ? persistedDraft.legacyTextValue : '',
    sourceWarning: typeof persistedDraft.sourceWarning === 'string' ? persistedDraft.sourceWarning : null,
  };
}

export function getComparableTableFilterDraft(draft: TableFilterDraft) {
  const normalizedLegacyValue = normalizeLegacyTextValue(draft.legacyTextValue);
  const normalizedConditions = draft.conditions
    .map((condition) => ({
      connector: condition.connector,
      field: condition.field.trim(),
      operator: condition.operator,
      value: condition.value.trim(),
    }))
    .filter((condition) => condition.field !== '' || condition.value !== '');

  if (normalizedConditions.length === 0) {
    return normalizedLegacyValue === ''
      ? { normalizedValue: '' }
      : {
          legacyTextValue: normalizedLegacyValue,
        };
  }

  return {
    conditions: normalizedConditions,
  };
}
