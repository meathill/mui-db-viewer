import type { TableColumn } from './api-types';

export interface FilterCondition {
  field: string;
  operator: string;
  value: string | number | Array<string | number>;
}

export interface ParsedExpression {
  conditions: FilterCondition[];
  connectors: Array<'AND' | 'OR'>;
}

export interface ParseResult {
  isExpression: boolean;
  expression?: ParsedExpression;
  rawText?: string;
}

export type TableFilterMode = 'empty' | 'text' | 'expression';

export interface TableFilterAnalysis {
  normalizedValue: string;
  mode: TableFilterMode;
  isValid: boolean;
  error: string | null;
  summary: string;
  invalidFields: string[];
  conditionCount: number;
}

export interface TableFilterSuggestion {
  id: string;
  label: string;
  detail: string;
  kind: 'field' | 'operator' | 'value' | 'connector' | 'example';
  nextValue: string;
}

const BASIC_OPERATORS = ['>=', '<=', '!=', '>', '<', '='] as const;
const CONNECTOR_PATTERN = /&&|\|\|/g;
const TEXT_LIKE_TYPES = ['char', 'text', 'date', 'time', 'json', 'uuid'];
const NUMERIC_LIKE_TYPES = ['int', 'float', 'double', 'decimal', 'real', 'numeric', 'serial'];

function looksLikeExpression(input: string): boolean {
  return (
    /[><=!]/.test(input) ||
    input.includes('&&') ||
    input.includes('||') ||
    / like /i.test(input) ||
    / in\s*\(/i.test(input)
  );
}

function isWordBoundaryChar(char: string | undefined): boolean {
  return char === undefined || /\s|\(|\)|,/.test(char);
}

function tokenizeExpressionInput(input: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < input.length) {
    const current = input[index];

    if (current === undefined) {
      break;
    }

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      let end = index + 1;
      while (end < input.length && input[end] !== current) {
        end += 1;
      }
      tokens.push(input.slice(index, Math.min(end + 1, input.length)));
      index = Math.min(end + 1, input.length);
      continue;
    }

    const twoChars = input.slice(index, index + 2);
    if (['&&', '||', '>=', '<=', '!='].includes(twoChars)) {
      tokens.push(twoChars);
      index += 2;
      continue;
    }

    if (['>', '<', '=', '(', ')', ','].includes(current)) {
      tokens.push(current);
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < input.length) {
      const char = input[end];
      const nextTwoChars = input.slice(end, end + 2);
      if (char === undefined) {
        break;
      }
      if (
        /\s/.test(char) ||
        ['>', '<', '=', '(', ')', ','].includes(char) ||
        ['&&', '||', '>=', '<=', '!='].includes(nextTwoChars)
      ) {
        break;
      }
      end += 1;
    }

    tokens.push(input.slice(index, end));
    index = end;
  }

  return tokens;
}

function combineKeywordTokens(tokens: string[]): string[] {
  const combined: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const upperToken = token.toUpperCase();
    const nextToken = tokens[index + 1]?.toUpperCase();

    if (upperToken === 'NOT' && nextToken === 'IN') {
      combined.push('NOT IN');
      index += 1;
      continue;
    }

    if (upperToken === 'LIKE' || upperToken === 'IN') {
      combined.push(upperToken);
      continue;
    }

    combined.push(token);
  }

  return combined;
}

function rebuildExpression(tokens: string[]): string {
  let result = '';

  for (const token of combineKeywordTokens(tokens)) {
    if (token === ',') {
      result = `${result.trimEnd()}, `;
      continue;
    }

    if (token === '(') {
      result = `${result.trimEnd()} (`;
      continue;
    }

    if (token === ')') {
      result = `${result.trimEnd()})`;
      continue;
    }

    if (['&&', '||', 'LIKE', 'IN', 'NOT IN', ...BASIC_OPERATORS].includes(token)) {
      result = `${result.trimEnd()} ${token} `;
      continue;
    }

    if (result && !result.endsWith(' ')) {
      result += ' ';
    }
    result += token;
  }

  return result.trim();
}

function parseValue(raw: string): string | number {
  const trimmed = raw.trim();

  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  const parsedNumber = Number(trimmed);
  if (!Number.isNaN(parsedNumber) && trimmed !== '') {
    return parsedNumber;
  }

  return trimmed;
}

