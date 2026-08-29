/** Accepts a bare spreadsheet id or a docs.google.com spreadsheet URL. */
export function extractSpreadsheetId(input: string): string | null {
  const s = input.trim()
  if (!s) return null

  const fromUrl = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)
  if (fromUrl) return fromUrl[1]

  // A bare id: Drive file ids are long base64url-ish strings.
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s

  return null
}
