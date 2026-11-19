import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_SALES)

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const where: any = {}

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (search.trim()) {
      where.OR = [
        { invoiceNumber: { contains: search.trim(), mode: 'insensitive' } },
        { customer: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { prescription: { doctor: { name: { contains: search.trim(), mode: 'insensitive' } } } },
        { prescription: { doctorName: { contains: search.trim(), mode: 'insensitive' } } },
        { doctorName: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        prescription: {
          select: {
            id: true,
            doctorName: true,
            doctorRegNumber: true,
            doctor: { select: { id: true, name: true, regNumber: true } },
          },
        },
        payments: { select: { id: true, method: true, amount: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, drugSchedule: true } },
            itemBatches: {
              include: {
                batch: { select: { id: true, batchNumber: true, expiryDate: true } },
              },
            },
          },
        },
      },
    })

    const transformed = sales.map((s) => {
      const primaryPayment = s.payments && s.payments.length > 0 ? s.payments[0].method : 'CASH'
      const doctorDisplayName =
        s.prescription?.doctor?.name ||
        s.prescription?.doctorName ||
        s.doctorName ||
        'Self / OTC'

      return {
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate,
        status: s.status,
        paymentMethod: primaryPayment,
        customerName: s.customer?.name || 'Walk-in Customer',
        customerPhone: s.customer?.phone || '—',
        doctorName: doctorDisplayName,
        subtotal: Number(s.subtotal),
        discountAmount: Number(s.discountAmount),
        taxAmount: Number(s.taxAmount),
        totalAmount: Number(s.totalAmount),
        amountPaid: Number(s.amountPaid),
        balanceDue: Number(s.balanceDue),
        itemsCount: s.items.length,
        items: s.items.map((it) => {
          const batchInfo =
            it.itemBatches && it.itemBatches.length > 0 ? it.itemBatches[0].batch : null
          return {
            id: it.id,
            productName: it.productName || it.product?.name || 'Item',
            batchNumber: batchInfo?.batchNumber || 'AUTO',
            expiryDate: batchInfo?.expiryDate,
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
            discountPercent: Number(it.discountPercent),
            taxPercent: Number(it.taxPercent),
            totalAmount: Number(it.totalAmount),
          }
        }),
      }
    })

    return NextResponse.json({ success: true, data: transformed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
