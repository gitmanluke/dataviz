const PREFIX = "dataviz:"

function isBrowser() {
  return typeof window !== "undefined"
}

export function getStore<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setStore<T>(key: string, value: T): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function updateStore<T>(key: string, updater: (current: T) => T, fallback: T): void {
  const current = getStore<T>(key, fallback)
  setStore(key, updater(current))
}
