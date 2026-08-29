import { describe, expect, it } from "vitest"
import { extractSpreadsheetId } from "./ids"

describe("extractSpreadsheetId", () => {
  const id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

  it("pulls the id out of an edit URL", () => {
    expect(
      extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`),
    ).toBe(id)
  })

  it("accepts a bare id", () => {
    expect(extractSpreadsheetId(`  ${id}  `)).toBe(id)
  })

  it("rejects junk", () => {
    expect(extractSpreadsheetId("")).toBeNull()
    expect(extractSpreadsheetId("not a sheet")).toBeNull()
    expect(extractSpreadsheetId("https://example.com/x")).toBeNull()
  })
})
