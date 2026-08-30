import Database from "better-sqlite3"
import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { validateSql } from "./validator"

let db: Database.Database

beforeAll(() => {
  db = new Database(":memory:")
  db.exec(`
    CREATE TABLE people (id INTEGER, name TEXT, age INTEGER);
    CREATE TABLE players (id INTEGER, name TEXT, goals INTEGER);
  `)
})
afterAll(() => db.close())

const ok = (sql: string) => expect(validateSql(sql, db)).toEqual({ ok: true })
const bad = (sql: string, fragment: string) => {
  const r = validateSql(sql, db)
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.reason.toLowerCase()).toContain(fragment.toLowerCase())
}

describe("allowed", () => {
  it.each([
    "SELECT name FROM people",
    "select * from people where id = 1",
    "SELECT p.name, pl.goals FROM people p JOIN players pl ON p.name = pl.name",
    "SELECT name FROM people UNION SELECT name FROM players",
    "SELECT name FROM people WHERE age > (SELECT AVG(age) FROM people)",
    "WITH top AS (SELECT name FROM players ORDER BY goals DESC LIMIT 3) SELECT * FROM top",
    "SELECT name FROM people WHERE name = 'Bob; DROP TABLE people'",
    "SELECT name FROM people -- trailing comment",
  ])("%s", ok)
})

describe("blocked", () => {
  it("INSERT", () => bad("INSERT INTO people VALUES (1,'x',2)", "keyword: INSERT"))
  it("UPDATE", () => bad("UPDATE people SET name='x'", "keyword: UPDATE"))
  it("DELETE", () => bad("DELETE FROM people", "keyword: DELETE"))
  it("DROP", () => bad("DROP TABLE people", "keyword: DROP"))
  it("PRAGMA", () => bad("PRAGMA table_info(people)", "keyword: PRAGMA"))
  it("ATTACH", () => bad("SELECT 1 FROM people; ATTACH DATABASE 'x' AS y", "keyword: ATTACH"))
  it("statement stacking", () => bad("SELECT 1; SELECT 2", "more than one statement"))
  it("stacking with DROP", () => bad("SELECT name FROM people; DROP TABLE people", "keyword: DROP"))
  it("load_extension", () => bad("SELECT load_extension('x') FROM people", "function: load_extension"))
  it("readfile", () => bad("SELECT readfile('/etc/passwd')", "function: readfile"))
  it("unknown table", () => bad("SELECT * FROM ghost", "no such table"))
  it("unknown column", () => bad("SELECT nope FROM people", "no such column"))
  it("syntax error", () => {
    // rejected at db.prepare(); exact SQLite wording varies by build
    const r = validateSql("SELECT name FROM people WHERE", db)
    expect(r).toEqual({ ok: false, reason: expect.any(String) })
  })
  it("empty", () => bad("   ", "empty"))
  it("non-select expression-only is fine", () => ok("SELECT 1 + 1 AS two"))
})
