// Shared client + server — how often a sheets source is re-checked. Enforcement
// is opportunistic (on app activity), gated by a Drive modifiedTime check.
export const REFRESH_INTERVALS = [
  { value: "manual", label: "Manual only" },
  { value: "on-open", label: "When I open a dashboard" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const

export type RefreshInterval = (typeof REFRESH_INTERVALS)[number]["value"]

export function isRefreshInterval(value: string): value is RefreshInterval {
  return REFRESH_INTERVALS.some(i => i.value === value)
}
