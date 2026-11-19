import { Decimal } from '@prisma/client/runtime/library'
import prisma from '@/lib/db/prisma'

export const CAMERA_RETENTION_HOURS = 48
export const CAMERA_RETENTION_MS = CAMERA_RETENTION_HOURS * 60 * 60 * 1000
export const FEATURE_SETTING_KEY = 'FEATURE_CAMERA_DRAWER_INTELLIGENCE'

export interface CameraDrawerSummary {
  enabled: boolean
  totalOpens48h: number
  todayOpens: number
  cashCollectedOpens: number
  manualAdminOpens: number
  sensorDetectedOpens: number
  lastOpenedAt: string | null
  events: Array<{
    id: string
    eventType: string
    invoiceNumber: string | null
    cashAmount: number
    snapshotData: string | null
    openedAt: string
    userName: string
    branchName: string
    notes: string | null
  }>
}

/**
 * SuperAdmin Gate: Check if the organization has been granted the advanced
 * Smart Camera & Cash Drawer Vision Intelligence privilege.
 */
export async function isCameraDrawerEnabled(organizationId: string): Promise<boolean> {
  const setting = await prisma.organizationSetting.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key: FEATURE_SETTING_KEY,
      },
    },
  })
  return setting?.value === 'true'
}

/**
 * SuperAdmin Action: Enable or disable the advanced feature privilege for a specific tenant shop.
 */
export async function setCameraDrawerPrivilege(
  organizationId: string,
  enabled: boolean
): Promise<boolean> {
  await prisma.organizationSetting.upsert({
    where: {
      organizationId_key: {
        organizationId,
        key: FEATURE_SETTING_KEY,
      },
    },
    update: { value: enabled ? 'true' : 'false' },
    create: {
      organizationId,
      key: FEATURE_SETTING_KEY,
      value: enabled ? 'true' : 'false',
    },
  })
  return enabled
}

/**
 * Enforce Strict 2-Day (48-Hour) Storage Retention:
 * Automatically purges any events and snapshot images older than 48 hours.
 */
export async function purgeExpiredCameraStorage(organizationId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - CAMERA_RETENTION_MS)
  const result = await prisma.cashDrawerEvent.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      ...(organizationId ? { organizationId } : {}),
    },
  })
  return result.count
}

/**
 * Retrieve the dedicated camera mapping for a specific admin / counter.
 * Enforces strict user isolation — NO camera merging across users or stores.
 */
export async function getStoreCameraMapping(organizationId: string, userId: string) {
  return prisma.storeCameraMapping.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  })
}

/**
 * Upsert the in-store camera mapping for a specific admin counter.
 */
export async function saveStoreCameraMapping(input: {
  organizationId: string
  branchId: string
  userId: string
  cameraName: string
  deviceId: string
  streamType?: 'WEBCAM' | 'RTSP' | 'IP_CAM'
  ipStreamUrl?: string
  autoOpenDrawer?: boolean
  captureOnOpen?: boolean
}) {
  return prisma.storeCameraMapping.upsert({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    update: {
      cameraName: input.cameraName,
      deviceId: input.deviceId,
      streamType: input.streamType || 'WEBCAM',
      ipStreamUrl: input.ipStreamUrl || null,
      autoOpenDrawer: input.autoOpenDrawer !== undefined ? input.autoOpenDrawer : true,
      captureOnOpen: input.captureOnOpen !== undefined ? input.captureOnOpen : true,
      lastDetectedAt: new Date(),
    },
    create: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      userId: input.userId,
      cameraName: input.cameraName,
      deviceId: input.deviceId,
      streamType: input.streamType || 'WEBCAM',
      ipStreamUrl: input.ipStreamUrl || null,
      autoOpenDrawer: input.autoOpenDrawer !== undefined ? input.autoOpenDrawer : true,
      captureOnOpen: input.captureOnOpen !== undefined ? input.captureOnOpen : true,
      lastDetectedAt: new Date(),
    },
  })
}

/**
 * Record a Cash Drawer Open Event with optional camera snapshot verification.
 * Automatically triggered on Cash Collection in POS or manual Admin Kick.
 */
export async function recordCashDrawerOpen(input: {
  organizationId: string
  branchId: string
  userId: string
  eventType: 'AUTO_CASH_COLLECTED' | 'MANUAL_ADMIN_OPEN' | 'SENSOR_DETECTED'
  invoiceNumber?: string
  cashAmount?: number
  snapshotData?: string // Base64 JPEG/WebP frame captured from the counter camera
  deviceId?: string
  notes?: string
}) {
  // Purge records older than 48 hours to guarantee strict 2-day retention
  await purgeExpiredCameraStorage(input.organizationId).catch((err) =>
    console.warn('Auto-purge error:', err)
  )

  const event = await prisma.cashDrawerEvent.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      userId: input.userId,
      eventType: input.eventType,
      invoiceNumber: input.invoiceNumber || null,
      cashAmount: input.cashAmount ? new Decimal(input.cashAmount) : new Decimal(0),
      snapshotData: input.snapshotData || null,
      deviceId: input.deviceId || null,
      notes: input.notes || null,
      openedAt: new Date(),
    },
    include: {
      user: { select: { name: true } },
      branch: { select: { name: true } },
    },
  })

  return event
}

/**
 * Get Cash Drawer Analytics, Open Counts, and 48-Hour Audit Log.
 * Strictly scoped to the admin's organization and (optionally) specific user counter.
 */
export async function getCashDrawerAnalytics(
  organizationId: string,
  userId?: string,
  isSuperAdmin = false
): Promise<CameraDrawerSummary> {
  const enabled = isSuperAdmin ? true : await isCameraDrawerEnabled(organizationId)

  // Enforce 2-day storage retention cleanup before returning results
  await purgeExpiredCameraStorage(organizationId).catch(() => null)

  const cutoff48h = new Date(Date.now() - CAMERA_RETENTION_MS)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  // Strict User/Store isolation (no merging of cameras or streams)
  const whereScope = {
    organizationId,
    createdAt: { gte: cutoff48h },
    ...(userId && !isSuperAdmin ? { userId } : {}),
  }

  const [totalOpens48h, todayOpens, cashCollectedOpens, manualAdminOpens, rawEvents] =
    await Promise.all([
      prisma.cashDrawerEvent.count({ where: whereScope }),
      prisma.cashDrawerEvent.count({
        where: {
          ...whereScope,
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.cashDrawerEvent.count({
        where: {
          ...whereScope,
          eventType: 'AUTO_CASH_COLLECTED',
        },
      }),
      prisma.cashDrawerEvent.count({
        where: {
          ...whereScope,
          eventType: 'MANUAL_ADMIN_OPEN',
        },
      }),
      prisma.cashDrawerEvent.findMany({
        where: whereScope,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { name: true } },
          branch: { select: { name: true } },
        },
      }),
    ])

  const sensorDetectedOpens = totalOpens48h - cashCollectedOpens - manualAdminOpens
  const lastOpenedAt = rawEvents[0]?.openedAt ? rawEvents[0].openedAt.toISOString() : null

  const events = rawEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    invoiceNumber: e.invoiceNumber,
    cashAmount: e.cashAmount ? Number(e.cashAmount) : 0,
    snapshotData: e.snapshotData,
    openedAt: e.openedAt.toISOString(),
    userName: e.user.name,
    branchName: e.branch.name,
    notes: e.notes,
  }))

  return {
    enabled,
    totalOpens48h,
    todayOpens,
    cashCollectedOpens,
    manualAdminOpens,
    sensorDetectedOpens: Math.max(0, sensorDetectedOpens),
    lastOpenedAt,
    events,
  }
}
