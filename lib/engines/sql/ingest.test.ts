import Database from "better-sqlite3"
import { describe, expect, it } from "vitest"
import {
  createTable,
  inferType,
  isSqliteBuffer,
  rowsFromCsv,
  safeIdent,
  tablesFromSqlite,
} from "./ingest"

describe("inferType", () => {
  it.each([
    [["1", "2", "3"], "INTEGER"],
    [["1", "2.5"], "REAL"],
    [["1", "x"], "TEXT"],
    [[1, 2, null], "INTEGER"],
    [[1.5, 2.0], "REAL"],
    [[null, null], "TEXT"],
    [["", "  "], "TEXT"],
    [["02134", "90210"], "TEXT"], // zip codes
    [["12345678901234567890"], "TEXT"], // long id
    [["2026-01-01"], "TEXT"],
  ])("%j -> %s", (values, expected) => {
    expect(inferType(values as unknown[])).toBe(expected)
  })
})

describe("safeIdent", () => {
  it("passes plain names", () => expect(safeIdent("first_name")).toBe("first_name"))
  it("quotes names with spaces", () => expect(safeIdent("first name")).toBe('"first name"'))
  it("escapes quotes", () => expect(safeIdent('a"b')).toBe('"a""b"'))
  it("rejects control chars", () => expect(() => safeIdent("a\nb")).toThrow())
})

describe("rowsFromCsv", () => {
  it("parses header + rows, empty -> null", () => {
    const { columns, rows } = rowsFromCsv(Buffer.from("a,b\n1,\n,2\n"))
    expect(columns).toEqual(["a", "b"])
    expect(rows).toEqual([["1", null], [null, "2"]])
  })
  it("handles quoted commas and newlines", () => {
    const { rows } = rowsFromCsv(Buffer.from('name,note\n"Smith, J.","l1\nl2"\n'))
    expect(rows).toEqual([["Smith, J.", "l1\nl2"]])
  })
  it("header only", () => {
    expect(rowsFromCsv(Buffer.from("a,b\n"))).toEqual({ columns: ["a", "b"], rows: [] })
  })
})

describe("createTable", () => {
  const fresh = () => new Database(":memory:")

  it("types columns and coerces values", () => {
    const db = fresh()
    createTable(db, "movies", ["title", "rating"], [["Inception", "8.8"], ["The Room", "3.7"]])
    expect(db.prepare("SELECT * FROM movies ORDER BY rating DESC").all()).toEqual([
      { title: "Inception", rating: 8.8 },
      { title: "The Room", rating: 3.7 },
    ])
  })

  it("stores injection attempts as data", () => {
    const db = fresh()
    const evil = "x'; DROP TABLE movies; --"
    createTable(db, "t", ["a"], [[evil]])
    expect(db.prepare("SELECT a FROM t").get()).toEqual({ a: evil })
  })

  it("replaces on re-create", () => {
    const db = fresh()
    createTable(db, "t", ["a"], [["1"], ["2"]])
    createTable(db, "t", ["a"], [["9"]])
    expect(db.prepare("SELECT a FROM t").all()).toEqual([{ a: 9 }])
  })

  it("rejects duplicate columns", () => {
    expect(() => createTable(fresh(), "t", ["a", "a"], [])).toThrow(/duplicate/)
  })

  it("handles an empty table", () => {
    const db = fresh()
    createTable(db, "t", ["a", "b"], [])
    expect(db.prepare("SELECT * FROM t").all()).toEqual([])
  })
})

describe("sqlite passthrough", () => {
  it("isSqliteBuffer", () => {
    const db = new Database(":memory:")
    db.exec("CREATE TABLE t (x)")
    const buf = db.serialize()
    expect(isSqliteBuffer(buf)).toBe(true)
    expect(isSqliteBuffer(Buffer.from("a,b\n1,2"))).toBe(false)
  })

  it("tablesFromSqlite reads every table", () => {
    const db = new Database(":memory:")
    db.exec("CREATE TABLE a (x INT, y TEXT); INSERT INTO a VALUES (1,'one'),(2,'two'); CREATE TABLE b (z)")
    const out = tablesFromSqlite(db.serialize())
    expect(out.map(t => t.name).sort()).toEqual(["a", "b"])
    const a = out.find(t => t.name === "a")!
    expect(a.columns).toEqual(["x", "y"])
    expect(a.rows).toEqual([[1, "one"], [2, "two"]])
  })
})
