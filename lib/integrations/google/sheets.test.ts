import { rmSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// syncSheet's only I/O is via ./rest — stub it and let the real SQLite write run.
const sheetsGet = vi.fn()
const driveGet = vi.fn()
vi.mock("./rest", () => ({
  sheetsGet: (...a: unknown[]) => sheetsGet(...a),
  driveGet: (...a: unknown[]) => driveGet(...a),
}))

import { parseSpreadsheet, syncSheet } from "./sheets"
import { readTables } from "@/lib/engines/sql/tables"

const meta = (tabs: Array<{ title: string; sheetType?: string }>) => ({
  properties: { title: "Book" },
  sheets: tabs.map(t => ({ properties: { title: t.title, sheetType: t.sheetType ?? "GRID" } })),
})

describe("parseSpreadsheet", () => {
  it("first row is the header; ragged rows are padded, blank cells null", () => {
    const [t] = parseSpreadsheet(
      meta([{ title: "Sales" }]),
      new Map([["Sales", [["a", "b", "c"], ["1", "2"], ["x", "", "z"]]]]),
    )
    expect(t.name).toBe("Sales")
    expect(t.columns).toEqual(["a", "b", "c"])
    expect(t.rows).toEqual([
      ["1", "2", null],
      ["x", null, "z"],
    ])
  })

  it("de-dupes and backfills blank header cells", () => {
    const [t] = parseSpreadsheet(
      meta([{ title: "T" }]),
      new Map([["T", [["id", "id", ""], ["1", "2", "3"]]]]),
    )
    expect(t.columns).toEqual(["id", "id_2", "column_3"])
  })

  it("skips non-GRID tabs and empty tabs", () => {
    const tables = parseSpreadsheet(
      meta([
        { title: "Chart", sheetType: "OBJECT" },
        { title: "Empty" },
        { title: "Data" },
      ]),
      new Map([
        ["Empty", []],
        ["Data", [["x"], ["1"]]],
      ]),
    )
    expect(tables.map(t => t.name)).toEqual(["Data"])
  })

  it("drops all-null rows and caps at SHEET_ROW_CAP", () => {
    const big: unknown[][] = [["n"]]
    for (let i = 0; i < 50_005; i++) big.push([String(i)])
    big.splice(3, 0, ["", ""]) // an all-blank row
    const [t] = parseSpreadsheet(meta([{ title: "Big" }]), new Map([["Big", big]]))
    expect(t.rows.length).toBe(50_000)
    expect(t.truncated).toBe(true)
  })

  it("sanitises tab titles into table names and de-dupes collisions", () => {
    const tables = parseSpreadsheet(
      meta([{ title: "Q1 2024" }, { title: "Q1/2024" }]),
      new Map([
        ["Q1 2024", [["a"], ["1"]]],
        ["Q1/2024", [["a"], ["2"]]],
      ]),
    )
    expect(tables.map(t => t.name)).toEqual(["Q1_2024", "Q1_2024_2"])
  })
})

describe("syncSheet", () => {
  const ID = "vitest-sheets-source"
  const DB = path.join(process.cwd(), "data", "sources", `${ID}.db`)

  beforeEach(() => {
    for (const s of ["", "-wal", "-shm"]) rmSync(DB + s, { force: true })
    sheetsGet.mockReset()
    driveGet.mockReset()
  })
  afterAll(() => {
    for (const s of ["", "-wal", "-shm"]) rmSync(DB + s, { force: true })
  })

  const stub = (tabs: string[], values: Record<string, unknown[][]>) => {
    sheetsGet.mockImplementation(async (route: string) => {
      if (route.includes(":batchGet")) {
        return { valueRanges: tabs.map(t => ({ values: values[t] ?? [] })) }
      }
      return meta(tabs.map(title => ({ title })))
    })
  }

  it("writes one table per tab", async () => {
    stub(["People"], { People: [["name", "age"], ["Ada", "36"], ["Bo", "40"]] })
    const res = await syncSheet(ID, "sheet-1")
    expect(res.title).toBe("Book")
    const tables = readTables(ID)
    expect(tables).toHaveLength(1)
    expect(tables[0]).toMatchObject({ name: "People", rowCount: 2 })
    expect(tables[0].columns.map(c => c.type)).toEqual(["string", "number"])
  })

  it("drops tables for tabs that no longer exist on re-sync", async () => {
    stub(["A", "B"], { A: [["x"], ["1"]], B: [["y"], ["2"]] })
    await syncSheet(ID, "sheet-1")
    expect(readTables(ID).map(t => t.name)).toEqual(["A", "B"])

    stub(["A"], { A: [["x"], ["1"], ["9"]] })
    await syncSheet(ID, "sheet-1")
    expect(readTables(ID).map(t => t.name)).toEqual(["A"])
    expect(readTables(ID)[0].rowCount).toBe(2)
  })
})
