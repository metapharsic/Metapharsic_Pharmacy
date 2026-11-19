import prisma from '@/lib/db/prisma'
import { TerritoryCode } from '@/lib/territory/territory-config'
import {
  SOVEREIGN_CLOUD_TOPOLOGIES,
  SovereignCloudNode,
  PrivateCloudDeploymentMode,
  NodeQuarantineStatus,
} from './sovereign-cloud-topology'

const CLOUD_SETTING_CATEGORY = 'SOVEREIGN_CLOUD'
const CLOUD_SETTING_KEY = 'PRIVATE_NODE_CONFIGS'

/**
 * Loads dynamic sovereign topologies merged from database overrides and standard definitions.
 */
export async function getDynamicSovereignCloudNodes(): Promise<SovereignCloudNode[]> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        category_key: {
          category: CLOUD_SETTING_CATEGORY,
          key: CLOUD_SETTING_KEY,
        },
      },
    })

    if (setting && setting.value) {
      const overrides: Record<string, Partial<SovereignCloudNode>> = JSON.parse(setting.value)
      return Object.values(SOVEREIGN_CLOUD_TOPOLOGIES).map((baseNode) => {
        const override = overrides[baseNode.territoryCode]
        if (override) {
          return { ...baseNode, ...override }
        }
        return baseNode
      })
    }
  } catch (err) {
    console.error('Failed to load custom cloud node configs, using defaults', err)
  }

  return Object.values(SOVEREIGN_CLOUD_TOPOLOGIES)
}

/**
 * Loads a single sovereign cloud node with dynamic database overrides.
 */
export async function getDynamicSovereignCloudNode(territoryCode: TerritoryCode): Promise<SovereignCloudNode> {
  const nodes = await getDynamicSovereignCloudNodes()
  const found = nodes.find((n) => n.territoryCode === territoryCode)
  return found || SOVEREIGN_CLOUD_TOPOLOGIES[territoryCode] || SOVEREIGN_CLOUD_TOPOLOGIES.SA
}

/**
 * Saves or updates custom private cloud provisioning settings for a sovereign node.
 */
export async function provisionPrivateCloudNode(
  territoryCode: TerritoryCode,
  params: {
    deploymentMode?: PrivateCloudDeploymentMode
    vpcId?: string
    privateSubnetCidr?: string
    dedicatedDbEndpoint?: string
    dedicatedDbPoolSize?: number
    hsmKeyArn?: string
    assignedSuperAdmin?: string
    allocatedVcpu?: number
    allocatedRamGb?: number
    allocatedStorageTb?: number
    backupRetentionDays?: number
    crossBorderEgressBlocked?: boolean
    quarantineStatus?: NodeQuarantineStatus
    status?: 'ONLINE' | 'STANDBY' | 'MAINTENANCE'
  },
  adminUser: { id: string; email?: string | null }
): Promise<SovereignCloudNode> {
  const existingSetting = await prisma.systemSetting.findUnique({
    where: {
      category_key: {
        category: CLOUD_SETTING_CATEGORY,
        key: CLOUD_SETTING_KEY,
      },
    },
  })

  let currentOverrides: Record<string, Partial<SovereignCloudNode>> = {}
  if (existingSetting && existingSetting.value) {
    try {
      currentOverrides = JSON.parse(existingSetting.value)
    } catch {
      currentOverrides = {}
    }
  }

  const baseNode = SOVEREIGN_CLOUD_TOPOLOGIES[territoryCode] || SOVEREIGN_CLOUD_TOPOLOGIES.SA
  const existingNodeOverride = currentOverrides[territoryCode] || {}

  const updatedNodeOverride: Partial<SovereignCloudNode> = {
    ...existingNodeOverride,
    ...params,
    lastProvisionedAt: new Date().toISOString(),
  }

  currentOverrides[territoryCode] = updatedNodeOverride

  await prisma.systemSetting.upsert({
    where: {
      category_key: {
        category: CLOUD_SETTING_CATEGORY,
        key: CLOUD_SETTING_KEY,
      },
    },
    create: {
      category: CLOUD_SETTING_CATEGORY,
      key: CLOUD_SETTING_KEY,
      value: JSON.stringify(currentOverrides),
      dataType: 'json',
      label: 'Sovereign Private Cloud Node Configurations & VPC Topologies',
    },
    update: {
      value: JSON.stringify(currentOverrides),
      updatedAt: new Date(),
    },
  })

  // Create an Audit Log entry for the SuperAdmin provisioning action
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SOVEREIGN_NODE_PROVISIONED',
      entity: 'SovereignCloudNode',
      entityId: territoryCode,
      newData: {
        territoryCode,
        adminEmail: adminUser.email,
        deploymentMode: params.deploymentMode || baseNode.deploymentMode,
        vpcId: params.vpcId || baseNode.vpcId,
        dedicatedDbEndpoint: params.dedicatedDbEndpoint || baseNode.dedicatedDbEndpoint,
        hsmKeyArn: params.hsmKeyArn || baseNode.hsmKeyArn,
        timestamp: new Date().toISOString(),
      },
    },
  })

  return { ...baseNode, ...updatedNodeOverride }
}

