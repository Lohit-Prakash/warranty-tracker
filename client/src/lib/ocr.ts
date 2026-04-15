export interface OcrResult {
  text: string
  purchaseDate: string | null
  serialNumber: string | null
}

// Parse common date formats and return YYYY-MM-DD
function parseDateCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  // ISO: 2024-01-15
  let m = trimmed.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // US / EU: 01/15/2024 or 15/01/2024 — assume US (MM/DD/YYYY)
  m = trimmed.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) {
    const [, a, b, y] = m
    const mo = parseInt(a, 10)
    const d = parseInt(b, 10)
    // If first part > 12, it's DD/MM/YYYY
    if (mo > 12) {
      return `${y}-${String(d).padStart(2, '0')}-${String(mo).padStart(2, '0')}`
    }
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // Month name: "Jan 15, 2024" or "15 Jan 2024"
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  }
  m = trimmed.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/)
  if (m) {
    const mo = months[m[1].slice(0, 3).toLowerCase()]
    if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  m = trimmed.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/)
  if (m) {
    const mo = months[m[2].slice(0, 3).toLowerCase()]
    if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

export async function runOcr(file: File): Promise<OcrResult> {
  // Lazy-load tesseract so it doesn't bloat the initial bundle
  const Tesseract = (await import('tesseract.js')).default
  const { data } = await Tesseract.recognize(file, 'eng')
  const text = data.text || ''

  // Find the first parseable date (purchase date heuristic)
  const lines = text.split(/\r?\n/)
  let purchaseDate: string | null = null
  for (const line of lines) {
    const parsed = parseDateCandidate(line)
    if (parsed) {
      purchaseDate = parsed
      break
    }
  }

  // Serial number heuristic: "S/N", "Serial", "SN:" followed by alphanumeric
  let serialNumber: string | null = null
  const snMatch = text.match(/(?:S\/N|Serial\s*(?:No\.?|Number)?|SN)[:\s]+([A-Z0-9-]{5,})/i)
  if (snMatch) {
    serialNumber = snMatch[1].trim()
  }

  return { text, purchaseDate, serialNumber }
}
