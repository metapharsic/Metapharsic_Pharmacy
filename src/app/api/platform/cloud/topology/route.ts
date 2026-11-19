import { NextResponse } from 'next/server'
import {
  getDynamicSovereignCloudNodes,
  getDynamicSovereignCloudNode,
} from '@/lib/cloud/sovereign-cloud-service'
import { TerritoryCode } from '@/lib/territory/territory-config'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const territory = searchParams.get('territory') as TerritoryCode | null

    const nodes = await getDynamicSovereignCloudNodes()
    const activeNode = territory ? await getDynamicSovereignCloudNode(territory) : nodes[0]

    return NextResponse.json({
      success: true,
      nodes,
      activeNode,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch cloud topology' },
      { status: 500 }
    )
  }
}
