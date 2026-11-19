/**
 * Format any rack input (string, object with { id, branchId, code, shelfNumber, description }, or null)
 * safely to a display string to prevent React Error #31 (Objects are not valid as a React child).
 */
export function formatRack(rack: unknown): string {
  if (!rack) return ''
  if (typeof rack === 'string') return rack
  if (typeof rack === 'number') return String(rack)
  if (typeof rack === 'object' && rack !== null) {
    const r = rack as {
      code?: string
      shelfNumber?: number | string | null
      name?: string
      description?: string
    }
    if (r.code) {
      return r.shelfNumber ? `${r.code}-${r.shelfNumber}` : r.code
    }
    if (r.name) return r.name
    if (r.description) return r.description
  }
  return ''
}

export function formatShelf(shelf: unknown): string {
  if (!shelf) return ''
  if (typeof shelf === 'string' || typeof shelf === 'number') return String(shelf)
  if (typeof shelf === 'object' && shelf !== null) {
    const s = shelf as { shelfNumber?: number | string; name?: string; code?: string }
    if (s.shelfNumber) return String(s.shelfNumber)
    if (s.name) return s.name
    if (s.code) return s.code
  }
  return ''
}

