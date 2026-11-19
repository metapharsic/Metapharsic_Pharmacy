'use client'

import { formatRack } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — BarcodeScannerModal
// Full-featured barcode scanner supporting:
// 1. Live Camera Stream (Html5Qrcode with laser viewfinder)
// 2. Physical USB / Bluetooth Handheld Scanners
// 3. Manual barcode / SKU input
// 4. One-click instant demo barcodes
// 5. Direct addition & synchronization to POS Cart from Inventory
// ─────────────────────────────────────────────────────────────
import {
  Barcode,
  Camera,
  CheckCircle2,
  ExternalLink,
  Flame,
  Layers,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/lib/hooks/use-toast'
import { playBarcodeBeep, playBarcodeErrorSound } from '@/lib/scanner/barcode-sound'
import { useBarcodeScanner } from '@/lib/scanner/use-barcode-scanner'
import {
  addPosCartItem,
  getPosCartSummary,
  usePosCart,
  type PosCartLine,
} from '@/lib/stores/pos-cart-store'

export interface BarcodeLookupData {
  product: {
    id: string
    name: string
    genericName?: string | null
    sku: string
    barcode?: string | null
    rack?: string | null
    unitOfMeasure: string
    mrp: number
    composition?: string | null
    manufacturer?: string | null
    drugSchedule: string
    isPrescriptionRequired: boolean
    categoryName?: string | null
    additionalBarcodes: string[]
  }
  inventory?: {
    totalQuantity: number
    availableQuantity: number
    reservedQuantity: number
    branch?: { id: string; name: string; code: string | null }
  } | null
  batches: Array<{
    id: string
    batchNumber: string
    expiryDate: string | Date
    availableQuantity: number
    mrp: number
    isNearExpiry: boolean
    isFefoFirst: boolean
  }>
  fefoBatch?: {
    id: string
    batchNumber: string
    expiryDate: string | Date
    availableQuantity: number
    mrp: number
  } | null
  posCartItem: PosCartLine
}

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string | null
  mode?: 'inventory' | 'pos'
  onProductScanned?: (data: BarcodeLookupData) => void
  onAddToCart?: (item: PosCartLine) => void
}

const DEMO_BARCODES = [
  { barcode: '8901234567890', name: 'Paracetamol 500mg', type: 'Strip · 10 tabs' },
  { barcode: '8901234567891', name: 'Amoxicillin 500mg', type: 'Rx Schedule H' },
  { barcode: '8901234567892', name: 'Cough Syrup 100ml', type: 'Bottle' },
  { barcode: '8901234567893', name: 'Vitamin C 500mg', type: 'Supplement' },
]

