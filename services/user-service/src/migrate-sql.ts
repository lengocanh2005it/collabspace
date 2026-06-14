/** Split a SQL file into executable statements (comments stripped). */
export function parseSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return withoutComments
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function statementUsesConcurrently(statement: string): boolean {
  return /\bCONCURRENTLY\b/i.test(statement);
}
