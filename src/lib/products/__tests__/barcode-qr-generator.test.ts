import {
  generateCode128Svg,
  buildProductQrPayload,
  generateQrCodeSvg,
  generateQrCodeDataUrl,
  generateProductCodes,
} from '@/lib/products/barcode-qr-generator'

describe('Product Barcode & QR Code Engine', () => {
  const sampleProduct = {
    id: 'prod-001',
    name: 'Augmentin 625 Duo Tab',
    sku: 'SKU-AUG-625',
    barcode: '8901234567890',
    genericName: 'Amoxicillin + Clavulanic Acid',
    mrp: 201.5,
    drugSchedule: 'H',
    hsnCode: '30041010',
    rack: 'A-02',
  }

  it('generates a valid Code 128 SVG string with quiet zones and rect bars', () => {
    const svg = generateCode128Svg('8901234567890')
    expect(svg).toContain('<svg')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('<rect')
    expect(svg).toContain('8901234567890')
    expect(svg).toContain('</svg>')
  })

  it('builds structured QR payload JSON with dispensary fields', () => {
    const payload = buildProductQrPayload(sampleProduct)
    const parsed = JSON.parse(payload)
    expect(parsed.mpharm).toBe('1.0')
    expect(parsed.sku).toBe('SKU-AUG-625')
    expect(parsed.code).toBe('8901234567890')
    expect(parsed.mrp).toBe('201.50')
    expect(parsed.sch).toBe('H')
  })

  it('generates an ISO/IEC 18004 QR Code SVG', async () => {
    const svg = await generateQrCodeSvg('TEST-QR-PAYLOAD')
    expect(svg).toContain('<svg')
    expect(svg).toContain('path')
    expect(svg).toContain('</svg>')
  })

  it('generates an ISO/IEC 18004 QR Code PNG DataURL', async () => {
    const dataUrl = await generateQrCodeDataUrl('TEST-QR-PAYLOAD', 200)
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('generates combined barcode and QR code bundle for a product', async () => {
    const result = await generateProductCodes(sampleProduct)
    expect(result.barcodeValue).toBe('8901234567890')
    expect(result.barcodeSvg).toContain('<svg')
    expect(result.qrCodeSvg).toContain('<svg')
    expect(result.qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })
})