/**
 * Rotates the Hardware HSM Key ARN for a sovereign node.
 */
export async function rotateNodeHsmKey(
  territoryCode: TerritoryCode,
  adminUser: { id: string; email?: string | null }
): Promise<{ node: SovereignCloudNode; newKeyArn: string }> {
  const baseNode = SOVEREIGN_CLOUD_TOPOLOGIES[territoryCode] || SOVEREIGN_CLOUD_TOPOLOGIES.SA
  const timestamp = Date.now().toString(36).toUpperCase()
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()

  let newKeyArn: string
  if (territoryCode === 'OM') {
    newKeyArn = `pkcs11:token=ODP-Luna-HSM-OM-ROTATED-${timestamp}-${randomHex}`
  } else if (territoryCode === 'MV') {
    newKeyArn = `pkcs11:token=Dhiraagu-HSM-MV-ROTATED-${timestamp}-${randomHex}`
  } else {
    newKeyArn = `arn:aws:kms:${baseNode.cloudRegionCode.split(' ')[0]}:hsm-key-${territoryCode.toLowerCase()}-${timestamp}-${randomHex}`
  }

  const updatedNode = await provisionPrivateCloudNode(
    territoryCode,
    { hsmKeyArn: newKeyArn },
    adminUser
  )

  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SOVEREIGN_HSM_KEY_ROTATED',
      entity: 'SovereignCloudNode',
      entityId: territoryCode,
      newData: {
        territoryCode,
        adminEmail: adminUser.email,
        newKeyArn,
        rotatedAt: new Date().toISOString(),
      },
    },
  })

  return { node: updatedNode, newKeyArn }
}

/**
 * Toggles node quarantine / maintenance state.
 */
export async function toggleNodeQuarantine(
  territoryCode: TerritoryCode,
  quarantineStatus: NodeQuarantineStatus,
  adminUser: { id: string; email?: string | null }
): Promise<SovereignCloudNode> {
  const updatedNode = await provisionPrivateCloudNode(
    territoryCode,
    {
      quarantineStatus,
      status: quarantineStatus === 'OPERATIONAL' ? 'ONLINE' : 'STANDBY',
    },
    adminUser
  )

  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SOVEREIGN_NODE_STATUS_CHANGED',
      entity: 'SovereignCloudNode',
      entityId: territoryCode,
      newData: {
        territoryCode,
        adminEmail: adminUser.email || 'superadmin@metapharsic.com',
        quarantineStatus,
      },
    },
  })

  return updatedNode
}

/**
 * Triggers failover to secondary disaster recovery sovereign node.
 */
export async function failoverNode(
  territoryCode: TerritoryCode,
  adminUser: { id: string; email?: string | null }
): Promise<SovereignCloudNode> {
  const baseNode = await getDynamicSovereignCloudNode(territoryCode)
  const currentPrimary = baseNode.primaryNodeHost
  const currentSecondary = baseNode.secondaryFailoverHost

  const updatedNode = await provisionPrivateCloudNode(
    territoryCode,
    {
      quarantineStatus: 'DR_FAILOVER',
    },
    adminUser
  )

  // Swap primary and secondary hosts in memory / record
  updatedNode.primaryNodeHost = currentSecondary
  updatedNode.secondaryFailoverHost = currentPrimary

  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SOVEREIGN_NODE_FAILOVER_TRIGGERED',
      entity: 'SovereignCloudNode',
      entityId: territoryCode,
      newData: {
        territoryCode,
        adminEmail: adminUser.email,
        activeNode: currentSecondary,
        standbyNode: currentPrimary,
      },
    },
  })

  return updatedNode
}
