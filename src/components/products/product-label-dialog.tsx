'use client'

// ─────────────────────────────────────────────────────────────
// Component — ProductLabelDialog
// Thermal Shelf Edge, Barcode & 2D QR Label Printing & Export Engine
// Produces crisp 203/300 DPI vector barcodes, QR codes & shelf tags.
// Includes Admin-privileged asset download (SVG/PNG/Sheet).
// ─────────────────────────────────────────────────────────────
import {
  Barcode,
  Copy,
  Download,
  FileCode,
  Lock,
  Printer,
  QrCode,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import {
  generateCode128Svg,
  generateProductCodes,
  triggerSvgDownload,
  triggerFileDownload,
  type GeneratedCodeOutput,
} from '@/lib/products/barcode-qr-generator'
import {
  generateBatchProductCodes,
  buildPrintableStickerSheetHtml,
} from '@/lib/products/barcode-qr-worker-bridge'
import { playBarcodeScanSound, playSuccessCheckoutSound } from '@/lib/sound/sound-effects'
import type { ProductRow } from '@/components/products/product-table'

interface ProductLabelDialogProps {
  products: ProductRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type LabelSize = '50x25' | '38x25' | 'a4_sheet'
type CodeDisplayMode = 'barcode' | 'qr' | 'both'

export function ProductLabelDialog({ products, open, onOpenChange }: ProductLabelDialogProps) {
  const { data: session } = useSession()
  const toast = useToast()

  const [labelSize, setLabelSize] = useState<LabelSize>('50x25')
  const [displayMode, setDisplayMode] = useState<CodeDisplayMode>('both')
  const [copies, setCopies] = useState<number>(1)
  const [includeRack, setIncludeRack] = useState<boolean>(true)
  const [includeSalt, setIncludeSalt] = useState<boolean>(true)
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, GeneratedCodeOutput>>({})
  const [generatingBatch, setGeneratingBatch] = useState<boolean>(false)

  // Admin privilege check
  const userRoles = session?.user?.roles ?? []
  const isAdmin =
    userRoles.includes('owner') ||
    userRoles.includes('admin') ||
    (session?.user as unknown as { role?: string })?.role === 'ADMIN'

  // Pre-generate QR codes for visible products when dialog opens
  useEffect(() => {
    if (!open || !products || products.length === 0) return

    let isMounted = true
    const loadCodes = async () => {
      const newMap: Record<string, GeneratedCodeOutput> = {}
      for (const p of products.slice(0, 30)) {
        try {
          const codes = await generateProductCodes({
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            genericName: p.genericName,
            mrp: Number(p.mrp) || 0,
            drugSchedule: p.drugSchedule,
            rack: p.rack,
          })
          newMap[p.id] = codes
        } catch {
          // ignore
        }
      }
      if (isMounted) {
        setQrCodeMap(newMap)
      }
    }

    void loadCodes()
    return () => {
      isMounted = false
    }
  }, [open, products])

  if (!products || products.length === 0) return null

  function handlePrint() {
    playBarcodeScanSound()
    window.print()
  }

  // Admin download for individual product barcode
  function handleDownloadBarcode(p: ProductRow) {
    if (!isAdmin) {
      toast.error('Admin Privilege Required', 'Only system administrators can download raw barcode assets.')
      return
    }
    const barcodeVal = p.barcode || p.sku || `SKU-${p.id.slice(0, 8)}`
    const svg = generateCode128Svg(barcodeVal, { height: 60, barWidth: 2, includeText: true })
    triggerSvgDownload(svg, `Barcode_${p.sku}_${barcodeVal}.svg`)
    toast.success(`Barcode SVG downloaded for ${p.name}`)
  }

  // Admin download for individual product QR code
  function handleDownloadQr(p: ProductRow) {
    if (!isAdmin) {
      toast.error('Admin Privilege Required', 'Only system administrators can download raw QR assets.')
      return
    }
    const data = qrCodeMap[p.id]
    if (!data?.qrCodeDataUrl) {
      toast.error('QR code still generating, please wait a moment.')
      return
    }
    triggerFileDownload(data.qrCodeDataUrl, `QRCode_${p.sku}.png`)
    toast.success(`QR Code PNG downloaded for ${p.name}`)
  }

  // Admin bulk batch download (24-up sticker sheet HTML / print)
  async function handleDownloadBatchStickerSheet() {
    if (!isAdmin) {
      toast.error('Admin Privilege Required', 'Only administrators can export bulk label sheets.')
      return
    }

    setGeneratingBatch(true)
    try {
      const mapped = products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        genericName: p.genericName,
        mrp: Number(p.mrp) || 0,
        drugSchedule: p.drugSchedule,
        rack: p.rack,
      }))

      const results = await generateBatchProductCodes(mapped)
      const html = buildPrintableStickerSheetHtml(results, {
        includeQr: displayMode === 'qr' || displayMode === 'both',
        includeBarcode: displayMode === 'barcode' || displayMode === 'both',
      })

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      triggerFileDownload(url, `Metapharsic_Sticker_Sheet_${Date.now()}.html`)
      playSuccessCheckoutSound()
      toast.success(
        `Bulk Sheet Generated`,
        `Exported 24-Up sticker sheet for ${products.length} products. Open in browser to print.`
      )
    } catch {
      toast.error('Failed to generate bulk sticker sheet')
    } finally {
      setGeneratingBatch(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <DialogTitle className="text-base font-semibold">
                Dispensary Shelf Label & Barcode / QR Printer
              </DialogTitle>
            </div>
            {isAdmin ? (
              <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] gap-1 font-mono">
                <ShieldCheck className="h-3 w-3" /> Admin Privileged
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
                <Lock className="h-3 w-3" /> Staff View
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generating standardized thermal shelf edge stickers and ISO QR codes for{' '}
            <strong className="text-foreground">{products.length} product(s)</strong>
          </p>
        </DialogHeader>

        {/* Configuration Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-muted/40 p-3 rounded-lg border text-xs">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Label Template
            </label>
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50x25">50mm × 25mm (Standard Shelf Tag)</SelectItem>
                <SelectItem value="38x25">38mm × 25mm (Vial / Box Sticker)</SelectItem>
                <SelectItem value="a4_sheet">A4 Sheet (24 Labels Multi-up)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Code Format
            </label>
            <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as CodeDisplayMode)}>
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Combined (1D Barcode + 2D QR)</SelectItem>
                <SelectItem value="barcode">1D Code 128 Barcode Only</SelectItem>
                <SelectItem value="qr">2D QR Code Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Copies per Product
            </label>
            <Select value={String(copies)} onValueChange={(v) => setCopies(Number(v))}>
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Copy</SelectItem>
                <SelectItem value="2">2 Copies</SelectItem>
                <SelectItem value="4">4 Copies</SelectItem>
                <SelectItem value="10">10 Copies (Shelf Bin)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col justify-center gap-1 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRack}
                onChange={(e) => setIncludeRack(e.target.checked)}
                className="rounded border-border h-3.5 w-3.5"
              />
              <span className="text-[11px]">Show Rack Locator</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSalt}
                onChange={(e) => setIncludeSalt(e.target.checked)}
                className="rounded border-border h-3.5 w-3.5"
              />
              <span className="text-[11px]">Show Generic Salt</span>
            </label>
          </div>
        </div>

        {/* Admin Quick Bulk Export Bar */}
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-xs">
            <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-medium">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>Admin Bulk Export Privilege: Download printable A4 24-Up sticker sheets &amp; vector codes</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={generatingBatch}
              onClick={handleDownloadBatchStickerSheet}
              className="h-7 text-xs gap-1 border-teal-500/30 text-teal-800 dark:text-teal-200 hover:bg-teal-500/20"
            >
              <Download className="h-3 w-3" />
              {generatingBatch ? 'Processing Multi-Thread...' : 'Download 24-Up Sheet (HTML)'}
            </Button>
          </div>
        )}

        {/* Live Thermal Label Preview (Printable Area) */}
        <div className="border border-dashed border-primary/30 rounded-lg p-4 bg-muted/10">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" /> Live Thermal Output Preview
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">
              Showing {products.length} product(s) × {copies} cop{copies > 1 ? 'ies' : 'y'}
            </span>
          </p>

          <div
            id="thermal-print-area"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 justify-center"
          >
            {products.map((p) => {
              const barcodeValue = p.barcode || p.sku || `SKU-${p.id.slice(0, 8)}`
              const codeBundle = qrCodeMap[p.id]
              const expDate = p.earliestExpiry
                ? new Date(p.earliestExpiry).toLocaleDateString('en-IN', {
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Exp: N/A'

              return Array.from({ length: copies }).map((_, copyIdx) => (
                <div
                  key={`${p.id}-${copyIdx}`}
                  className="bg-card border-2 border-border shadow-sm p-3 rounded-md flex flex-col justify-between text-left min-h-[145px] max-w-[320px] select-none mx-auto w-full group relative"
                >
                  <div className="flex items-start justify-between gap-1 leading-tight">
                    <div className="truncate flex-1">
                      <span className="font-bold text-xs text-foreground block truncate">
                        {p.name}
                      </span>
                      {includeSalt && p.genericName && (
                        <span className="text-[9.5px] text-muted-foreground block truncate">
                          {p.genericName}
                        </span>
                      )}
                    </div>
                    {p.drugSchedule && ['H', 'H1', 'X'].includes(p.drugSchedule) && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 shrink-0">
                        SCH {p.drugSchedule}
                      </span>
                    )}
                  </div>

                  {/* Barcode / QR Codes Rendering */}
                  <div className="my-1.5 flex items-center justify-around gap-2">
                    {(displayMode === 'barcode' || displayMode === 'both') && (
                      <div className="flex-1 text-center max-w-[190px]">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: generateCode128Svg(barcodeValue, {
                              height: 32,
                              barWidth: 1.5,
                              includeText: false,
                            }),
                          }}
                        />
                        <span className="font-mono text-[9px] text-muted-foreground tracking-widest block -mt-0.5">
                          {barcodeValue}
                        </span>
                      </div>
                    )}

                    {(displayMode === 'qr' || displayMode === 'both') && (
                      <div className="shrink-0 text-center">
                        {codeBundle?.qrCodeDataUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={codeBundle.qrCodeDataUrl}
                            alt="QR Code"
                            className="w-12 h-12 object-contain mx-auto border border-border/40 rounded p-0.5 bg-white"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted/40 rounded flex items-center justify-center text-[8px] text-muted-foreground">
                            QR...
                          </div>
                        )}
                        <span className="text-[8px] text-muted-foreground block font-mono">
                          QR Scan
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer metadata */}
                  <div className="flex items-center justify-between text-[10px] border-t border-border/60 pt-1 text-muted-foreground">
                    <div>
                      {includeRack && p.rack ? (
                        <span className="font-semibold text-foreground">Rack: {p.rack}</span>
                      ) : (
                        <span>{p.manufacturer || 'METAPHARSIC'}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-foreground">
                        MRP ₹{Number(p.mrp).toFixed(2)}
                      </span>
                      <span className="text-[8.5px] block text-muted-foreground">{expDate}</span>
                    </div>
                  </div>

                  {/* Admin Direct Asset Download Buttons Hover Toolbar */}
                  {isAdmin && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 backdrop-blur shadow rounded border p-1 flex items-center gap-1 z-10">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Download 1D Barcode (SVG)"
                        onClick={() => handleDownloadBarcode(p)}
                        className="h-6 w-6 text-foreground hover:text-primary"
                      >
                        <Barcode className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Download 2D QR Code (PNG)"
                        onClick={() => handleDownloadQr(p)}
                        className="h-6 w-6 text-foreground hover:text-primary"
                      >
                        <QrCode className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            })}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-[11px] text-muted-foreground">
            Standard ESC/POS 58mm/80mm label printers, TSC, Zebra, and A4 24-Up sticker sheets.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Close
            </Button>
            <Button size="sm" onClick={handlePrint} className="text-xs gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print Labels
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
