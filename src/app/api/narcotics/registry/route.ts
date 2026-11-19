import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  validateNarcoticDispensing,
  createSovereignNarcoticRecord,
  NarcoticValidationInput,
} from '@/lib/narcotics/sovereign-narcotics-service'
import { TerritoryCode, TERRITORIES } from '@/lib/territory/territory-config'

export const dynamic = 'force-dynamic'

const narcoticDispensingSchema = z.object({
  territoryCode: z.enum(['SA', 'OM', 'QA', 'BH', 'MV', 'IN']).optional(),
  drugClassification: z.string().optional(),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  batchNumber: z.string().optional(),
  dispenserName: z.string().optional(),
  patient: z.object({
    name: z.string().min(1, 'Patient name is required'),
    nationalId: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  prescriber: z.object({
    name: z.string().min(1, 'Prescriber name is required'),
    licenseNumber: z.string().optional(),
    clinicName: z.string().optional(),
  }),
  prescription: z.object({
    prescriptionNumber: z.string().min(1, 'Prescription number is required'),
    issueDate: z.string().optional(),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const parsed = narcoticDispensingSchema.parse(rawBody)

    let territoryCode = parsed.territoryCode
    if (!territoryCode) {
      const headerTerritory = req.headers.get('x-territory-code')?.toUpperCase()
      if (headerTerritory && headerTerritory in TERRITORIES) {
        territoryCode = headerTerritory as TerritoryCode
      } else {
        territoryCode = 'SA'
      }
    }

    const validation = validateNarcoticDispensing({
      territoryCode,
      drugClassification: parsed.drugClassification,
      productName: parsed.productName,
      quantity: parsed.quantity,
      batchNumber: parsed.batchNumber,
      patient: parsed.patient,
      prescriber: parsed.prescriber,
      prescription: parsed.prescription,
    })

    if (!validation.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NARCOTIC_RESTRICTION',
            message: `Dispensing blocked by ${validation.regulatoryAuthorityEn} regulations for ${validation.sovereignRegisterNameEn}.`,
            missingRequirements: validation.missingRequirements,
            validationErrors: validation.validationErrors,
          },
          validation,
        },
        { status: 403 }
      )
    }

    const record = createSovereignNarcoticRecord({
      input: {
        territoryCode,
        drugClassification: parsed.drugClassification,
        productName: parsed.productName,
        quantity: parsed.quantity,
        patient: parsed.patient,
        prescriber: parsed.prescriber,
        prescription: parsed.prescription,
      },
      validation,
      dispenserName: parsed.dispenserName || 'Authorized Pharmacist',
      batchNumber: parsed.batchNumber || 'LOT-STD',
    })

    return NextResponse.json({
      success: true,
      data: {
        validation,
        record,
      },
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.errors[0]?.message || 'Invalid narcotic payload',
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NARCOTIC_ERROR',
          message: err?.message || 'Failed to process narcotic verification',
        },
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const territory = (url.searchParams.get('territory')?.toUpperCase() || 'SA') as TerritoryCode
  const territoryDef = TERRITORIES[territory in TERRITORIES ? territory : 'SA']

  return NextResponse.json({
    success: true,
    data: {
      territory: territoryDef.code,
      registerNameEn: territoryDef.regulatory.controlledDrugRegisterEn,
      registerNameAr: territoryDef.regulatory.controlledDrugRegisterAr,
      authorityNameEn: territoryDef.regulatory.authorityNameEn,
      authorityNameAr: territoryDef.regulatory.authorityNameAr,
      trackAndTraceSystem: territoryDef.regulatory.trackAndTraceSystem,
    },
  })
}
