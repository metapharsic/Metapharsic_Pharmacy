import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import {
  provisionPrivateCloudNode,
  rotateNodeHsmKey,
  toggleNodeQuarantine,
  failoverNode,
  getDynamicSovereignCloudNodes,
} from '@/lib/cloud/sovereign-cloud-service'
import { TerritoryCode } from '@/lib/territory/territory-config'

export async function POST(req: Request) {
  try {
    const adminUser = await requireSuperAdmin()
    const body = await req.json()
    const { action, territoryCode } = body

    if (!territoryCode) {
      return NextResponse.json({ success: false, error: 'Territory code is required' }, { status: 400 })
    }

    const terrCode = territoryCode.toUpperCase() as TerritoryCode

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: PROVISION / RE-PROVISION PRIVATE CLOUD NODE
    // ─────────────────────────────────────────────────────────────
    if (action === 'provision') {
      const {
        deploymentMode,
        vpcId,
        privateSubnetCidr,
        dedicatedDbEndpoint,
        dedicatedDbPoolSize,
        hsmKeyArn,
        assignedSuperAdmin,
        allocatedVcpu,
        allocatedRamGb,
        allocatedStorageTb,
        backupRetentionDays,
        crossBorderEgressBlocked,
        quarantineStatus,
      } = body

      const updatedNode = await provisionPrivateCloudNode(
        terrCode,
        {
          deploymentMode,
          vpcId,
          privateSubnetCidr,
          dedicatedDbEndpoint,
          dedicatedDbPoolSize: dedicatedDbPoolSize ? Number(dedicatedDbPoolSize) : undefined,
          hsmKeyArn,
          assignedSuperAdmin,
          allocatedVcpu: allocatedVcpu ? Number(allocatedVcpu) : undefined,
          allocatedRamGb: allocatedRamGb ? Number(allocatedRamGb) : undefined,
          allocatedStorageTb: allocatedStorageTb ? Number(allocatedStorageTb) : undefined,
          backupRetentionDays: backupRetentionDays ? Number(backupRetentionDays) : undefined,
          crossBorderEgressBlocked: crossBorderEgressBlocked !== undefined ? Boolean(crossBorderEgressBlocked) : undefined,
          quarantineStatus,
        },
        adminUser
      )

      const allNodes = await getDynamicSovereignCloudNodes()

      return NextResponse.json({
        success: true,
        message: `Sovereign Private Cloud Node [${terrCode}] successfully provisioned and isolated.`,
        node: updatedNode,
        nodes: allNodes,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: ROTATE HARDWARE HSM / KMS ENCRYPTION KEYS
    // ─────────────────────────────────────────────────────────────
    if (action === 'rotate-keys') {
      const { node, newKeyArn } = await rotateNodeHsmKey(terrCode, adminUser)
      const allNodes = await getDynamicSovereignCloudNodes()

      return NextResponse.json({
        success: true,
        message: `Hardware HSM Key rotated for [${terrCode}]: ${newKeyArn}`,
        node,
        nodes: allNodes,
        newKeyArn,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 3: QUARANTINE / MAINTENANCE TOGGLE
    // ─────────────────────────────────────────────────────────────
    if (action === 'quarantine') {
      const { quarantineStatus } = body
      const updatedNode = await toggleNodeQuarantine(terrCode, quarantineStatus || 'QUARANTINED', adminUser)
      const allNodes = await getDynamicSovereignCloudNodes()

      return NextResponse.json({
        success: true,
        message: `Node [${terrCode}] state updated to ${quarantineStatus}.`,
        node: updatedNode,
        nodes: allNodes,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 4: DISASTER RECOVERY FAILOVER
    // ─────────────────────────────────────────────────────────────
    if (action === 'failover') {
      const updatedNode = await failoverNode(terrCode, adminUser)
      const allNodes = await getDynamicSovereignCloudNodes()

      return NextResponse.json({
        success: true,
        message: `Disaster Recovery Failover activated for [${terrCode}]. Primary traffic routed to ${updatedNode.primaryNodeHost}.`,
        node: updatedNode,
        nodes: allNodes,
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid cloud provisioning action' }, { status: 400 })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Cloud provisioning operation failed',
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
