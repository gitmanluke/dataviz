import type Database from "better-sqlite3"

/**
 * Guardrail for model-generated SQL. A query may run only if it is a single
 * read-only statement with no write/DDL keywords or filesystem functions, and
 * it prepares cleanly against the real schema. Execution then happens on a
 * `{ readonly: true }` connection as a second line of defence.
 */

const BLOCKED_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|GRANT|REVOKE)\b/i

const BLOCKED_FUNCTIONS =
  /\b(load_extension|readfile|writefile|fts3_tokenizer|zipfile)\s*\(/i

/** Blank out string literals and comments so the keyword scan can't be fooled
 *  (`WHERE name = 'a; DROP'`) or trip on them. */
function stripLiterals(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
}

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export function validateSql(sql: string, db: Database.Database): ValidationResult {
  if (typeof sql !== "string" || !sql.trim()) {
    return { ok: false, reason: "empty query" }
  }

  const scan = stripLiterals(sql)
  const kw = scan.match(BLOCKED_KEYWORDS)
  if (kw) return { ok: false, reason: `disallowed keyword: ${kw[1].toUpperCase()}` }
  const fn = scan.match(BLOCKED_FUNCTIONS)
  if (fn) return { ok: false, reason: `disallowed function: ${fn[1].toLowerCase()}` }

  let stmt: Database.Statement
  try {
    // Throws on: multiple statements, syntax errors, unknown tables/columns.
    stmt = db.prepare(sql)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "query does not parse" }
  }

  if (!stmt.reader) {
    return { ok: false, reason: "only read-only SELECT queries are allowed" }
  }

  return { ok: true }
}
