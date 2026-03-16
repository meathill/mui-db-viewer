function isEscapedQuestionMark(sql: string, index: number): boolean {
  return sql[index - 1] === '\\';
}

export function replaceQuestionMarkPlaceholders(sql: string): { sql: string; count: number } {
  let result = '';
  let count = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      result += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      result += char;
      if (char === '*' && next === '/') {
        result += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      if (char === '-' && next === '-') {
        result += '--';
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        result += '/*';
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDoubleQuote && !inBacktickQuote && char === "'") {
      const escaped = inSingleQuote && next === "'";
      result += char;
      if (escaped) {
        result += next;
        index += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inBacktickQuote && char === '"') {
      const escaped = inDoubleQuote && next === '"';
      result += char;
      if (escaped) {
        result += next;
        index += 1;
      } else {
        inDoubleQuote = !inDoubleQuote;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '`') {
      inBacktickQuote = !inBacktickQuote;
      result += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote && char === '?' && !isEscapedQuestionMark(sql, index)) {
      count += 1;
      result += `$${count}`;
      continue;
    }

    result += char;
  }

  return { sql: result, count };
}

export function countQuestionMarkPlaceholders(sql: string): number {
  return replaceQuestionMarkPlaceholders(sql).count;
}
