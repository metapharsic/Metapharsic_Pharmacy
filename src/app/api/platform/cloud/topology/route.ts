import { NextResponse } from 'next/server'
import {
  listAllSovereignCloudNodes,
  getSovereignCloudTopology,
} from '@/lib/cloud/sovereign-cloud-topology'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const territory = searchParams.get('territory')

    const nodes = listAllSovereignCloudNodes()
    const activeNode = territory ? getSovereignCloudTopology(territory) : getSovereignCloudTopology('SA')

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
