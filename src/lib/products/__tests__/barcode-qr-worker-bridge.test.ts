import {
  generateBatchProductCodes,
  buildPrintableStickerSheetHtml,
} from '@/lib/products/barcode-qr-worker-bridge'

describe('Multi-Thread Barcode & QR Worker Bridge', () => {
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Amoxicillin 500mg',
      sku: 'SKU-AMX-500',
      barcode: '8901111111111',
      mrp: 120.0,
      drugSchedule: 'H',
    },
    {
      id: 'p2',
      name: 'Azithromycin 250mg',
      sku: 'SKU-AZI-250',
      barcode: '8902222222222',
      mrp: 185.5,
      drugSchedule: 'H',
    },
  ]

  it('processes batch products and emits progress callbacks', async () => {
    const progressList: number[] = []
    const results = await generateBatchProductCodes(sampleProducts, (completed, total, percent) => {
      progressList.push(percent)
    })

    expect(results).toHaveLength(2)
    expect(results[0].productId).toBe('p1')
    expect(results[0].barcodeSvg).toContain('<svg')
    expect(results[0].qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(progressList.length).toBeGreaterThan(0)
    expect(progressList[progressList.length - 1]).toBe(100)
  })

  it('builds valid printable 24-up sticker sheet HTML', async () => {
    const results = await generateBatchProductCodes(sampleProducts)
    const html = buildPrintableStickerSheetHtml(results, {
      includeQr: true,
      includeBarcode: true,
    })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('sticker-card')
    expect(html).toContain('Amoxicillin 500mg')
    expect(html).toContain('Azithromycin 250mg')
    expect(html).toContain('METAPHARSIC')
  })
})

