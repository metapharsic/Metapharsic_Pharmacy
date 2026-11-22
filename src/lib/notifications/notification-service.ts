import prisma from '@/lib/db/prisma'
import { NotificationType } from '@prisma/client'
import { RefillRetentionService } from '@/lib/retention/refill-retention-service'

export { NotificationType }

export interface NotificationItem {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data: any
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

export interface NotificationSummary {
  total: number
  unreadCount: number
  lowStockCount: number
  expiryCount: number
  paymentDueCount: number
  refillCount: number
  systemCount: number
}

export class NotificationService {
  /**
   * Automatically synchronizes real database state (low stock, expiring batches, purchase dues, refills)
   * into in-app notifications for the specific user and their organization.
   * Runs intelligently without duplicating existing recent notifications.
   */
  static async syncUserNotifications(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          organizationId: true,
          branchId: true,
          isSuperAdmin: true,
        },
      })

      if (!user) return

      let orgId = user.organizationId
      if (!orgId && !user.isSuperAdmin) {
        const defaultOrg = await prisma.organization.findFirst({ select: { id: true } })
        orgId = defaultOrg?.id || null
      }

      // Check existing notifications in the last 24 hours to prevent duplicate spamming
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recent = await prisma.notification.findMany({
        where: {
          userId,
          createdAt: { gte: oneDayAgo },
        },
        select: {
          id: true,
          type: true,
          data: true,
          isRead: true,
        },
      })

      // 1. LOW_STOCK alerts
      const lowStockInventories = await prisma.inventory.findMany({
        where: {
          ...(orgId && !user.isSuperAdmin ? { branch: { organizationId: orgId } } : {}),
          availableQuantity: { lte: 10 },
        },
        include: {
          product: { select: { id: true, name: true, minStockLevel: true } },
          branch: { select: { id: true, name: true } },
        },
        take: 5,
      })

      for (const inv of lowStockInventories) {
        const minThreshold = inv.product.minStockLevel || 10
        if (inv.availableQuantity > minThreshold) continue

        const alreadySent = recent.some(
          n => n.type === 'LOW_STOCK' && (n.data as any)?.productId === inv.product.id
        )

        if (!alreadySent) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'LOW_STOCK',
              title: `Low Stock: ${inv.product.name}`,
              message: `${inv.product.name} is down to ${inv.availableQuantity} units at ${inv.branch.name}. Minimum threshold is ${minThreshold}.`,
              data: {
                productId: inv.product.id,
                branchId: inv.branchId,
                availableQuantity: inv.availableQuantity,
                link: '/inventory',
              },
            },
          })
        }
      }

      // 2. EXPIRY_ALERT (within 60 days)
      const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      const expiringBatches = await prisma.batch.findMany({
        where: {
          ...(orgId && !user.isSuperAdmin ? { product: { organizationId: orgId } } : {}),
          expiryDate: { lte: in60Days },
          quantity: { gt: 0 },
          status: 'ACTIVE',
        },
        include: {
          product: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: 'asc' },
        take: 4,
      })

      for (const b of expiringBatches) {
        const alreadySent = recent.some(
          n => n.type === 'EXPIRY_ALERT' && (n.data as any)?.batchId === b.id
        )

        if (!alreadySent) {
          const expStr = b.expiryDate.toISOString().slice(0, 10)
          await prisma.notification.create({
            data: {
              userId,
              type: 'EXPIRY_ALERT',
              title: `Near Expiry: ${b.product.name}`,
              message: `Batch ${b.batchNumber} (${b.quantity} units) expires on ${expStr}. Action required to prevent dead stock loss.`,
              data: {
                batchId: b.id,
                productId: b.productId,
                batchNumber: b.batchNumber,
                expiryDate: expStr,
                link: '/batches',
              },
            },
          })
        }
      }

      // 3. PAYMENT_DUE (Accounts payable supplier invoices)
      const pendingPurchases = await prisma.purchase.findMany({
        where: {
          ...(orgId && !user.isSuperAdmin ? { branch: { organizationId: orgId } } : {}),
          balanceDue: { gt: 0 },
          status: { not: 'CANCELLED' },
        },
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { purchaseDate: 'desc' },
        take: 3,
      })

      for (const p of pendingPurchases) {
        const alreadySent = recent.some(
          n => n.type === 'PAYMENT_DUE' && (n.data as any)?.purchaseId === p.id
        )

        if (!alreadySent) {
          const invNo = p.invoiceNumber || p.purchaseNumber
          const supName = p.supplier?.name || 'Distributor'
          const dueAmt = Number(p.balanceDue).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })

          await prisma.notification.create({
            data: {
              userId,
              type: 'PAYMENT_DUE',
              title: `Payment Due: ${supName}`,
              message: `Outstanding supplier balance of ${dueAmt} for Invoice #${invNo}.`,
              data: {
                purchaseId: p.id,
                supplierName: supName,
                balanceDue: Number(p.balanceDue),
                link: '/purchases',
              },
            },
          })
        }
      }

      // 4. PRESCRIPTION_PENDING / Refill Reminders
      if (orgId) {
        try {
          const summary = await RefillRetentionService.getRefillRetentionSummary(orgId)
          const pendingCount = (summary.dueWithin48Hours || 0) + (summary.overdueRefills || 0)

          if (pendingCount > 0) {
            const alreadySent = recent.some(
              n => n.type === 'PRESCRIPTION_PENDING' && (n.data as any)?.source === 'refill_retention'
            )

            if (!alreadySent) {
              await prisma.notification.create({
                data: {
                  userId,
                  type: 'PRESCRIPTION_PENDING',
                  title: `${pendingCount} Refill Reminders Due`,
                  message: `${pendingCount} chronic patients require refill outreach. Automated WhatsApp dispatch ready in Refills Hub.`,
                  data: {
                    source: 'refill_retention',
                    pendingCount,
                    link: '/refills',
                  },
                },
              })
            }
          }
        } catch {
          // Gracefully continue if retention service has no sales data
        }
      }

      // 5. Initial System Welcome Notification if zero notifications ever exist
      const totalUserNotifications = await prisma.notification.count({ where: { userId } })
      if (totalUserNotifications === 0) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM',
            title: 'Real-Time Notification Engine Active',
            message: `Welcome ${user.name || 'to Metapharsic Rx'}. Live stock alerts, batch expiries, and accounts payable reminders will sync here in real time.`,
            data: { link: '/settings' },
          },
        })
      }
    } catch (err) {
      console.error('[NotificationService] syncUserNotifications error:', err)
    }
  }

  /**
   * Fetches notifications for a specific user.
   */
  static async getUserNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean; type?: NotificationType }
  ): Promise<NotificationItem[]> {
    const where: any = { userId }
    if (options?.unreadOnly) {
      where.isRead = false
    }
    if (options?.type) {
      where.type = options.type
    }

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 40,
    })

    return items as NotificationItem[]
  }

  /**
   * Returns count of unread notifications for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    })
  }

  /**
   * Returns summary counts by category.
   */
  static async getNotificationSummary(userId: string): Promise<NotificationSummary> {
    const [total, unreadCount, lowStock, expiry, paymentDue, refill, system] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.count({ where: { userId, isRead: false, type: 'LOW_STOCK' } }),
      prisma.notification.count({ where: { userId, isRead: false, type: 'EXPIRY_ALERT' } }),
      prisma.notification.count({ where: { userId, isRead: false, type: 'PAYMENT_DUE' } }),
      prisma.notification.count({ where: { userId, isRead: false, type: 'PRESCRIPTION_PENDING' } }),
      prisma.notification.count({ where: { userId, isRead: false, type: 'SYSTEM' } }),
    ])

    return {
      total,
      unreadCount,
      lowStockCount: lowStock,
      expiryCount: expiry,
      paymentDueCount: paymentDue,
      refillCount: refill,
      systemCount: system,
    }
  }

  /**
   * Marks a single notification as read for a specific user.
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const res = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    })
    return res.count > 0
  }

  /**
   * Marks all notifications as read for a specific user.
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const res = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return res.count
  }

  /**
   * Deletes a specific notification belonging to a user.
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const res = await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    })
    return res.count > 0
  }

  /**
   * Clears all read notifications for a user.
   */
  static async clearRead(userId: string): Promise<number> {
    const res = await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    })
    return res.count
  }

  /**
   * Creates a notification for a user.
   */
  static async createNotification(params: {
    userId: string
    type: NotificationType
    title: string
    message: string
    data?: any
  }): Promise<NotificationItem> {
    const created = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ?? null,
      },
    })
    return created as NotificationItem
  }

  /**
   * Broadcasts a notification to all active staff of an organization.
   */
  static async broadcastToOrganization(params: {
    organizationId: string
    type: NotificationType
    title: string
    message: string
    data?: any
  }): Promise<number> {
    const users = await prisma.user.findMany({
      where: {
        organizationId: params.organizationId,
        isActive: true,
      },
      select: { id: true },
    })

    if (users.length === 0) return 0

    await prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ?? null,
      })),
    })

    return users.length
  }
}
