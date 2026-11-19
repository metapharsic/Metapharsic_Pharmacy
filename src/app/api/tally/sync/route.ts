// ─────────────────────────────────────────────────────────────
// Tally Sync API Route
// Provides live server diagnostics, sync logs, and 1-click
// synchronization triggers for vouchers, masters, and retries.
// ─────────────────────────────────────────────────────────────
import { type NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/auth-helpers'
import { pingTallyServer } from '@/lib/tally/tally-client'
import { getTallyConfig } from '@/lib/tally/tally-service'
import {
  getTallySyncLogs,
  retrySync,
  syncAllCreditCustomers,
  syncAllProducts,
  syncCustomerToTally,
  syncProductToTally,
  syncPurchaseToTally,
  syncSaleToTally,
} from '@/lib/tally/tally-sync-service'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getTallyConfig()
    const [serverStatus, syncLogs] = await Promise.all([
      pingTallyServer(config.serverUrl),
      getTallySyncLogs(),
    ])

    return NextResponse.json({
      success: true,
      serverStatus,
      syncLogs,
      config: {
        serverUrl: config.serverUrl,
        companyName: config.companyName,
        autoSyncSales: config.autoSyncSales,
        autoSyncPurchases: config.autoSyncPurchases,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Tally sync status'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      action?: string
      entityType?: string
      entityId?: string
      serverUrl?: string
      logId?: string
    }

    const config = await getTallyConfig()

    switch (body.action) {
      case 'ping': {
        const url = body.serverUrl || config.serverUrl
        const result = await pingTallyServer(url)
        return NextResponse.json({ success: true, data: result })
      }

      case 'sync_sale': {
        if (!body.entityId) {
          return NextResponse.json(
            { success: false, error: 'Sale ID is required' },
            { status: 400 }
          )
        }
        const result = await syncSaleToTally(body.entityId)
        return NextResponse.json({ success: result.success, data: result })
      }

      case 'sync_purchase': {
        if (!body.entityId) {
          return NextResponse.json(
            { success: false, error: 'Purchase ID is required' },
            { status: 400 }
          )
        }
        const result = await syncPurchaseToTally(body.entityId)
        return NextResponse.json({ success: result.success, data: result })
      }

      case 'sync_customer': {
        if (!body.entityId) {
          return NextResponse.json(
            { success: false, error: 'Customer ID is required' },
            { status: 400 }
          )
        }
        const result = await syncCustomerToTally(body.entityId)
        return NextResponse.json({ success: result.success, data: result })
      }

      case 'sync_product': {
        if (!body.entityId) {
          return NextResponse.json(
            { success: false, error: 'Product ID is required' },
            { status: 400 }
          )
        }
        const result = await syncProductToTally(body.entityId)
        return NextResponse.json({ success: result.success, data: result })
      }

      case 'sync_all_credit_customers': {
        const result = await syncAllCreditCustomers()
        return NextResponse.json({ success: true, data: result })
      }

      case 'sync_all_products': {
        const result = await syncAllProducts()
        return NextResponse.json({ success: true, data: result })
      }

      case 'retry': {
        if (!body.logId) {
          return NextResponse.json({ success: false, error: 'Log ID is required' }, { status: 400 })
        }
        const result = await retrySync(body.logId)
        return NextResponse.json({ success: result.success, data: result })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action: ${body.action}` },
          { status: 400 }
        )
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tally sync action failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
