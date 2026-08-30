import { mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { runSql } from "./index"

const ID = "vitest-refresh-source"
const DIR = path.join(process.cwd(), "data", "sources")
const DB = path.join(DIR, `${ID}.db`)

const source = { id: ID, type: "files" } as Parameters<typeof runSql>[1]

beforeAll(() => {
  mkdirSync(DIR, { recursive: true })
  rmSync(DB, { force: true })
  const db = new Database(DB)
  db.exec("CREATE TABLE movies (title TEXT, rating REAL)")
  db.prepare("INSERT INTO movies VALUES (?, ?)").run("A", 9)
  db.prepare("INSERT INTO movies VALUES (?, ?)").run("B", 3)
  db.close()
})

afterAll(() => {
  for (const s of ["", "-wal", "-shm"]) rmSync(DB + s, { force: true })
})

describe("runSql", () => {
  it("runs a stored SELECT and returns typed rows", async () => {
    const r = await runSql("SELECT title, rating FROM movies ORDER BY rating DESC", source)
    expect(r.rows).toEqual([{ title: "A", rating: 9 }, { title: "B", rating: 3 }])
    expect(r.columns).toEqual([
      { name: "title", type: "string" },
      { name: "rating", type: "number" },
    ])
    expect(r.sql).toContain("SELECT")
  })

  it("rejects a write", async () => {
    await expect(runSql("DELETE FROM movies", source)).rejects.toThrow(/rejected/i)
  })

  it("rejects statement stacking", async () => {
    await expect(runSql("SELECT 1; DROP TABLE movies", source)).rejects.toThrow()
  })

  it("caps rows and flags truncation", async () => {
    const db = new Database(DB)
    const ins = db.prepare("INSERT INTO movies VALUES (?, ?)")
    const tx = db.transaction(() => { for (let i = 0; i < 250; i++) ins.run(`m${i}`, i) })
    tx()
    db.close()
    const r = await runSql("SELECT * FROM movies", source)
    expect(r.rows.length).toBe(200)
    expect(r.truncated).toBe(true)
  })

  it("rejects a source type that isn't backed by SQLite", async () => {
    await expect(
      runSql("SELECT 1", { id: ID, type: "postgres" } as Parameters<typeof runSql>[1]),
    ).rejects.toThrow(/can't be queried/i)
  })

  it("runs against a sheets source (same per-source SQLite DB)", async () => {
    const sheetsSource = { id: ID, type: "sheets" } as Parameters<typeof runSql>[1]
    const r = await runSql("SELECT count(*) AS n FROM movies", sheetsSource)
    expect((r.rows[0] as { n: number }).n).toBeGreaterThan(0)
  })
})
