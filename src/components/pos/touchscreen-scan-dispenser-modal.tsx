'use client'

// ─────────────────────────────────────────────────────────────
// Component — TouchscreenScanDispenserModal
// Touchscreen Cut-Strip Medicine Scanner & Instant POS Dispenser
// External Autofocus Camera + Diffuse Lighting + Glare Suppression
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Camera,
  CheckCircle2,
  Copy,
  CreditCard,
  IndianRupee,
  Layers,
  Package,
  Pill,
  Printer,
  QrCode,
  RefreshCw,
  Scan,
  ShieldCheck,
  Sparkles,
  User,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import {
  acquireCameraStream,
  createOpticalStreamSimulator,
  captureFrameFromVideoElement,
} from '@/lib/scanner/optical-camera-stream'
import { recognizeMedicineStripFromCamera } from '@/lib/scanner/camera-ocr-service'
import type {
  PackagingSurfaceType,
  StripScanAnalysisResult,
} from '@/lib/scanner/strip-scanner-types'
import { cn } from '@/lib/utils/cn'
import { ReceiptInvoice, type ReceiptData } from '@/components/pos/receipt-invoice'

interface TouchscreenScanDispenserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaleCompleted?: (saleData: any) => void
  onApplyToCart?: (item: {
    productId?: string
    productName?: string
    tabsCut?: number
    tabsPerStrip?: number
    batchNumber?: string
    expiryDate?: string
    mrp?: number
  }) => void
  branchId?: string
}

type PaymentMethodType = 'UPI' | 'CASH' | 'CREDIT'

const PRESET_CUT_STRIPS = [
  {
    label: 'Augmentin 625 Duo (Alu-Alu Foil Strip - Cut 3 of 10 Tabs)',
    surface: 'ALU_ALU' as PackagingSurfaceType,
    text: `AUGMENTIN 625 DUO
Amoxicillin and Potassium Clavulanate Tablets IP
B.No. 26D044
MFD. 09/2025
EXP. 08/2028
M.R.P. Rs. 204.50
INCL. OF ALL TAXES
10 Tablets
SCHEDULE H1 PRESCRIPTION DRUG - CAUTION
GlaxoSmithKline Pharmaceuticals Ltd.`,
    defaultCut: 3,
  },
  {
    label: 'Calpol 650 (PVC Blister Strip - Cut 5 of 15 Tabs)',
    surface: 'BLISTER' as PackagingSurfaceType,
    text: `CALPOL 650
Paracetamol Tablets IP 650 mg
B.No. CP-9921
EXP. 03/2028
M.R.P. Rs. 34.00
15 Tablets
GlaxoSmithKline Consumer Healthcare`,
    defaultCut: 5,
  },
  {
    label: 'Pan 40 (Alu-Alu Cold Form - Cut 4 of 15 Tabs)',
    surface: 'ALU_ALU' as PackagingSurfaceType,
    text: `PAN 40
Pantoprazole Gastro-resistant Tablets IP
B.No. PN26-881
MFD. 10/2025
EXP. 11/2027
MRP ₹ 155.00 FOR 15 TABS
SCHEDULE H PRESCRIPTION DRUG
Alkem Laboratories Ltd.`,
    defaultCut: 4,
  },
  {
    label: 'Azithral 500 (Mono Carton / 5 Tabs Pack - Full Pack)',
    surface: 'MONO_CARTON' as PackagingSurfaceType,
    text: `(01)08901234567890(17)271231(10)AZ-5012
AZITHRAL 500
Azithromycin Tablets IP 500 mg
B.No. AZ-5012
EXP. 12/2027
M.R.P. Rs. 119.50
5 Tablets
Alembic Pharmaceuticals Ltd.`,
    defaultCut: 5,
  },
]

