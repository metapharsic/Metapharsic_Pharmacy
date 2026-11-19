import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeMultiThreadSerialization } from '@/lib/serialization/multi-thread-serialization-engine'
import { TerritoryCode, TERRITORIES } from '@/lib/territory/territory-config'

export const dynamic = 'force-dynamic'

const parseRequestSchema = z.object({
  scannedCode: z.string().min(1, 'Scanned barcode code is required'),
  territoryCode: z.enum(['SA', 'OM', 'QA', 'BH', 'MV', 'IN']).optional(),
  branchId: z.string().optional(),
  drugClassification: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.number().optional(),
  patient: z
    .object({
      name: z.string().optional(),
      nationalId: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  prescriber: z
    .object({
      name: z.string().optional(),
      licenseNumber: z.string().optional(),
      clinicName: z.string().optional(),
    })
    .optional(),
  prescriptionNumber: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const parsed = parseRequestSchema.parse(rawBody)

    let territoryCode = parsed.territoryCode
    if (!territoryCode) {
      const headerTerritory = req.headers.get('x-territory-code')?.toUpperCase()
      if (headerTerritory && headerTerritory in TERRITORIES) {
        territoryCode = headerTerritory as TerritoryCode
      } else {
        territoryCode = 'SA'
      }
    }

    const result = await executeMultiThreadSerialization({
      scannedCode: parsed.scannedCode,
      territoryCode,
      branchId: parsed.branchId,
      drugClassification: parsed.drugClassification,
      productName: parsed.productName,
      quantity: parsed.quantity,
      patient: parsed.patient,
      prescriber: parsed.prescriber,
      prescriptionNumber: parsed.prescriptionNumber,
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
            message: err.errors[0]?.message || 'Invalid barcode payload',
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERIALIZATION_ERROR',
          message: err?.message || 'Failed to process serialization parsing',
        },
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code') || '(01)06285000000018(17)261231(10)LOT789A(21)SN12345678'
  const territory = (url.searchParams.get('territory')?.toUpperCase() || 'SA') as TerritoryCode

  const result = await executeMultiThreadSerialization({
    scannedCode: code,
    territoryCode: territory in TERRITORIES ? territory : 'SA',
    productName: 'Augmentin 625mg SFDA Pack',
    drugClassification: 'NON_CONTROLLED',
  })

  return NextResponse.json({
    success: true,
    data: result,
  })
}