function parseCondition(expression: string): FilterCondition | null {
  const trimmed = expression.trim();
  if (!trimmed) {
    return null;
  }

  const inMatch = trimmed.match(/^(.*?)\s+(NOT\s+IN|IN|not\s+in|in)\s*\((.*)\)$/i);
  if (inMatch) {
    const field = inMatch[1]?.trim();
    const operator = inMatch[2]?.toUpperCase().replace(/\s+/g, ' ');
    const values = (inMatch[3] ?? '')
      .split(',')
      .map((value) => parseValue(value.trim()))
      .filter((value) => value !== '');

    if (field && operator && values.length > 0) {
      return {
        field,
        operator,
        value: values,
      };
    }
  }

  const likeMatch = trimmed.match(/^(.*?)\s+(LIKE|like)\s+(.*)$/i);
  if (likeMatch) {
    const field = likeMatch[1]?.trim();
    const rawValue = likeMatch[3]?.trim();

    if (field && rawValue) {
      return {
        field,
        operator: 'LIKE',
        value: parseValue(rawValue),
      };
    }
  }

  for (const operator of BASIC_OPERATORS) {
    const operatorIndex = trimmed.indexOf(operator);
    if (operatorIndex <= 0) {
      continue;
    }

    const field = trimmed.slice(0, operatorIndex).trim();
    const rawValue = trimmed.slice(operatorIndex + operator.length).trim();

    if (!field || !rawValue) {
      continue;
    }

    return {
      field,
      operator,
      value: parseValue(rawValue),
    };
  }

  return null;
}

function splitByLastConnector(input: string): { prefix: string; segment: string } {
  let lastMatch: RegExpExecArray | null = null;

  for (const match of input.matchAll(CONNECTOR_PATTERN)) {
    lastMatch = match;
  }

  if (!lastMatch || lastMatch.index === undefined) {
    return {
      prefix: '',
      segment: input.trim(),
    };
  }

  return {
    prefix: input.slice(0, lastMatch.index + lastMatch[0].length).trim(),
    segment: input.slice(lastMatch.index + lastMatch[0].length).trim(),
  };
}

function joinPrefix(prefix: string, segment: string): string {
  const trimmedSegment = segment.trim();
  if (!prefix) {
    return trimmedSegment;
  }
  if (!trimmedSegment) {
    return prefix;
  }
  return `${prefix} ${trimmedSegment}`.trim();
}

function isNumericLikeColumn(column: TableColumn | undefined): boolean {
  const type = column?.Type?.toLowerCase() ?? '';
  return NUMERIC_LIKE_TYPES.some((keyword) => type.includes(keyword));
}

function isTextLikeColumn(column: TableColumn | undefined): boolean {
  const type = column?.Type?.toLowerCase() ?? '';
  return TEXT_LIKE_TYPES.some((keyword) => type.includes(keyword));
}

function createFieldSuggestions(fieldNames: string[], prefix: string, keyword: string): TableFilterSuggestion[] {
  return fieldNames
    .filter((field) => field.toLowerCase().includes(keyword.toLowerCase()))
    .slice(0, 8)
    .map((field) => ({
      id: `field-${field}`,
      label: field,
      detail: '列名',
      kind: 'field' as const,
      nextValue: joinPrefix(prefix, field),
    }));
}

function createOperatorSuggestions(field: string, prefix: string, partial = ''): TableFilterSuggestion[] {
  const operators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN'];

  return operators
    .filter((operator) => operator.toLowerCase().startsWith(partial.toLowerCase()))
    .map((operator) => ({
      id: `operator-${field}-${operator}`,
      label: operator,
      detail: '运算符',
      kind: 'operator' as const,
      nextValue: joinPrefix(prefix, `${field} ${operator}`),
    }));
}

function createValueSuggestions(
  field: string,
  operator: string,
  prefix: string,
  columns: TableColumn[],
): TableFilterSuggestion[] {
  const column = columns.find((item) => item.Field === field);
  const valueOptions =
    operator === 'IN' || operator === 'NOT IN'
      ? isNumericLikeColumn(column)
        ? ['(1, 2, 3)']
        : ["('A', 'B')"]
      : operator === 'LIKE'
        ? ["'%关键词%'"]
        : isNumericLikeColumn(column)
          ? ['100', '0']
          : isTextLikeColumn(column)
            ? ["'示例值'", "'active'"]
            : ["'值'"];

  return valueOptions.map((value) => ({
    id: `value-${field}-${operator}-${value}`,
    label: value,
    detail: `给 ${field} 填值`,
    kind: 'value' as const,
    nextValue: joinPrefix(prefix, `${field} ${operator} ${value}`),
  }));
}

export function normalizeTableFilterInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (!looksLikeExpression(trimmed)) {
    return trimmed.replace(/\s+/g, ' ');
  }

  return rebuildExpression(tokenizeExpressionInput(trimmed));
}

export function parseSearchExpression(input: string): ParseResult {
  const normalizedInput = normalizeTableFilterInput(input);

  if (!normalizedInput) {
    return { isExpression: false, rawText: '' };
  }

  if (!looksLikeExpression(normalizedInput)) {
    return { isExpression: false, rawText: normalizedInput };
  }

  const parts: string[] = [];
  const connectors: Array<'AND' | 'OR'> = [];

  for (const segment of normalizedInput.split(/(&&|\|\|)/)) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed === '&&') {
      connectors.push('AND');
      continue;
    }
    if (trimmed === '||') {
      connectors.push('OR');
      continue;
    }
    parts.push(trimmed);
  }

  const conditions: FilterCondition[] = [];
  for (const part of parts) {
    const condition = parseCondition(part);
    if (!condition) {
      return { isExpression: false, rawText: normalizedInput };
    }
    conditions.push(condition);
  }

  if (conditions.length === 0) {
    return { isExpression: false, rawText: normalizedInput };
  }

  return {
    isExpression: true,
    expression: {
      conditions,
      connectors,
    },
  };
}

