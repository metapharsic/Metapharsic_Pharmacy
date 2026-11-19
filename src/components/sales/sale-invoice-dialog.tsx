'use client'

import { Download, FileSpreadsheet, MessageSquare, Printer } from 'lucide-react'
import { useState } from 'react'

import { ReceiptInvoice, type ReceiptData } from '@/components/pos/receipt-invoice'
import { WhatsAppInvoiceDialog } from '@/components/sales/whatsapp-invoice-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { downloadInvoicePdf, type InvoiceSaleData } from '@/lib/pdf/invoice-pdf-generator'
import { downloadSaleInvoiceExcel } from '@/lib/reports/invoice-excel-generator'
import { cn } from '@/lib/utils/cn'

export function SaleInvoiceDialog({
  sale,
  className,
}: {
  sale: ReceiptData
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [whatsAppOpen, setWhatsAppOpen] = useState(false)

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    downloadInvoicePdf(sale as unknown as InvoiceSaleData, { format: 'a4' })
  }

  const handleDownloadExcel = (e: React.MouseEvent) => {
    e.stopPropagation()
    downloadSaleInvoiceExcel(sale)
  }

  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation()
    setWhatsAppOpen(true)
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Print Bill / Invoice
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-6 border-b pb-2">
            <DialogTitle>Tax Invoice {sale.invoiceNumber}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                title="Download standard statutory Excel workbook (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenWhatsApp}
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Share WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-1.5 h-8 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
          </DialogHeader>
          <ReceiptInvoice sale={sale} showPrintButton={true} />
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadExcel}
        className="gap-2 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        title="Download official tax invoice Excel (.xlsx)"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenWhatsApp}
        className="gap-2 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        title="Share official tax invoice via WhatsApp"
      >
        <MessageSquare className="h-4 w-4" />
        WhatsApp
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        className="gap-2"
        title="Download official tax invoice PDF"
      >
        <Download className="h-4 w-4" />
        Download PDF
      </Button>

      <WhatsAppInvoiceDialog
        open={whatsAppOpen}
        onOpenChange={setWhatsAppOpen}
        sale={sale as any}
      />
    </div>
  )
}
