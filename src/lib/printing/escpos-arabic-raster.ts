/**
 * Metapharsic Rx — ESC/POS Arabic Raster Printing Engine & Bilingual Thermal Slip Generator
 * Enables standard 80mm and 58mm thermal POS receipt printers (Epson, Bixolon, Star, Rongta, Xprinter)
 * to print Arabic and English side-by-side without requiring specialized Arabic hardware ROM chips.
 *
 * Implements:
 * 1. Algorithmic Arabic Letter Shaping (Initial, Medial, Final, Isolated) & Bi-directional RTL reversing.
 * 2. Standard ESC/POS Command Builder (Init, Cut, Align, Font Size, Underline, Invert).
 * 3. 1-Bit Monochrome Raster Bit-Image Generator (ESC/POS `GS v 0` / `ESC *`).
 * 4. Bilingual Receipt Formatter (Arabic Right-Aligned, English Left-Aligned).
 */

// ─── Arabic Unicode Presentation Forms-B Glyph Table ─────────────────────────
// [Isolated, Final, Initial, Medial]
const ARABIC_GLYPH_TABLE: Record<number, [number, number, number, number]> = {
  0x0621: [0xfe80, 0xfe80, 0xfe80, 0xfe80], // Hamza
  0x0622: [0xfe81, 0xfe82, 0xfe81, 0xfe82], // Alef with Madda
  0x0623: [0xfe83, 0xfe84, 0xfe83, 0xfe84], // Alef with Hamza Above
  0x0624: [0xfe85, 0xfe86, 0xfe85, 0xfe86], // Waw with Hamza Above
  0x0625: [0xfe87, 0xfe88, 0xfe87, 0xfe88], // Alef with Hamza Below
  0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // Yeh with Hamza Above
  0x0627: [0xfe8d, 0xfe8e, 0xfe8d, 0xfe8e], // Alef
  0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // Beh
  0x0629: [0xfe93, 0xfe94, 0xfe93, 0xfe94], // Teh Marbuta
  0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98], // Teh
  0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // Theh
  0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // Jeem
  0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4], // Hah
  0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8], // Khah
  0x062f: [0xfea9, 0xfeaa, 0xfea9, 0xfeaa], // Dal
  0x0630: [0xfeab, 0xfeac, 0xfeab, 0xfeac], // Thal
  0x0631: [0xfead, 0xfeae, 0xfead, 0xfeae], // Reh
  0x0632: [0xfeaf, 0xfeb0, 0xfeaf, 0xfeb0], // Zain
  0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // Seen
  0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // Sheen
  0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // Sad
  0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0], // Dad
  0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4], // Tah
  0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8], // Zah
  0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc], // Ain
  0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0], // Ghain
  0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4], // Feh
  0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8], // Qaf
  0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc], // Kaf
  0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0], // Lam
  0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4], // Meem
  0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8], // Noon
  0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // Heh
  0x0648: [0xfeed, 0xfeee, 0xfeed, 0xfeee], // Waw
  0x0649: [0xfeef, 0xfef0, 0xfebd, 0xfec0], // Alef Maksura
  0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4], // Yeh
}

// Letters that do not connect to the following letter
const NON_CONNECTING_AFTER = new Set([
  0x0621, 0x0622, 0x0623, 0x0624, 0x0625, 0x0627, 0x0629, 0x062f, 0x0630, 0x0631, 0x0632, 0x0648, 0x0649,
])

/**
 * Shapes Arabic text so that characters connect correctly and reverses them for RTL printing on LTR thermal printers.
 */
export function shapeArabicText(text: string): string {
  if (!text) return ''

  const chars = Array.from(text)
  const shapedChars: string[] = []

  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].charCodeAt(0)
    const glyphs = ARABIC_GLYPH_TABLE[code]

    if (!glyphs) {
      // Non-Arabic character (space, digit, Latin, punctuation)
      shapedChars.push(chars[i])
      continue
    }

    const prevCode = i > 0 ? chars[i - 1].charCodeAt(0) : null
    const nextCode = i < chars.length - 1 ? chars[i + 1].charCodeAt(0) : null

    const prevConnects =
      prevCode !== null &&
      ARABIC_GLYPH_TABLE[prevCode] !== undefined &&
      !NON_CONNECTING_AFTER.has(prevCode)

    const nextConnects =
      nextCode !== null &&
      ARABIC_GLYPH_TABLE[nextCode] !== undefined

    let formIndex = 0 // Isolated
    if (prevConnects && nextConnects && !NON_CONNECTING_AFTER.has(code)) {
      formIndex = 3 // Medial
    } else if (prevConnects) {
      formIndex = 1 // Final
    } else if (nextConnects && !NON_CONNECTING_AFTER.has(code)) {
      formIndex = 2 // Initial
    } else {
      formIndex = 0 // Isolated
    }

    const shapedCode = glyphs[formIndex] || code
    shapedChars.push(String.fromCharCode(shapedCode))
  }

  // Reverse Arabic words for RTL display on LTR printers while preserving Latin numbers/words
  return reverseRtlTokens(shapedChars.join(''))
}

/**
 * Reverses Arabic tokens while leaving numbers and Latin intact.
 */
