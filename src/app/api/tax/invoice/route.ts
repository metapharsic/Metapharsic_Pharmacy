import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeMultiThreadTaxPipeline } from '@/lib/tax/multi-thread-tax-engine'
import { TerritoryCode, TERRITORIES } from '@/lib/territory/territory-config'

export const dynamic = 'force-dynamic'

const taxInvoiceItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  name: z.string().min(1, 'Item name is required'),
  nameAr: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  mrp: z.number().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  isPrescription: z.boolean().optional(),
  isControlled: z.boolean().optional(),
  category: z.enum(['MEDICINE', 'COSMETIC', 'SUPPLEMENT', 'DEVICE', 'GENERAL']).optional(),
  hsnCode: z.string().optional(),
  customTaxRate: z.number().optional(),
  aasandhaCovered: z.boolean().optional(),
  aasandhaCopayPercent: z.number().optional(),
})

const taxInvoiceRequestSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  saleDate: z.string().optional(),
  territoryCode: z.enum(['SA', 'OM', 'QA', 'BH', 'MV', 'IN']).optional(),
  items: z.array(taxInvoiceItemSchema).min(1, 'At least one item is required'),
  seller: z
    .object({
      name: z.string().optional(),
      nameAr: z.string().optional(),
      vatRegistrationNumber: z.string().optional(),
      licenseNumber: z.string().optional(),
      branchId: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  customer: z
    .object({
      name: z.string().optional(),
      vatNumber: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  previousInvoiceHash: z.string().optional(),
})

/**
 * POST /api/tax/invoice
 * Dispatches 5-thread sovereign tax & ZATCA e-invoicing engine.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const parsed = taxInvoiceRequestSchema.parse(rawBody)

    // Fallback detection from headers/cookies if territoryCode is not explicitly sent
    let territoryCode = parsed.territoryCode
    if (!territoryCode) {
      const headerTerritory = req.headers.get('x-territory-code')?.toUpperCase()
      if (headerTerritory && headerTerritory in TERRITORIES) {
        territoryCode = headerTerritory as TerritoryCode
      } else {
        territoryCode = 'SA'
      }
    }

    const result = await executeMultiThreadTaxPipeline({
      invoiceNumber: parsed.invoiceNumber,
      saleDate: parsed.saleDate || new Date().toISOString(),
      territoryCode,
      items: parsed.items,
      seller: parsed.seller,
      customer: parsed.customer,
      previousInvoiceHash: parsed.previousInvoiceHash,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.errors[0]?.message || 'Invalid tax invoice payload',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TAX_PIPELINE_ERROR',
          message: err?.message || 'Failed to process sovereign tax calculation',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tax/invoice?territory=SA&demo=true
 * Preflight endpoint returning live calculation and ZATCA Phase 2 TLV sample.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const territoryParam = (url.searchParams.get('territory')?.toUpperCase() || 'SA') as TerritoryCode
  const territoryCode = territoryParam in TERRITORIES ? territoryParam : 'SA'

  const demoItems = [
    {
      name: 'Amoxicillin 500mg (Augmentin)',
      nameAr: 'أموكسيسيلين ٥٠٠ ملغ (أوجمنتين)',
      quantity: 2,
      unitPrice: territoryCode === 'OM' || territoryCode === 'BH' ? 4.5 : 35.0,
      isPrescription: true,
      category: 'MEDICINE' as const,
      hsnCode: '3004',
      aasandhaCovered: territoryCode === 'MV',
    },
    {
      name: 'Hydrating Dermocosmetic Skin Lotion',
      nameAr: 'لوشن مرطب للبشرة الجلدية',
      quantity: 1,
      unitPrice: territoryCode === 'OM' || territoryCode === 'BH' ? 6.25 : 55.0,
      isPrescription: false,
      category: 'COSMETIC' as const,
      hsnCode: '3304',
    },
  ]

  const result = await executeMultiThreadTaxPipeline({
    invoiceNumber: `INV-${territoryCode}-${Date.now().toString().slice(-6)}`,
    saleDate: new Date().toISOString(),
    territoryCode,
    items: demoItems,
    seller: {
      name: 'Metapharsic Pharmacare Ltd',
      nameAr: 'شركة ميتافارسيك فارماكير المحدودة',
      vatRegistrationNumber: '310123456700003',
      city: 'Riyadh',
    },
    customer: {
      name: 'Healthcare Client / عميل الرعاية الصحية',
    },
  })

  return NextResponse.json({
    success: true,
    data: result,
  })
}
