import * as XLSX from 'xlsx'

export interface ExcelSheetConfig {
  sheetName: string
  title: string
  subtitle?: string
  metadata?: Record<string, string | number>
  headers: string[]
  data: (string | number | boolean | null | undefined)[][]
  columnWidths?: number[]
  summaryRow?: (string | number | null)[]
}

export interface ExcelWorkbookConfig {
  filename: string
  organizationName?: string
  sheets: ExcelSheetConfig[]
}

/**
 * Sanitizes a worksheet name according to Excel rules:
 * - Max length: 31 characters
 * - Forbidden characters: \ / ? * [ ] :
 */
export function sanitizeSheetName(name: string, fallbackIndex = 1): string {
  const cleaned = (name || '')
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  if (!cleaned) return `Sheet${fallbackIndex}`
  return cleaned.slice(0, 31)
}

/**
 * Determines cell number format (z property in SheetJS) based on column header and value
 */
function getCellFormat(headerName: string, value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined
  const header = (headerName || '').toLowerCase()

  if (header.includes('%') || header.includes('percent') || header.includes('margin')) {
    // If value is a fraction (e.g. 0.18 for 18%), format as percentage
    if (value >= 0 && value <= 1) {
      return '0.0%'
    }
    return '#,##0.00'
  }

  if (
    header.includes('amount') ||
    header.includes('price') ||
    header.includes('revenue') ||
    header.includes('cost') ||
    header.includes('cogs') ||
    header.includes('profit') ||
    header.includes('tax') ||
    header.includes('discount') ||
    header.includes('value') ||
    header.includes('subtotal') ||
    header.includes('total') ||
    header.includes('balance') ||
    header.includes('mrp') ||
    header.includes('rate') ||
    header.includes('fee') ||
    header.includes('commission') ||
    header.includes('₹')
  ) {
    return '#,##0.00'
  }

  if (
    header.includes('qty') ||
    header.includes('quantity') ||
    header.includes('units') ||
    header.includes('count') ||
    header.includes('days') ||
    header.includes('number') ||
    header.includes('items')
  ) {
    return '#,##0'
  }

  if (!Number.isInteger(value)) {
    return '#,##0.00'
  }

  return undefined
}

/**
 * Constructs an XLSX WorkBook object from the provided workbook configuration
 */
export function buildWorkbook(config: ExcelWorkbookConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const usedSheetNames = new Set<string>()

  const organization = config.organizationName || 'Metapharsic Pharmacy'

  for (let idx = 0; idx < config.sheets.length; idx++) {
    const sheetConfig = config.sheets[idx]
    const rows: (string | number | boolean | null | undefined)[][] = []

    // 1. Organization & Title Header
    rows.push([organization])
    rows.push([sheetConfig.title])
    if (sheetConfig.subtitle) {
      rows.push([sheetConfig.subtitle])
    }

    // 2. Metadata Key-Value pairs
    if (sheetConfig.metadata && Object.keys(sheetConfig.metadata).length > 0) {
      rows.push([])
      for (const [key, val] of Object.entries(sheetConfig.metadata)) {
        rows.push([`${key}:`, val])
      }
    }

    // 3. Separator row
    rows.push([])

    // 4. Table Headers
    rows.push([...sheetConfig.headers])

    // 5. Data Rows
    const dataStartRowIndex = rows.length
    for (const dataRow of sheetConfig.data) {
      rows.push([...dataRow])
    }

    // 6. Summary Row (if provided)
    let summaryRowIndex: number | undefined = undefined
    if (sheetConfig.summaryRow && sheetConfig.summaryRow.length > 0) {
      summaryRowIndex = rows.length
      rows.push([...sheetConfig.summaryRow])
    }

    // Convert array of arrays to worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Calculate Dynamic Column Widths
    const numCols = sheetConfig.headers.length
    const colWidths: { wch: number }[] = []

    for (let c = 0; c < numCols; c++) {
      let maxCharLen = (sheetConfig.headers[c] || '').toString().length

      // Check data rows
      for (let r = 0; r < sheetConfig.data.length; r++) {
        const cellVal = sheetConfig.data[r][c]
        if (cellVal !== null && cellVal !== undefined) {
          const str = String(cellVal)
          if (str.length > maxCharLen) {
            maxCharLen = str.length
          }
        }
      }

      // Check summary row
      if (sheetConfig.summaryRow && sheetConfig.summaryRow[c] !== undefined) {
        const str = String(sheetConfig.summaryRow[c] ?? '')
        if (str.length > maxCharLen) {
          maxCharLen = str.length
        }
      }

      // Use explicit override if provided
      if (sheetConfig.columnWidths && sheetConfig.columnWidths[c]) {
        colWidths.push({ wch: sheetConfig.columnWidths[c] })
      } else {
        // Clamp column width between 12 and 55 characters with 3 chars padding
        const wch = Math.max(12, Math.min(55, maxCharLen + 3))
        colWidths.push({ wch })
      }
    }

    ws['!cols'] = colWidths

    // Apply number formats to data cells
    for (let r = 0; r < sheetConfig.data.length; r++) {
      const rowIndex = dataStartRowIndex + r
      for (let c = 0; c < numCols; c++) {
        const headerName = sheetConfig.headers[c] || ''
        const val = sheetConfig.data[r][c]
        const fmt = getCellFormat(headerName, val)
        if (fmt) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c })
          const cell = ws[cellAddress]
          if (cell && cell.t === 'n') {
            cell.z = fmt
          }
        }
      }
    }

    // Apply number formats to summary cells
    if (summaryRowIndex !== undefined && sheetConfig.summaryRow) {
      for (let c = 0; c < numCols; c++) {
        const headerName = sheetConfig.headers[c] || ''
        const val = sheetConfig.summaryRow[c]
        const fmt = getCellFormat(headerName, val)
        if (fmt) {
          const cellAddress = XLSX.utils.encode_cell({ r: summaryRowIndex, c })
          const cell = ws[cellAddress]
          if (cell && cell.t === 'n') {
            cell.z = fmt
          }
        }
      }
    }

    // Determine unique sanitized sheet name
    const baseSheetName = sanitizeSheetName(sheetConfig.sheetName, idx + 1)
    let finalSheetName = baseSheetName
    let counter = 2
    while (usedSheetNames.has(finalSheetName.toLowerCase())) {
      finalSheetName = `${baseSheetName.slice(0, 28)}_${counter}`
      counter++
    }
    usedSheetNames.add(finalSheetName.toLowerCase())

    XLSX.utils.book_append_sheet(wb, ws, finalSheetName)
  }

  return wb
}

/**
 * Generates a binary Node.js Buffer containing the complete .xlsx workbook
 */
export function generateExcelWorkbook(config: ExcelWorkbookConfig): Buffer {
  const wb = buildWorkbook(config)
  const output = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer
  return Buffer.from(output)
}


/**
 * Client-side single-click workbook downloader for browsers
 */
export function downloadExcelWorkbook(config: ExcelWorkbookConfig): void {
  const wb = buildWorkbook(config)
  const fullFilename = config.filename.toLowerCase().endsWith('.xlsx')
    ? config.filename
    : `${config.filename}.xlsx`

  if (typeof window !== 'undefined') {
    XLSX.writeFile(wb, fullFilename)
  }
}