export function analyzeTableFilterInput(input: string, columns: TableColumn[] = []): TableFilterAnalysis {
  const normalizedValue = normalizeTableFilterInput(input);

  if (!normalizedValue) {
    return {
      normalizedValue,
      mode: 'empty',
      isValid: true,
      error: null,
      summary: '当前未设置筛选条件',
      invalidFields: [],
      conditionCount: 0,
    };
  }

  const parsed = parseSearchExpression(normalizedValue);
  const isExpressionCandidate = looksLikeExpression(normalizedValue);

  if (!isExpressionCandidate) {
    return {
      normalizedValue,
      mode: 'text',
      isValid: true,
      error: null,
      summary: '将按全文搜索处理',
      invalidFields: [],
      conditionCount: 0,
    };
  }

  if (!parsed.isExpression || !parsed.expression) {
    return {
      normalizedValue,
      mode: 'expression',
      isValid: false,
      error: "表达式不完整。可参考：application_id = 30001 && status = 'active'",
      summary: '当前草稿未生效',
      invalidFields: [],
      conditionCount: 0,
    };
  }

  const fieldSet = new Set(columns.map((column) => column.Field));
  const invalidFields =
    columns.length > 0
      ? parsed.expression.conditions.map((condition) => condition.field).filter((field) => !fieldSet.has(field))
      : [];

  if (invalidFields.length > 0) {
    return {
      normalizedValue,
      mode: 'expression',
      isValid: false,
      error: `列名不存在：${invalidFields.join('、')}`,
      summary: '当前草稿未生效',
      invalidFields,
      conditionCount: parsed.expression.conditions.length,
    };
  }

  return {
    normalizedValue,
    mode: 'expression',
    isValid: true,
    error: null,
    summary: `将按 ${parsed.expression.conditions.length} 条表达式条件筛选`,
    invalidFields: [],
    conditionCount: parsed.expression.conditions.length,
  };
}

export function getTableFilterSuggestions(input: string, columns: TableColumn[] = []): TableFilterSuggestion[] {
  const normalizedValue = normalizeTableFilterInput(input);
  const fieldNames = columns.map((column) => column.Field);
  const { prefix, segment } = splitByLastConnector(normalizedValue);

  if (!segment) {
    if (fieldNames.length > 0) {
      return createFieldSuggestions(fieldNames, prefix, '');
    }
    return [
      {
        id: 'example-id',
        label: 'id = 1',
        detail: '示例',
        kind: 'example',
        nextValue: 'id = 1',
      },
    ];
  }

  const completeCondition = parseCondition(segment);
  if (completeCondition) {
    const currentValue = joinPrefix(prefix, segment);
    return [
      {
        id: 'connector-and',
        label: '&&',
        detail: '继续追加条件（AND）',
        kind: 'connector',
        nextValue: `${currentValue} &&`,
      },
      {
        id: 'connector-or',
        label: '||',
        detail: '继续追加条件（OR）',
        kind: 'connector',
        nextValue: `${currentValue} ||`,
      },
    ];
  }

  const valueStageMatch =
    segment.match(/^(.*?)\s+(NOT\s+IN|IN|LIKE)\s*$/i) ?? segment.match(/^(.*?)\s*(>=|<=|!=|>|<|=)\s*$/);
  if (valueStageMatch) {
    const field = valueStageMatch[1]?.trim();
    const operator = valueStageMatch[2]?.toUpperCase().replace(/\s+/g, ' ');
    if (field && operator) {
      return createValueSuggestions(field, operator, prefix, columns);
    }
  }

  const partialOperatorMatch = segment.match(/^([A-Za-z0-9_.$]+)\s+([A-Za-z<>!=]*)$/);
  if (partialOperatorMatch && fieldNames.includes(partialOperatorMatch[1] ?? '')) {
    return createOperatorSuggestions(partialOperatorMatch[1] ?? '', prefix, partialOperatorMatch[2] ?? '');
  }

  if (fieldNames.includes(segment)) {
    return createOperatorSuggestions(segment, prefix);
  }

  const fieldKeyword = segment.split(/\s+/).at(-1) ?? segment;
  if (fieldKeyword && isWordBoundaryChar(segment.at(-1))) {
    return createFieldSuggestions(fieldNames, prefix, '');
  }

  return createFieldSuggestions(fieldNames, prefix, fieldKeyword || segment);
}
