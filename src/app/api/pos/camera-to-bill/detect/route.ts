import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

import { getSession } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'
import {
  MultiItemDetector,
  type DetectedCounterItem,
} from '@/lib/vision/multi-item-detector'

export const dynamic = 'force-dynamic'

export interface ResolvedCounterItem extends DetectedCounterItem {
  matchedProductId?: string
  matchedProductSku?: string
  matchedProductName?: string
  matchedBatchId?: string
  matchedBatchNumber?: string
  matchedBatchExpiry?: string
  matchedBatchStock?: number
  matchedHsnCode?: string | null
  matchedGstRate?: number
}

/**
 * POST /api/pos/camera-to-bill/detect
 * High-speed multi-item camera-to-bill vision detection pipeline.
 * Localizes multiple items on the counter, detects cut blister strips,
 * counts remaining tablet pockets, verifies FEFO batches, checks Schedule H/H1,
 * and formats items for immediate POS cart ingestion.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      imageBase64?: string
      demoSampleKey?: string
      branchId?: string
    }

    let imageBuffer = Buffer.alloc(0)

    if (body.imageBase64 && typeof body.imageBase64 === 'string') {
      const cleanBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '')
      imageBuffer = Buffer.from(cleanBase64, 'base64')

      // Normalize image with Sharp for optimal contrast & size
      try {
        const normalized = await sharp(imageBuffer)
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
        imageBuffer = Buffer.from(normalized)
      } catch (err) {
        console.warn('[CameraToBill] Sharp normalization warning:', err)
      }
    }

    // Run multi-item computer vision detection
    const detection = await MultiItemDetector.detectCounterItems(imageBuffer, body.demoSampleKey)

    // Resolve catalog and FEFO batches from database for each detected item
    const resolvedItems: ResolvedCounterItem[] = []

    for (const item of detection.items) {
      const brandRoot = item.brandName.split(' ')[0] || item.brandName
      const resolved: ResolvedCounterItem = { ...item }

      try {
        // 1. Catalog Product Lookup
        const matchedProduct = await prisma.product.findFirst({
          where: {
            OR: [
              { name: { contains: brandRoot, mode: 'insensitive' } },
              { genericName: { contains: brandRoot, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            sku: true,
            mrp: true,
            gstRate: true,
            hsnCode: true,
            drugSchedule: true,
            isPrescriptionRequired: true,
            tabsPerStrip: true,
          },
        })

        if (matchedProduct) {
          resolved.matchedProductId = matchedProduct.id
          resolved.matchedProductSku = matchedProduct.sku
          resolved.matchedProductName = matchedProduct.name
          resolved.matchedHsnCode = matchedProduct.hsnCode
          resolved.matchedGstRate = Number(matchedProduct.gstRate) || 12

          // If product is Schedule H / H1 in database, enforce regulatory compliance
          if (matchedProduct.drugSchedule !== 'NONE' || matchedProduct.isPrescriptionRequired) {
            resolved.drugSchedule = matchedProduct.drugSchedule as any
            resolved.isPrescriptionRequired = true
            resolved.requiresConfirmation = true
            resolved.confirmationReason = `Schedule ${matchedProduct.drugSchedule} Drug: Prescribing physician and Rx attachment required.`
          }

          // 2. FEFO Batch Resolution (First-Expiry, First-Out)
          // If specific batch number was read by OCR, try to find that exact batch first
          let targetBatch = null

          if (item.batchNumber) {
            targetBatch = await prisma.batch.findFirst({
              where: {
                productId: matchedProduct.id,
                batchNumber: { contains: item.batchNumber, mode: 'insensitive' },
                status: 'ACTIVE',
              },
            })
          }

          // Fallback to FEFO (earliest expiring active batch)
          if (!targetBatch) {
            targetBatch = await prisma.batch.findFirst({
              where: {
                productId: matchedProduct.id,
                status: 'ACTIVE',
                quantity: { gt: 0 },
              },
              orderBy: { expiryDate: 'asc' },
            })
          }

          if (targetBatch) {
            resolved.matchedBatchId = targetBatch.id
            resolved.matchedBatchNumber = targetBatch.batchNumber
            resolved.matchedBatchExpiry = targetBatch.expiryDate.toISOString().slice(0, 10)
            resolved.matchedBatchStock = targetBatch.quantity
          }
        }
      } catch (dbErr) {
        console.warn('[CameraToBill] Database resolution warning for item:', item.brandName, dbErr)
      }

      resolvedItems.push(resolved)
    }

    const estimatedTotal = resolvedItems.reduce(
      (sum, it) => sum + (it.proRataPricing?.lineTotal || it.mrp || 0),
      0
    )

    return NextResponse.json({
      success: true,
      items: resolvedItems,
      summary: {
        totalDetected: resolvedItems.length,
        cutStripsCount: resolvedItems.filter(it => it.itemType === 'BLISTER_CUT_STRIP').length,
        prescriptionRequiredCount: resolvedItems.filter(it => it.isPrescriptionRequired).length,
        estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      },
      engine: detection.engine,
      processedAt: detection.processedAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Counter vision detection failed'
    console.error('[POST /api/pos/camera-to-bill/detect] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
