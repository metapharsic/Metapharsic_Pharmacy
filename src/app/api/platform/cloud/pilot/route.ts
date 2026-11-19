import { NextResponse } from 'next/server'
import {
  executeMultiThreadCloudPilot,
  CloudPilotEngineInput,
} from '@/lib/cloud/multi-thread-cloud-pilot-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const territoryCode = (searchParams.get('territory') || 'SA') as any
    const batchSize = parseInt(searchParams.get('batchSize') || '25', 10)

    const result = await executeMultiThreadCloudPilot({
      territoryCode,
      sandboxBatchSize: Math.min(Math.max(batchSize, 5), 100),
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Cloud pilot execution error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body: CloudPilotEngineInput = await req.json().catch(() => ({}))

    const batchSize = Math.min(Math.max(body.sandboxBatchSize || 50, 10), 1000)

    const result = await executeMultiThreadCloudPilot({
      territoryCode: body.territoryCode || 'SA',
      pilotStoreCity: body.pilotStoreCity,
      sandboxBatchSize: batchSize,
      invoiceType: body.invoiceType || 'SIMPLIFIED',
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch cloud pilot suite' },
      { status: 500 }
    )
  }
}