export function BarcodeScannerModal({
  open,
  onOpenChange,
  branchId,
  mode = 'inventory',
  onProductScanned,
  onAddToCart,
}: BarcodeScannerModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { summary: posSummary } = usePosCart()

  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'demo'>('camera')
  const [manualInput, setManualInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [autoAddToPos, setAutoAddToPos] = useState(true)
  const [scannedData, setScannedData] = useState<BarcodeLookupData | null>(null)
  const [scanQty, setScanQty] = useState(1)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [cameraActive, setCameraActive] = useState(false)

  // References for Html5Qrcode instance
  const scannerRef = useRef<unknown>(null)
  const qrRegionId = 'html5-barcode-scanner-viewfinder'

  // ─── Play beep helper ────────────────────────────────────────
  const triggerBeep = useCallback(() => {
    if (soundEnabled) playBarcodeBeep()
  }, [soundEnabled])

  const triggerErrorSound = useCallback(() => {
    if (soundEnabled) playBarcodeErrorSound()
  }, [soundEnabled])

  // ─── Lookup Barcode API ──────────────────────────────────────
  const lookupBarcode = useCallback(
    async (code: string) => {
      const clean = code.trim()
      if (!clean) return

      setLoading(true)
      try {
        const params = new URLSearchParams({ barcode: clean })
        if (branchId) params.set('branchId', branchId)

        const res = await fetch(`/api/barcode/lookup?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: BarcodeLookupData
          error?: { message?: string }
        }

        if (json.success && json.data) {
          triggerBeep()
          setScannedData(json.data)
          setLastScannedCode(clean)
          setScanQty(1)

          if (onProductScanned) {
            onProductScanned(json.data)
          }

          // Auto-add to POS if enabled or in POS mode
          if (autoAddToPos || mode === 'pos') {
            const itemToAdd: PosCartLine = {
              ...json.data.posCartItem,
              quantity: 1,
            }

            if (onAddToCart) {
              onAddToCart(itemToAdd)
            } else {
              addPosCartItem(itemToAdd)
            }

            toast.success(
              `Added to POS: ${json.data.product.name}`,
              `Batch: ${json.data.posCartItem.batchNumber || 'Standard'} · ₹${json.data.posCartItem.mrp}`
            )
          }
        } else {
          triggerErrorSound()
          toast.error(
            json.error?.message || `No product found for barcode "${clean}"`,
            'Check barcode or try searching product catalog'
          )
        }
      } catch {
        triggerErrorSound()
        toast.error('Network error during barcode scan lookup')
      } finally {
        setLoading(false)
      }
    },
    [branchId, mode, autoAddToPos, onProductScanned, onAddToCart, toast, triggerBeep, triggerErrorSound]
  )

  // ─── Hardware USB/Bluetooth Barcode Scanner Listener ─────────
  useBarcodeScanner({
    enabled: open,
    allowInInputs: true,
    onScan: (barcode) => {
      void lookupBarcode(barcode)
    },
  })

  // ─── Camera Lifecycle using Html5Qrcode ───────────────────────
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scanner = scannerRef.current as {
          isScanning: boolean
          stop: () => Promise<void>
          clear: () => Promise<void>
        }
        if (scanner.isScanning) {
          await scanner.stop()
        }
        await scanner.clear()
      } catch {
        // Ignore stop errors on unmount
      }
      scannerRef.current = null
      setCameraActive(false)
    }
  }, [])

  const startCamera = useCallback(
    async (cameraId?: string) => {
      if (typeof window === 'undefined') return
      await stopCamera()
      setCameraError(null)

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

        // Ensure viewfinder container exists
        const el = document.getElementById(qrRegionId)
        if (!el) return

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ]

        const html5QrCode = new Html5Qrcode(qrRegionId, {
          formatsToSupport,
          verbose: false,
        })
        scannerRef.current = html5QrCode

        // Enumerate video devices
        const cameras = await Html5Qrcode.getCameras()
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras)
          const targetId =
            cameraId ||
            cameras.find((c) => /back|rear|environment/i.test(c.label))?.id ||
            cameras[0].id
          setSelectedCameraId(targetId)

          await html5QrCode.start(
            targetId,
            {
              fps: 15,
              qrbox: { width: 280, height: 160 },
              aspectRatio: 1.5,
            },
            (decodedText) => {
              void lookupBarcode(decodedText)
            },
            () => {
              // Frame without barcode, pass
            }
          )
          setCameraActive(true)
        } else {
          setCameraError('No video camera detected on this machine.')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Camera permission denied or unavailable'
        setCameraError(msg)
        setCameraActive(false)
      }
    },
    [lookupBarcode, stopCamera]
  )

  useEffect(() => {
    if (open && activeTab === 'camera') {
      const timer = setTimeout(() => {
        void startCamera(selectedCameraId || undefined)
      }, 200)
      return () => {
        clearTimeout(timer)
        void stopCamera()
      }
    } else {
      void stopCamera()
    }
  }, [open, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount or dialog close
  const handleClose = () => {
    void stopCamera()
    onOpenChange(false)
  }

  // ─── Manual Add to POS action ────────────────────────────────
  const handleExplicitAddToPos = () => {
    if (!scannedData) return

    const itemToAdd: PosCartLine = {
      ...scannedData.posCartItem,
      quantity: scanQty,
    }

    if (onAddToCart) {
      onAddToCart(itemToAdd)
    } else {
      addPosCartItem(itemToAdd)
    }

    triggerBeep()
    toast.success(
      `Added ${scanQty}x ${scannedData.product.name} to POS Cart`,
      `Total POS Cart: ${posSummary.itemCount + 1} items`
    )
  }

  const handleNavigateToPos = () => {
    handleClose()
    router.push('/pos')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 border-border shadow-2xl">
        <DialogHeader className="border-b bg-gradient-to-r from-card to-muted/40 p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                <Barcode className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight">
                  {mode === 'inventory' ? 'Inventory Barcode Scanner' : 'POS Quick Barcode Scanner'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Scan packaging barcode via Camera or USB Handheld Scanner to dispatch to POS
                </DialogDescription>
              </div>
            </div>

            {/* Audio Feedback Toggle */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Mute scanner sound' : 'Enable scanner beep'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Floating Top Banner: Live POS Cart Status */}
        <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">Active POS Cart:</span>
            <Badge variant="outline" className="h-5 bg-background font-mono text-[11px]">
              {posSummary.itemCount} items ({posSummary.totalUnits} units)
            </Badge>
            <span className="font-semibold text-primary">₹{posSummary.subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none">
              <input
                type="checkbox"
                checked={autoAddToPos}
                onChange={(e) => setAutoAddToPos(e.target.checked)}
                className="rounded border-border accent-primary h-3.5 w-3.5"
              />
              <span className="text-[11px] font-medium">Auto-add to POS</span>
            </label>

            {posSummary.itemCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNavigateToPos}
                className="h-6 gap-1 px-2 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
              >
                <span>Go to POS</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'camera' | 'manual' | 'demo')}
          className="w-full"
        >
          <div className="border-b px-4 bg-muted/20">
            <TabsList className="h-9 bg-transparent p-0 gap-4">
              <TabsTrigger
                value="camera"
                className="gap-1.5 rounded-none border-b-2 border-transparent px-2 pb-2 pt-1 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold"
              >
                <Camera className="h-3.5 w-3.5" />
                Live Camera
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="gap-1.5 rounded-none border-b-2 border-transparent px-2 pb-2 pt-1 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold"
              >
                <Search className="h-3.5 w-3.5" />
                Manual / USB Scanner
              </TabsTrigger>
              <TabsTrigger
                value="demo"
                className="gap-1.5 rounded-none border-b-2 border-transparent px-2 pb-2 pt-1 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Demo Barcodes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── TAB 1: Live Camera ──────────────────────────── */}
          <TabsContent value="camera" className="m-0 p-4">
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-primary/30 bg-black/90 shadow-inner">
                {/* Html5Qrcode viewfinder target */}
                <div
                  id={qrRegionId}
                  className="w-full min-h-[220px] flex items-center justify-center"
                />

                {/* Simulated Laser Guide Overlay when active */}
                {cameraActive && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    {/* Corner Target Markers */}
                    <div className="relative h-32 w-56 rounded-lg border-2 border-dashed border-emerald-400/70">
                      <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-emerald-400" />
                      <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-emerald-400" />
                      <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
                      <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-emerald-400" />

                      {/* Moving Red Scanning Laser Beam */}
                      <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
                    </div>
                    <span className="mt-2 text-[10px] tracking-wide text-emerald-300 font-mono bg-black/60 px-2 py-0.5 rounded">
                      ALIGN BARCODE IN FRAME
                    </span>
                  </div>
                )}

                {/* Error or Permission Warning */}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/95 p-6 text-center">
                    <Camera className="h-10 w-10 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium text-destructive">{cameraError}</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Make sure your browser has granted webcam permissions, or use the USB Scanner / Demo tab.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void startCamera(selectedCameraId || undefined)}
                      className="mt-3 gap-1.5 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry Camera
                    </Button>
                  </div>
                )}
              </div>

              {/* Camera Switcher Controls */}
              {availableCameras.length > 1 && (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Camera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      const newId = e.target.value
                      setSelectedCameraId(newId)
                      void startCamera(newId)
                    }}
                    className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
                  >
                    {availableCameras.map((c) => (
                      <SelectItemOption key={c.id} value={c.id} label={c.label || `Camera ${c.id}`} />
                    ))}
                  </select>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── TAB 2: Manual / USB Scanner ──────────────────── */}
          <TabsContent value="manual" className="m-0 p-4">
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    Hardware USB / Bluetooth Barcode Scanner Ready
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Point your physical handheld barcode gun at any medicine box and squeeze the trigger. It automatically recognizes the barcode burst without needing focus.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualInput.trim()) {
                        void lookupBarcode(manualInput.trim())
                      }
                    }}
                    placeholder="Enter EAN-13 Barcode or SKU (e.g., 8901234567890)…"
                    className="pl-9 text-sm"
                    autoFocus
                  />
                  {manualInput && (
                    <button
                      type="button"
                      onClick={() => setManualInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  disabled={!manualInput.trim() || loading}
                  onClick={() => void lookupBarcode(manualInput.trim())}
                  className="gap-1.5"
                >
                  <Search className="h-4 w-4" />
                  Lookup
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ─── TAB 3: Demo Barcodes ─────────────────────────── */}
          <TabsContent value="demo" className="m-0 p-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Click any sample medicine to simulate an authentic barcode laser scan:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_BARCODES.map((item) => (
                  <button
                    key={item.barcode}
                    type="button"
                    onClick={() => void lookupBarcode(item.barcode)}
                    disabled={loading}
                    className="flex flex-col items-start p-3 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left shadow-sm group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary">
                        {item.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 font-mono">
                        {item.barcode}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{item.type}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Scanned Product Details Card ────────────────────── */}
        {scannedData && (
          <div className="border-t bg-card/60 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-sm text-foreground">
                    {scannedData.product.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {scannedData.product.sku}
                  </Badge>
                  {(scannedData as any).gs1Data && (
                    <Badge className="bg-blue-600 text-white text-[9px] gap-1">
                      <Zap className="h-2.5 w-2.5" /> GS1 2D DataMatrix (SFDA/NHRA Traceable)
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {scannedData.product.barcode && (
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      Barcode: {scannedData.product.barcode}
                    </span>
                  )}
                  {scannedData.product.rack && (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                      <MapPin className="h-3 w-3" />
                      Rack: {formatRack(scannedData.product.rack)}
                    </span>
                  )}
                  <span>· MRP: ₹{scannedData.product.mrp.toFixed(2)}</span>
                  <span>· UOM: {scannedData.product.unitOfMeasure}</span>
                </div>

                {/* Batch and stock indicator */}
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <Package className="h-3.5 w-3.5" />
                    {scannedData.inventory
                      ? `${scannedData.inventory.availableQuantity} in stock`
                      : 'Stock record linked'}
                  </span>
                  {scannedData.fefoBatch && (
                    <Badge variant="secondary" className="gap-1 text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <Flame className="h-3 w-3" />
                      FEFO: {scannedData.fefoBatch.batchNumber}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                {/* Quantity adjuster */}
                <div className="flex items-center rounded-lg border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setScanQty(Math.max(1, scanQty - 1))}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    -
                  </button>
                  <span className="px-2 text-xs font-semibold">{scanQty}</span>
                  <button
                    type="button"
                    onClick={() => setScanQty(scanQty + 1)}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    +
                  </button>
                </div>

                <Button
                  size="sm"
                  onClick={handleExplicitAddToPos}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add to POS</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer with summary and quick links */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {lastScannedCode && (
              <span>Last Scanned: <span className="font-semibold text-foreground">{lastScannedCode}</span></span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 text-xs">
              Close
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleNavigateToPos}
              className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Checkout in POS ({posSummary.itemCount})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SelectItemOption({ value, label }: { value: string; label: string }) {
  return <option value={value}>{label}</option>
}