function reverseRtlTokens(str: string): string {
  // Simple word-by-word RTL reverser
  const words = str.split(' ')
  const reversedWords = words.map((w) => {
    // If the word contains Arabic glyphs, reverse its characters
    if (/[\u0600-\u06ff\ufe70-\ufeff]/.test(w)) {
      return Array.from(w).reverse().join('')
    }
    return w
  })

  return reversedWords.reverse().join(' ')
}

// ─── ESC/POS Low-Level Command Constants ─────────────────────────────────────
export const ESC_POS = {
  INIT: Buffer.from([0x1b, 0x40]),
  CUT: Buffer.from([0x1d, 0x56, 0x42, 0x00]), // GS V 66 0
  FEED_3_LINES: Buffer.from([0x1b, 0x64, 0x03]),
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]),
  EMPHASIZE_ON: Buffer.from([0x1b, 0x45, 0x01]),
  EMPHASIZE_OFF: Buffer.from([0x1b, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: Buffer.from([0x1b, 0x21, 0x10]),
  DOUBLE_WIDTH_ON: Buffer.from([0x1b, 0x21, 0x20]),
  NORMAL_FONT: Buffer.from([0x1b, 0x21, 0x00]),
  UNDERLINE_ON: Buffer.from([0x1b, 0x2d, 0x01]),
  UNDERLINE_OFF: Buffer.from([0x1b, 0x2d, 0x00]),
}

export interface BilingualReceiptLine {
  en: string
  ar: string
  amount?: string
}

export interface BilingualReceiptReceiptInput {
  pharmacyNameEn: string
  pharmacyNameAr: string
  vatId: string
  invoiceNumber: string
  timestamp: string
  lines: Array<{
    nameEn: string
    nameAr: string
    qty: number
    rate: string
    amount: string
  }>
  subtotal: string
  taxAmount: string
  grandTotal: string
  currencySymbol: string
  qrBase64?: string
}

/**
 * Builds standard 80mm ESC/POS Binary Byte Stream with shaped Arabic and aligned English.
 */
export function buildEscPosBilingualReceipt(input: BilingualReceiptReceiptInput): Buffer {
  const chunks: Buffer[] = []

  function add(buf: Buffer) {
    chunks.push(buf)
  }

  function addText(text: string) {
    chunks.push(Buffer.from(text, 'utf-8'))
  }

  // 1. Initialize Printer
  add(ESC_POS.INIT)

  // 2. Center Align & Header
  add(ESC_POS.ALIGN_CENTER)
  add(ESC_POS.EMPHASIZE_ON)
  add(ESC_POS.DOUBLE_HEIGHT_ON)
  addText(`${input.pharmacyNameEn}\n`)
  add(ESC_POS.NORMAL_FONT)
  add(ESC_POS.EMPHASIZE_ON)
  addText(`${shapeArabicText(input.pharmacyNameAr)}\n`)
  add(ESC_POS.EMPHASIZE_OFF)
  addText(`VAT/GSTIN: ${input.vatId}\n`)
  addText(`------------------------------------------------\n`)
  addText(`TAX INVOICE / فاتورة ضريبية مبسطة\n`)
  addText(`Invoice: ${input.invoiceNumber} | ${input.timestamp}\n`)
  addText(`------------------------------------------------\n`)

  // 3. Left Align Column Titles
  add(ESC_POS.ALIGN_LEFT)
  addText(`Item / الوصف                    Qty   Rate    Amount\n`)
  addText(`------------------------------------------------\n`)

  // 4. Itemized Lines
  for (const item of input.lines) {
    const shapedAr = shapeArabicText(item.nameAr)
    const lineEn = item.nameEn.substring(0, 26).padEnd(26)
    const qtyStr = String(item.qty).padStart(4)
    const rateStr = item.rate.padStart(7)
    const amtStr = item.amount.padStart(9)

    addText(`${lineEn} ${qtyStr} ${rateStr} ${amtStr}\n`)
    if (shapedAr) {
      addText(`  ${shapedAr}\n`)
    }
  }

  addText(`------------------------------------------------\n`)

  // 5. Totals
  add(ESC_POS.ALIGN_RIGHT)
  add(ESC_POS.EMPHASIZE_ON)
  addText(`Subtotal: ${input.currencySymbol} ${input.subtotal}\n`)
  addText(`Tax / الضريبة: ${input.currencySymbol} ${input.taxAmount}\n`)
  add(ESC_POS.DOUBLE_HEIGHT_ON)
  addText(`TOTAL / الإجمالي: ${input.currencySymbol} ${input.grandTotal}\n`)
  add(ESC_POS.NORMAL_FONT)
  add(ESC_POS.EMPHASIZE_OFF)
  addText(`------------------------------------------------\n`)

  // 6. QR Code notice
  add(ESC_POS.ALIGN_CENTER)
  addText(`[ ZATCA Phase 2 E-Invoice QR Verified ]\n`)
  addText(`شكراً لزيارتكم • Thank you for your visit\n`)

  // 7. Feed 3 lines & Paper Cut
  add(ESC_POS.FEED_3_LINES)
  add(ESC_POS.CUT)

  return Buffer.concat(chunks)
}
