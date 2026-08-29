import { mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { ingestFiles } from "./ingest-files"
import { readTables, dropTable } from "./tables"

const ID = "vitest-tables-source"
const DIR = path.join(process.cwd(), "data", "sources")
const DB = path.join(DIR, `${ID}.db`)

const csv = (name: string, body: string) =>
  new File([body], name, { type: "text/csv" })

beforeEach(() => {
  mkdirSync(DIR, { recursive: true })
  for (const s of ["", "-wal", "-shm"]) rmSync(DB + s, { force: true })
})

afterAll(() => {
  for (const s of ["", "-wal", "-shm"]) rmSync(DB + s, { force: true })
})

describe("readTables", () => {
  it("returns [] when the source has no db yet", () => {
    expect(readTables(ID)).toEqual([])
  })

  it("summarizes each table with row count and inferred column types", async () => {
    await ingestFiles(ID, [csv("movies.csv", "title,rating\nA,9\nB,3\n")])
    const tables = readTables(ID)
    expect(tables).toHaveLength(1)
    expect(tables[0]).toMatchObject({
      name: "movies",
      rowCount: 2,
      columns: [
        { name: "title", type: "string" },
        { name: "rating", type: "number" },
      ],
    })
  })
})

describe("re-ingesting a file with the same name", () => {
  it("replaces the table's contents", async () => {
    await ingestFiles(ID, [csv("movies.csv", "title,rating\nA,9\n")])
    await ingestFiles(ID, [csv("movies.csv", "title,rating\nA,9\nB,3\nC,7\n")])
    const tables = readTables(ID)
    expect(tables).toHaveLength(1)
    expect(tables[0].rowCount).toBe(3)
  })
})

describe("dropTable", () => {
  it("drops an existing table and returns true", async () => {
    await ingestFiles(ID, [
      csv("a.csv", "x\n1\n"),
      csv("b.csv", "y\n2\n"),
    ])
    expect(dropTable(ID, "a")).toBe(true)
    expect(readTables(ID).map(t => t.name)).toEqual(["b"])
  })

  it("returns false for a missing table", async () => {
    await ingestFiles(ID, [csv("a.csv", "x\n1\n")])
    expect(dropTable(ID, "nope")).toBe(false)
  })

  it("returns false when the source has no db", () => {
    expect(dropTable(ID, "a")).toBe(false)
  })
})
