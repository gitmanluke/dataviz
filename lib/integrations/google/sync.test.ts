import { describe, expect, it } from "vitest"
import { isDue } from "./sync"

const now = new Date("2026-08-29T12:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe("isDue", () => {
  it("manual is never due", () => {
    expect(isDue(null, "manual", now)).toBe(false)
    expect(isDue(ago(365 * DAY), "manual", now)).toBe(false)
  })

  it("unknown intervals are never due", () => {
    expect(isDue(null, "yearly", now)).toBe(false)
  })

  it("a never-synced source is due for any real interval", () => {
    for (const i of ["on-open", "hourly", "daily", "weekly", "monthly"]) {
      expect(isDue(null, i, now)).toBe(true)
    }
  })

  it("on-open respects a 30s min gap", () => {
    expect(isDue(ago(10_000), "on-open", now)).toBe(false)
    expect(isDue(ago(31_000), "on-open", now)).toBe(true)
  })

  it("interval buckets compare against the age", () => {
    expect(isDue(ago(59 * MIN), "hourly", now)).toBe(false)
    expect(isDue(ago(61 * MIN), "hourly", now)).toBe(true)

    expect(isDue(ago(23 * HOUR), "daily", now)).toBe(false)
    expect(isDue(ago(25 * HOUR), "daily", now)).toBe(true)

    expect(isDue(ago(6 * DAY), "weekly", now)).toBe(false)
    expect(isDue(ago(8 * DAY), "weekly", now)).toBe(true)

    expect(isDue(ago(29 * DAY), "monthly", now)).toBe(false)
    expect(isDue(ago(31 * DAY), "monthly", now)).toBe(true)
  })
})