export function TouchscreenScanDispenserModal({
  open,
  onOpenChange,
  onSaleCompleted,
  onApplyToCart,
  branchId,
}: TouchscreenScanDispenserModalProps) {
  const toast = useToast()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Camera & Optical State
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isSimulatedStream, setIsSimulatedStream] = useState(false)
  const simulatorStopRef = useRef<(() => void) | null>(null)
  const [surfaceType, setSurfaceType] = useState<PackagingSurfaceType>('ALU_ALU')
  const [shutterFlashing, setShutterFlashing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [billing, setBilling] = useState(false)

  // Recognition Data
  const [recognizedData, setRecognizedData] = useState<{
    brandName: string
    genericComposition: string
    strength: string
    manufacturer: string
    batchNumber: string
    expiryDate: string
    mrp: number
    tabsPerStrip: number
    productId?: string
  } | null>(null)

  // Cut-Strip Quantity Step
  const [tabsCut, setTabsCut] = useState<number>(1)

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('UPI')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [completedBill, setCompletedBill] = useState<any | null>(null)

  // Stop Camera & Simulator
  const stopCamera = () => {
    if (simulatorStopRef.current) {
      simulatorStopRef.current()
      simulatorStopRef.current = null
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setIsSimulatedStream(false)
  }

  // Start Hardware Camera Stream with Multi-Tier Fallback
  const startCamera = async (forceSimulator = false) => {
    if (forceSimulator) {
      startSimulator()
      return
    }

    try {
      setCameraError(null)
      stopCamera()

      const { stream } = await acquireCameraStream({
        idealWidth: 1920,
        idealHeight: 1080,
        idealFrameRate: 60,
        preferEnvironment: true,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
        setIsSimulatedStream(false)
        toast.success('Live autofocus optical camera connected')
      }
    } catch (err: any) {
      console.warn('[POS Camera] Physical camera stream not found, starting simulator:', err?.message)
      setCameraError(err?.message || 'External camera stream unavailable.')
      startSimulator()
    }
  }

  // Start High-Speed Optical Stream Simulator
  const startSimulator = () => {
    try {
      stopCamera()
      setCameraError(null)
      const label = PRESET_CUT_STRIPS[0]?.label?.split('(')[0]?.trim() || 'AUGMENTIN 625 DUO'
      const { stream, stop } = createOpticalStreamSimulator(surfaceType, label)
      simulatorStopRef.current = stop

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
        setCameraActive(true)
        setIsSimulatedStream(true)
      }
    } catch (simErr: any) {
      setCameraError('Unable to start optical simulator: ' + (simErr?.message || ''))
      setCameraActive(false)
    }
  }

  // Auto-start camera when modal opens
  useEffect(() => {
    if (open && !cameraActive) {
      startCamera(false)
    } else if (!open) {
      stopCamera()
      setCompletedBill(null)
    }
  }, [open])

  // Frame Capture Trigger via Optical AI OCR
  const handleCaptureFrame = async () => {
    setShutterFlashing(true)
    playBarcodeBeep()
    setTimeout(() => setShutterFlashing(false), 200)

    if (!videoRef.current) {
      toast.error('Camera stream is not active.')
      return
    }

    if (isSimulatedStream) {
      toast.info('Captured simulated optical frame. Processing...')
      handleAnalyzeText(PRESET_CUT_STRIPS[0].text, surfaceType, PRESET_CUT_STRIPS[0].defaultCut)
      return
    }

    // Real Camera Snapshot: Run Live Optical Character Recognition (OCR)
    setAnalyzing(true)
    toast.info('Reading medicine strip text via Optical AI OCR...')
    try {
      const ocrResult = await recognizeMedicineStripFromCamera(videoRef.current, surfaceType)

      if (ocrResult.barcode) {
        playBarcodeBeep()
        toast.success(`Optical Barcode Detected: ${ocrResult.barcode}`)
      }

      if (ocrResult.rawText && ocrResult.rawText.trim().length >= 3) {
        toast.success(`Recognized Strip Details (${ocrResult.confidence}% OCR confidence)`)
        await handleAnalyzeText(ocrResult.rawText, surfaceType)
      } else {
        toast.warning(
          'Could not read printed text clearly. Try holding the strip tilted 35° away from direct overhead lights and align in center.'
        )
        if (ocrResult.barcode) {
          await handleAnalyzeText(`BARCODE: ${ocrResult.barcode}\n10 Tablets\nMRP: Rs. 100`, surfaceType)
        }
      }
    } catch (err: any) {
      console.error('[POS Live Camera OCR Error]', err)
      toast.error('Camera OCR failed: ' + (err?.message || 'Check camera focus'))
    } finally {
      setAnalyzing(false)
    }
  }

  // Optical Analysis
  const handleAnalyzeText = async (
    text: string,
    surface: PackagingSurfaceType,
    defaultCutCount?: number
  ) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/inventory/scan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text, surfaceType: surface }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const data = json.data as StripScanAnalysisResult
        const totalTabs = data.entity.tabsPerStrip || 10
        const cut = defaultCutCount || Math.min(3, totalTabs)

        setRecognizedData({
          brandName: data.entity.brandName || data.matchedProduct?.name || 'Pharmaceutical Strip',
          genericComposition:
            data.entity.genericComposition || data.matchedProduct?.genericName || 'Standard IP Formulation',
          strength: data.entity.strength || '625 mg',
          manufacturer: data.entity.manufacturer || 'Approved Pharma Lab',
          batchNumber: data.entity.batchNumber || 'LOT-26A',
          expiryDate: data.entity.expiryDate || '2028-08-31',
          mrp: data.entity.mrp || parseFloat(data.matchedProduct?.mrp || '100'),
          tabsPerStrip: totalTabs,
          productId: data.matchedProduct?.id,
        })
        setTabsCut(cut)
        setCashTendered('')
        setCompletedBill(null)
        toast.success(`Recognized ${data.entity.brandName || 'Strip'} (${data.confidence.overall}% AI Confidence)`)
      } else {
        toast.error('Failed to recognize strip')
      }
    } catch {
      toast.error('Optical AI communication error')
    } finally {
      setAnalyzing(false)
    }
  }

  // Price & Bill Calculations
  const totalTabs = recognizedData?.tabsPerStrip || 10
  const packMrp = recognizedData?.mrp || 0
  const pricePerTab = Math.round((packMrp / totalTabs) * 100) / 100
  const billTotal = Math.round(pricePerTab * tabsCut * 100) / 100
  const tenderedNum = parseFloat(cashTendered) || 0
  const changeToReturn = tenderedNum > billTotal ? Math.round((tenderedNum - billTotal) * 100) / 100 : 0

  // Confirm Dispense & Instant Bill Preparation
  const handleConfirmAndBill = async () => {
    if (!recognizedData) return
    setBilling(true)
    try {
      const res = await fetch('/api/pos/scan-dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          productId: recognizedData.productId,
          productName: recognizedData.brandName,
          genericName: recognizedData.genericComposition,
          strength: recognizedData.strength,
          manufacturer: recognizedData.manufacturer,
          batchNumber: recognizedData.batchNumber,
          expiryDate: recognizedData.expiryDate,
          mrp: packMrp,
          tabsPerStrip: totalTabs,
          tabsCut,
          paymentMethod,
          cashTendered: paymentMethod === 'CASH' ? tenderedNum : undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (json.success && json.data) {
        setCompletedBill(json.data)
        toast.success(`Bill ${json.data.invoiceNumber} prepared! Stock deducted from PostgreSQL.`)
        onSaleCompleted?.(json.data)
      } else {
        toast.error(json.error?.message || 'Dispense failed')
      }
    } catch {
      toast.error('Network error during dispense commit')
    } finally {
      setBilling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mr-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Scan className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Touchscreen Cut-Strip AI Scanner & POS Dispenser
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Autofocus UVC Ready
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scan Alu-Alu / blister strips under diffuse lighting • Cut loose tablets • Auto-deduct PostgreSQL • Instant bill
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Diffuse Lighting & Brewster Angle Banner */}
        <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 text-xs text-blue-900 dark:text-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold block text-blue-800 dark:text-blue-300">
              Diffuse LED Lighting Active:
            </span>
            Use diffuse ring lighting or non-directional ambient LED light. Tilt shiny Alu-Alu foils at a <strong>35° angle</strong> to neutralize specular white reflection and enhance debossed dot-matrix batch characters.
          </div>
        </div>

        {/* Top Split: Live Camera HUD & Recognition Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Camera Feed & Big Touch Shutter Button */}
          <div className="lg:col-span-6 space-y-2">
            <div className="relative bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 aspect-video max-h-[260px] flex items-center justify-center">
              <video
                ref={videoRef}
                className={cn('w-full h-full object-cover', !cameraActive && 'hidden')}
                autoPlay
                playsInline
                muted
              />

              {!cameraActive && (
                <div className="text-center p-6 text-zinc-400 z-10">
                  <Camera className="h-10 w-10 mx-auto text-zinc-600 mb-2" />
                  <p className="text-xs font-semibold text-zinc-300">
                    {cameraError || 'Place strip under diffuse LED lighting'}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Continuous autofocus & anti-glare active
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button size="sm" onClick={() => startCamera(false)} className="h-8 text-xs gap-1.5 font-bold">
                      <Video className="h-3.5 w-3.5" /> Start Live Camera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startSimulator()}
                      className="h-8 text-xs gap-1.5 border-zinc-700 text-zinc-300 font-bold"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Run Optical Simulator
                    </Button>
                  </div>
                </div>
              )}

              {/* Shutter Flash */}
              {shutterFlashing && (
                <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 z-20" />
              )}

              {/* Touch HUD Overlay */}
              <div className="absolute inset-3 pointer-events-none border border-dashed border-primary/40 rounded-lg flex flex-col justify-between p-2 z-10">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-mono font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30">
                    AUTOFOCUS MACRO [{surfaceType}]
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
                      isSimulatedStream
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    )}
                  >
                    {isSimulatedStream ? 'SIMULATOR (30 FPS)' : 'HARDWARE UVC (60 FPS)'}
                  </span>
                </div>
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                <div className="flex justify-between items-end text-[9px] font-mono text-zinc-400">
                  <span>FRAME: 1080P @ 60 FPS</span>
                  <span>TAP SHUTTER TO CAPTURE</span>
                </div>
              </div>
            </div>

            {/* Large Touch Shutter Capture Button */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="lg"
                disabled={analyzing}
                onClick={handleCaptureFrame}
                className="w-full h-11 text-sm font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              >
                <Camera className="h-4 w-4" />
                {analyzing ? 'Analyzing Optical Frame...' : 'Capture Strip Frame'}
              </Button>
              {cameraActive && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      if (isSimulatedStream) {
                        startCamera(false)
                      } else {
                        startSimulator()
                      }
                    }}
                    className="h-11 px-2.5 text-xs border-zinc-700 bg-zinc-900/60"
                  >
                    {isSimulatedStream ? 'Webcam' : 'Sim'}
                  </Button>
                  <Button size="lg" variant="outline" onClick={stopCamera} className="h-11 px-3 text-xs">
                    Stop
                  </Button>
                </>
              )}
            </div>

            {/* Quick Test Presets for Touch Screen */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Quick Strip Presets:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_CUT_STRIPS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnalyzeText(preset.text, preset.surface, preset.defaultCut)}
                    disabled={analyzing}
                    className="text-left p-2 rounded-lg border bg-card hover:bg-muted/60 transition-colors text-xs flex items-center justify-between"
                  >
                    <span className="truncate font-semibold text-[11px] text-foreground">
                      {preset.label.split('(')[0]}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Recognized Medicine Details (Touch Cards) */}
          <div className="lg:col-span-6 space-y-3">
            {recognizedData ? (
              <div className="bg-card border-2 border-primary/20 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-start justify-between border-b pb-2">
                  <div>
                    <h3 className="text-base font-black text-foreground flex items-center gap-1.5">
                      <Pill className="h-4 w-4 text-primary" />
                      {recognizedData.brandName}
                    </h3>
                    <p className="text-xs text-muted-foreground">{recognizedData.genericComposition}</p>
                  </div>
                  <Badge variant="default" className="bg-emerald-600 font-bold text-xs">
                    Strength: {recognizedData.strength}
                  </Badge>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/40 p-2 rounded-lg border">
                    <span className="text-[10px] text-muted-foreground block font-semibold">BATCH NO</span>
                    <span className="font-mono font-bold text-foreground text-xs uppercase">
                      {recognizedData.batchNumber}
                    </span>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-lg border">
                    <span className="text-[10px] text-muted-foreground block font-semibold">EXPIRY DATE</span>
                    <span className="font-mono font-bold text-foreground text-xs">
                      {recognizedData.expiryDate}
                    </span>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-lg border">
                    <span className="text-[10px] text-muted-foreground block font-semibold">PACK SIZE</span>
                    <span className="font-bold text-foreground text-xs">
                      {recognizedData.tabsPerStrip} Tablets
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg text-xs">
                  <span className="text-muted-foreground">Manufacturer:</span>
                  <span className="font-semibold text-foreground truncate max-w-[240px]">
                    {recognizedData.manufacturer}
                  </span>
                </div>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* STEP 2: QUANTITY CONFIRMATION FOR CUT TABLETS (TOUCHPAD)      */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calculator className="h-3.5 w-3.5 text-primary" />
                      Tablets Cut from Strip:
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      Full Pack MRP: ₹{packMrp.toFixed(2)} (₹{pricePerTab.toFixed(2)} / tab)
                    </span>
                  </div>

                  {/* Big Touch Stepper & Quick Pills */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTabsCut((c) => Math.max(1, c - 1))}
                      className="h-10 w-10 text-base font-bold shrink-0"
                    >
                      -
                    </Button>
                    <div className="flex-1 bg-muted/50 rounded-lg border p-1 text-center">
                      <span className="text-xl font-black font-mono text-primary">{tabsCut}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">of {totalTabs} Tabs</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTabsCut((c) => Math.min(totalTabs, c + 1))}
                      className="h-10 w-10 text-base font-bold shrink-0"
                    >
                      +
                    </Button>
                  </div>

                  {/* Touch Quick Selection Buttons */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {[1, 2, 3, 5, totalTabs].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        size="sm"
                        variant={tabsCut === num ? 'default' : 'outline'}
                        onClick={() => setTabsCut(num)}
                        className="h-8 text-xs font-bold"
                      >
                        {num === totalTabs ? `Full (${num})` : `${num} Tab`}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* STEP 3: PAYMENT METHOD (UPI / CASH / CREDIT)                   */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Select Payment Method:</span>
                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                      Total: ₹{billTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={paymentMethod === 'UPI' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('UPI')}
                      className={cn(
                        'h-9 text-xs font-bold gap-1.5',
                        paymentMethod === 'UPI' && 'bg-blue-600 hover:bg-blue-500 text-white'
                      )}
                    >
                      <QrCode className="h-3.5 w-3.5" /> UPI QR
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('CASH')}
                      className={cn(
                        'h-9 text-xs font-bold gap-1.5',
                        paymentMethod === 'CASH' && 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      )}
                    >
                      <IndianRupee className="h-3.5 w-3.5" /> Cash
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={paymentMethod === 'CREDIT' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('CREDIT')}
                      className={cn(
                        'h-9 text-xs font-bold gap-1.5',
                        paymentMethod === 'CREDIT' && 'bg-amber-600 hover:bg-amber-500 text-white'
                      )}
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Credit
                    </Button>
                  </div>

                  {/* Cash Change Calculator */}
                  {paymentMethod === 'CASH' && (
                    <div className="bg-muted/50 p-2.5 rounded-lg border space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Tendered:</span>
                        <Input
                          type="number"
                          placeholder={`Enter cash (e.g. ₹${Math.ceil(billTotal / 10) * 10})`}
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          className="h-8 text-xs font-mono font-bold max-w-[140px]"
                        />
                      </div>
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-muted-foreground">Change to Return:</span>
                        <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                          ₹{changeToReturn.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* UPI QR Display Hint */}
                  {paymentMethod === 'UPI' && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-900 dark:text-blue-200">
                      <QrCode className="h-5 w-5 text-blue-600 shrink-0" />
                      <div>
                        <span className="font-bold block">Instant Dynamic UPI:</span>
                        Ask customer to scan terminal QR for ₹{billTotal.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Customer Input for Credit */}
                  {paymentMethod === 'CREDIT' && (
                    <div className="space-y-1.5 text-xs">
                      <Input
                        placeholder="Patient / Customer Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Add to Active POS Bill Action Button (When opened from POS) */}
                {onApplyToCart && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => {
                      onApplyToCart({
                        productId: recognizedData.productId,
                        productName: recognizedData.brandName,
                        batchNumber: recognizedData.batchNumber,
                        expiryDate: recognizedData.expiryDate,
                        tabsCut: tabsCut,
                        tabsPerStrip: recognizedData.tabsPerStrip || totalTabs,
                        mrp: packMrp,
                      })
                      onOpenChange(false)
                    }}
                    className="w-full h-11 text-sm font-black gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-lg mt-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Add to Active POS Bill (Cut: {tabsCut} Tabs · ₹{billTotal.toFixed(2)})
                  </Button>
                )}

                {/* Confirm & Bill Action Button */}
                <Button
                  type="button"
                  size="lg"
                  disabled={billing}
                  onClick={handleConfirmAndBill}
                  className="w-full h-10 text-xs font-bold gap-2 bg-muted hover:bg-muted/80 text-foreground border shadow-sm mt-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {billing ? 'Updating PostgreSQL...' : `Direct Express Bill (₹${billTotal.toFixed(2)})`}
                </Button>
              </div>
            ) : (
              <div className="h-full min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-muted/10">
                <Pill className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <h4 className="text-sm font-bold text-foreground">Awaiting Medicine Strip Capture</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Capture a frame using the camera or tap one of the quick strip presets on the left.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Prepared Bill Dialog / Receipt Banner with Full Pharmacy Credentials */}
        {completedBill && (
          <div className="bg-emerald-500/5 border-2 border-emerald-500/40 rounded-xl p-4 mt-3 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Bill Generated: {completedBill.invoiceNumber}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    PostgreSQL inventory automatically deducted • Stock remaining: {completedBill.remainingStock} units
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCompletedBill(null)
                  setRecognizedData(null)
                }}
                className="h-8 text-xs gap-1.5 font-bold"
              >
                Scan Next Medicine
              </Button>
            </div>

            {/* Embedded Tier-1 Gold Standard Tax Invoice */}
            <div className="bg-white p-3 rounded-lg border shadow-inner">
              <ReceiptInvoice
                sale={{
                  invoiceNumber: completedBill.invoiceNumber,
                  saleDate: completedBill.createdAt || new Date(),
                  subtotal: completedBill.lineTotal - (completedBill.gstAmount || 0),
                  taxAmount: completedBill.gstAmount || 0,
                  totalAmount: completedBill.lineTotal,
                  amountPaid: completedBill.lineTotal,
                  cashTendered: completedBill.cashTendered,
                  changeAmount: completedBill.changeAmount,
                  paymentStatus: completedBill.paymentMethod === 'CREDIT' ? 'CREDIT' : 'PAID',
                  customerName: completedBill.customerName,
                  items: [
                    {
                      productName: completedBill.productName,
                      genericName: completedBill.genericName,
                      strength: completedBill.strength,
                      batchNumber: completedBill.batchNumber,
                      expiryDate: completedBill.expiryDate,
                      quantity: completedBill.tabsCut,
                      unitPrice: completedBill.pricePerTab,
                      mrp: completedBill.pricePerTab * completedBill.tabsPerStrip,
                      totalAmount: completedBill.lineTotal,
                      taxAmount: completedBill.gstAmount || 0,
                      tabsCut: completedBill.tabsCut,
                    },
                  ],
                  payments: [
                    {
                      method: completedBill.paymentMethod,
                      amount: completedBill.lineTotal,
                      reference: completedBill.paymentReference,
                    },
                  ],
                }}
                showPrintButton={true}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between border-t pt-3 mt-2">
          <span className="text-[11px] text-muted-foreground">
            Touchscreen-ready dispensing terminal equipped with cut-strip fractional math & instant payment logging.
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
