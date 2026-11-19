'use client'

import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  Maximize2,
  Minus,
  Package,
  Pill,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  UploadCloud,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/lib/hooks/use-toast'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { formatCurrency } from '@/lib/utils/currency'
import {
  analyzeStripImageFrame,
  DEMO_STRIP_SAMPLES,
  type DemoStripSample,
  type DetectedCavity,
  type StripAnalysisResult,
} from '@/lib/vision/strip-counter-engine'
import type { PosBatchItem, PosProductRow } from './pos2-client'

interface AiStripCounterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: PosProductRow[]
  onAddToCart: (
    product: PosProductRow,
    batch?: PosBatchItem,
    quantity?: number,
    discountPercent?: number,
    freeQty?: number
  ) => void
}

export function AiStripCounterModal({
  open,
  onOpenChange,
  products,
  onAddToCart,
}: AiStripCounterModalProps) {
  const toast = useToast()
  const instanceId = useId()
  const sessionId = useMemo(
    () => `pos-vision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    []
  )

  // Modes
  const [activeTab, setActiveTab] = useState<'mobile' | 'webcam' | 'samples' | 'upload'>('mobile')

  // Mobile pairing state
  const [mobileUrl, setMobileUrl] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [phoneConnected, setPhoneConnected] = useState(false)
  const [phoneDeviceName, setPhoneDeviceName] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Camera / Webcam State
  const videoRef = useRef<HTMLVideoElement>(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')

  // Strip Analysis State
  const [selectedSample, setSelectedSample] = useState<DemoStripSample>(DEMO_STRIP_SAMPLES[0])
  const [activeAnalysis, setActiveAnalysis] = useState<StripAnalysisResult>({
    totalCapacity: DEMO_STRIP_SAMPLES[0].totalCapacity,
    cutCount: DEMO_STRIP_SAMPLES[0].cutCount,
    filledCount: DEMO_STRIP_SAMPLES[0].filledCount,
    confidence: 0.98,
    gridRows: DEMO_STRIP_SAMPLES[0].gridRows,
    gridCols: DEMO_STRIP_SAMPLES[0].gridCols,
    suggestedPackSize: DEMO_STRIP_SAMPLES[0].totalCapacity,
    cavities: DEMO_STRIP_SAMPLES[0].cavities,
    summary: DEMO_STRIP_SAMPLES[0].description,
    processedAt: new Date().toISOString(),
  })
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null)
  const [userToggledCavities, setUserToggledCavities] = useState<Record<number, 'FILLED' | 'CUT'>>({})
  const [dispenseMode, setDispenseMode] = useState<'CUT' | 'REMAINING'>('CUT')
  const lastSessionUpdatedAtRef = useRef<number>(0)

  // Target Inventory Product
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<PosProductRow | null>(() => {
    return (
      products.find(
        (p) =>
          p.name.toLowerCase().includes('dolo') ||
          p.name.toLowerCase().includes('paracetamol') ||
          p.unitOfMeasure.toLowerCase().includes('strip')
      ) || products[0] || null
    )
  })

  // Pack size extraction helper (e.g. "10 Tablets" -> 10)
  const packCapacity = useMemo(() => {
    if (selectedProduct?.packSize) {
      const match = selectedProduct.packSize.match(/\d+/)
      if (match) return parseInt(match[0], 10)
    }
    return activeAnalysis.totalCapacity || 10
  }, [selectedProduct, activeAnalysis.totalCapacity])

  // Compute live cavities taking user overrides into account
  const currentCavities = useMemo(() => {
    return activeAnalysis.cavities.map((c) => {
      const override = userToggledCavities[c.id]
      if (override) {
        return {
          ...c,
          state: override,
          label: override === 'CUT' ? `Cut #${c.id}` : `Pill #${c.id}`,
        }
      }
      return c
    })
  }, [activeAnalysis.cavities, userToggledCavities])

  const currentCutCount = useMemo(
    () => currentCavities.filter((c) => c.state === 'CUT').length,
    [currentCavities]
  )
  const currentFilledCount = useMemo(
    () => currentCavities.filter((c) => c.state === 'FILLED').length,
    [currentCavities]
  )

  // ─── Fetch session & poll for incoming frames from mobile phone ───
  useEffect(() => {
    if (!open) return

    let isMounted = true
    const checkBridge = async () => {
      try {
        const res = await fetch(`/api/pos2/strip-camera-bridge?sessionId=${sessionId}`)
        if (!res.ok) return
        const data = await res.json()
        if (!isMounted) return

        if (data.mobileUrl && !mobileUrl) setMobileUrl(data.mobileUrl)
        if (data.qrCodeDataUrl && !qrCodeDataUrl) setQrCodeDataUrl(data.qrCodeDataUrl)

        if (data.session) {
          if (data.session.phoneConnected !== phoneConnected) {
            setPhoneConnected(Boolean(data.session.phoneConnected))
            setPhoneDeviceName(data.session.phoneDeviceName || null)
          }

          // If phone transmitted a new frame or new analysis
          const isNewUpdate = Boolean(data.session.updatedAt && data.session.updatedAt > lastSessionUpdatedAtRef.current)
          const isNewFrame = Boolean(data.session.latestFrame && data.session.latestFrame !== activeImageSrc)

          if (isNewUpdate || isNewFrame) {
            lastSessionUpdatedAtRef.current = data.session.updatedAt || Date.now()
            if (data.session.latestFrame) {
              setActiveImageSrc(data.session.latestFrame)
            }
            if (data.session.analysisResult) {
              setActiveAnalysis(data.session.analysisResult)
              setUserToggledCavities({})
              playBarcodeBeep()
              toast.success(
                '📱 Strip Received from Phone!',
                `${data.session.analysisResult.cutCount} Cut | ${data.session.analysisResult.filledCount} Remaining`
              )
            }
          }
        }
      } catch (err) {
        console.warn('Bridge poll error:', err)
      }
    }

    void checkBridge()
    const timer = setInterval(() => void checkBridge(), 2000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [open, sessionId, mobileUrl, qrCodeDataUrl, phoneConnected, activeImageSrc, toast])

  // ─── Local Webcam Management ───────────────────────────────────
  const startWebcam = useCallback(
    async (deviceId?: string) => {
      setWebcamError(null)
      try {
        if (videoRef.current?.srcObject) {
          const s = videoRef.current.srcObject as MediaStream
          s.getTracks().forEach((t) => t.stop())
        }

        const devList = await navigator.mediaDevices.enumerateDevices()
        const videoDevs = devList.filter((d) => d.kind === 'videoinput')
        setCameras(videoDevs)

        const chosen = deviceId || videoDevs[0]?.deviceId

        const stream = await navigator.mediaDevices.getUserMedia({
          video: chosen
            ? { deviceId: { exact: chosen }, width: { ideal: 1280 } }
            : { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setWebcamActive(true)
        }
      } catch (err) {
        console.error('Webcam start failed:', err)
        setWebcamError('Could not start local webcam. Make sure permissions are granted.')
        setWebcamActive(false)
      }
    },
    []
  )

  useEffect(() => {
    if (open && activeTab === 'webcam') {
      void startWebcam(selectedCameraId)
    } else {
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream
        s.getTracks().forEach((t) => t.stop())
      }
      setWebcamActive(false)
    }
  }, [open, activeTab, selectedCameraId, startWebcam])

  // Capture from local webcam
  const handleCaptureWebcam = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setActiveImageSrc(dataUrl)

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const analysis = analyzeStripImageFrame(imgData, { expectedCapacity: packCapacity })
      setActiveAnalysis(analysis)
      setUserToggledCavities({})
      playBarcodeBeep()
      toast.success(
        'Strip Analyzed',
        `Detected ${analysis.cutCount} cut cavities and ${analysis.filledCount} intact tablets.`
      )
    }
  }

  // Toggle state of an individual cavity (Cashier override for reflection/glare)
  const handleToggleCavity = (id: number) => {
    const current =
      userToggledCavities[id] || activeAnalysis.cavities.find((c) => c.id === id)?.state || 'FILLED'
    const nextState = current === 'FILLED' ? 'CUT' : 'FILLED'
    setUserToggledCavities((prev) => ({ ...prev, [id]: nextState }))
  }

  // Quick select a demo sample strip
  const handleSelectSample = (sample: DemoStripSample) => {
    setSelectedSample(sample)
    setActiveImageSrc(null)
    setUserToggledCavities({})
    setActiveAnalysis({
      totalCapacity: sample.totalCapacity,
      cutCount: sample.cutCount,
      filledCount: sample.filledCount,
      confidence: 0.99,
      gridRows: sample.gridRows,
      gridCols: sample.gridCols,
      suggestedPackSize: sample.totalCapacity,
      cavities: sample.cavities,
      summary: sample.description,
      processedAt: new Date().toISOString(),
    })

    // Try to auto-match product from inventory
    const matched = products.find((p) =>
      p.name.toLowerCase().includes(sample.name.split(' ')[0].toLowerCase())
    )
    if (matched) {
      setSelectedProduct(matched)
    }
    playBarcodeBeep()
  }

  // File upload handler with real computer vision
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (!dataUrl) return
      setActiveImageSrc(dataUrl)

      const img = new window.Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 640
        canvas.height = img.naturalHeight || 360
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const analysis = analyzeStripImageFrame(imgData, {
            expectedCapacity: packCapacity,
            mode: dispenseMode === 'CUT' ? 'cut' : 'remaining',
          })
          setActiveAnalysis(analysis)
          setUserToggledCavities({})
          playBarcodeBeep()
          toast.success(
            'Image Analyzed',
            `Detected ${analysis.cutCount} cut cavities and ${analysis.filledCount} intact tablets.`
          )

          // Sync with session bridge
          try {
            await fetch('/api/pos2/strip-camera-bridge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                action: 'upload',
                frame: dataUrl,
                deviceName: 'Desktop File Upload',
                options: { expectedCapacity: packCapacity },
                analysis,
              }),
            })
          } catch (uploadErr) {
            console.warn('Upload sync warning:', uploadErr)
          }
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  // Copy mobile link to clipboard
  const handleCopyLink = () => {
    if (!mobileUrl) return
    navigator.clipboard.writeText(mobileUrl)
    setCopiedLink(true)
    toast.success('Link Copied!', 'Open this link on your mobile phone to connect camera')
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // ─── Add to Cart Handler (Marg/Tally Style) ─────────────────────
  const handleDispenseAction = (actionType: 'CUT' | 'REMAINING' | 'FULL') => {
    if (!selectedProduct) {
      toast.error('No Product Selected', 'Please choose a medicine from inventory.')
      return
    }

    const activeBatch = (selectedProduct.batches || []).find((b) => b.availableQuantity > 0)
    const stripCapacity = packCapacity || 10
    const stripMrp = activeBatch?.mrp || selectedProduct.mrp

    let dispenseQty = 1
    if (actionType === 'CUT') {
      dispenseQty = currentCutCount > 0 ? currentCutCount : 1
    } else if (actionType === 'REMAINING') {
      dispenseQty = currentFilledCount > 0 ? currentFilledCount : 1
    } else {
      dispenseQty = stripCapacity
    }

    // Call POS 2 Cart addition
    onAddToCart(selectedProduct, activeBatch, dispenseQty, 0, 0)
    playBarcodeBeep()

    toast.success(
      `Added ${dispenseQty} Loose Tablets`,
      `${selectedProduct.name} (₹${((stripMrp / stripCapacity) * dispenseQty).toFixed(2)})`
    )

    onOpenChange(false)
  }

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 15)
    const q = productSearch.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.genericName?.toLowerCase().includes(q))
      .slice(0, 15)
  }, [products, productSearch])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden border-border/80 bg-card shadow-2xl dark:bg-slate-950 sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-md shadow-teal-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                PharmaVision™ AI Strip Counter
                <Badge
                  variant="outline"
                  className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30 text-[10px] font-mono px-2 py-0.5"
                >
                  Computer Vision Engine
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Point camera at cut blister strip to instantly count dispensed vs remaining tablets
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs font-medium ${
                phoneConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 mr-1" />
              {phoneConnected
                ? `Phone Paired (${phoneDeviceName || 'Active'})`
                : 'Mobile Standby'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Column (8 cols): Camera / Viewfinder / Strip Canvas */}
          <div className="lg:col-span-7 p-6 border-b lg:border-b-0 lg:border-r border-border/60 flex flex-col gap-4">
            {/* Input Mode Selector */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'mobile' | 'webcam' | 'samples' | 'upload')}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 h-9 p-1 bg-muted/60">
                <TabsTrigger value="mobile" className="text-xs gap-1.5 font-medium">
                  <Smartphone className="h-3.5 w-3.5 text-teal-500" /> Phone Cam
                </TabsTrigger>
                <TabsTrigger value="webcam" className="text-xs gap-1.5 font-medium">
                  <Camera className="h-3.5 w-3.5" /> USB / Web
                </TabsTrigger>
                <TabsTrigger value="samples" className="text-xs gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Test Strips
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs gap-1.5 font-medium">
                  <UploadCloud className="h-3.5 w-3.5" /> Upload
                </TabsTrigger>
              </TabsList>

              {/* 1. Mobile Phone Pairing View */}
              <TabsContent value="mobile" className="mt-4 space-y-3">
                <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 flex flex-col md:flex-row items-center gap-5">
                  {/* Dynamic QR Code */}
                  <div className="flex flex-col items-center gap-1.5 bg-white p-2.5 rounded-xl border border-border shadow-md">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Scan with phone"
                        className="h-36 w-36 object-contain"
                      />
                    ) : (
                      <div className="h-36 w-36 flex items-center justify-center bg-slate-100 text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-slate-600 font-semibold uppercase">
                      Scan with Phone
                    </span>
                  </div>

                  {/* Instructions */}
                  <div className="flex-1 space-y-2 text-center md:text-left">
                    <h3 className="text-sm font-bold text-foreground flex items-center justify-center md:justify-start gap-1.5">
                      <Wifi className="h-4 w-4 text-teal-500 animate-pulse" />
                      Use Mobile as Overhead Strip Scanner
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Scan the QR code with your phone camera or open the link below on the same Wi-Fi.
                      Your phone becomes a wireless high-res vision scanner for this bill!
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        readOnly
                        value={mobileUrl || 'Generating pairing link...'}
                        className="h-8 font-mono text-[11px] bg-background/80"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="h-8 gap-1 text-xs shrink-0"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedLink ? 'Copied' : 'Copy'}
                      </Button>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      Status:{' '}
                      <span className={phoneConnected ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                        {phoneConnected ? '🟢 Phone Connected & Ready' : '🟡 Waiting for phone scan...'}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 2. Local Webcam View */}
              <TabsContent value="webcam" className="mt-4 space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-border flex items-center justify-center">
                  <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
                  {!webcamActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                      {webcamError ? (
                        <p className="text-xs text-destructive">{webcamError}</p>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="h-8 w-8 text-muted-foreground animate-pulse" />
                          <p className="text-xs text-muted-foreground">Starting webcam feed...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {webcamActive && (
                    <div className="absolute bottom-3 inset-x-0 flex justify-center">
                      <Button
                        onClick={handleCaptureWebcam}
                        size="sm"
                        className="h-9 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white shadow-lg text-xs font-semibold"
                      >
                        <Zap className="h-4 w-4" /> Snap & Count Strip
                      </Button>
                    </div>
                  )}
                </div>

                {cameras.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Camera:</span>
                    <Select value={selectedCameraId} onValueChange={(id) => setSelectedCameraId(id)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select video device" />
                      </SelectTrigger>
                      <SelectContent>
                        {cameras.map((c) => (
                          <SelectItem key={c.deviceId} value={c.deviceId} className="text-xs">
                            {c.label || `Camera ${c.deviceId.slice(0, 5)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>

              {/* 3. Demo Test Samples */}
              <TabsContent value="samples" className="mt-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_STRIP_SAMPLES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedSample.id === sample.id && !activeImageSrc
                          ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                          : 'border-border/60 bg-muted/20 hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground">{sample.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {sample.cutCount} Cut / {sample.totalCapacity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{sample.description}</p>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* 4. File Upload */}
              <TabsContent value="upload" className="mt-4">
                <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-border/80 hover:border-teal-500/50 bg-muted/10 cursor-pointer transition-colors">
                  <UploadCloud className="h-8 w-8 text-teal-500 mb-2" />
                  <span className="text-xs font-semibold text-foreground">Upload medicine strip photo</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">JPEG, PNG from scanner or mobile</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </TabsContent>
            </Tabs>

            {/* Interactive Strip Visualizer & Cavity HUD */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Layers className="h-4 w-4 text-teal-500" />
                  Interactive Vision HUD (Click cavity to toggle Cut / Pill)
                </span>
                <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400">
                  {activeAnalysis.confidence ? `${(activeAnalysis.confidence * 100).toFixed(0)}% AI Confidence` : ''}
                </span>
              </div>

              {/* Strip Canvas Viewer */}
              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-border/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 shadow-inner flex items-center justify-center">
                {/* Background image if user snapped or uploaded photo */}
                {activeImageSrc && (
                  <img
                    src={activeImageSrc}
                    alt="Captured Strip"
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                  />
                )}

                {/* Simulated Realistic Blister Foil if no background image */}
                {!activeImageSrc && (
                  <div
                    className="relative w-full h-full rounded-lg p-4 shadow-2xl flex items-center justify-center overflow-hidden border"
                    style={{
                      background:
                        selectedSample.foilPattern === 'alu-alu'
                          ? 'radial-gradient(ellipse at 30% 30%, #e2e8f0 0%, #94a3b8 50%, #475569 100%)'
                          : 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
                      borderColor: selectedSample.stripColor,
                    }}
                  >
                    {/* Medicine foil watermark */}
                    <div className="absolute top-2 left-4 text-[11px] font-mono font-bold tracking-widest text-white/40 uppercase">
                      {selectedSample.name} • {selectedSample.composition}
                    </div>
                    <div className="absolute bottom-2 right-4 text-[9px] font-mono text-white/30">
                      BATCH: B9482 • EXP: 12/2028
                    </div>
                  </div>
                )}

                {/* Cavity Circles Overlay with Click-to-Add */}
                <div
                  className="absolute inset-0 p-4 pointer-events-auto cursor-crosshair"
                  onClick={(e) => {
                    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('button')) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
                    const nextId = (Math.max(0, ...activeAnalysis.cavities.map((c) => c.id))) + 1
                    setActiveAnalysis((prev) => ({
                      ...prev,
                      cavities: [
                        ...prev.cavities,
                        {
                          id: nextId,
                          x,
                          y,
                          radius: 8,
                          state: dispenseMode === 'CUT' ? 'CUT' : 'FILLED',
                          confidence: 1,
                          label: `${dispenseMode === 'CUT' ? 'Cut' : 'Pill'} #${nextId}`,
                        },
                      ],
                      cutCount: dispenseMode === 'CUT' ? prev.cutCount + 1 : prev.cutCount,
                      filledCount: dispenseMode === 'REMAINING' ? prev.filledCount + 1 : prev.filledCount,
                    }))
                    toast.success('Tablet Marked', `Added marker at (${x}%, ${y}%)`)
                  }}
                >
                  {currentCavities.map((cavity) => {
                    const isCut = cavity.state === 'CUT'
                    return (
                      <button
                        key={cavity.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleCavity(cavity.id)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setActiveAnalysis((prev) => ({
                            ...prev,
                            cavities: prev.cavities.filter((c) => c.id !== cavity.id),
                          }))
                          toast.info('Cavity Removed', `Removed tablet marker #${cavity.id}`)
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all cursor-pointer shadow-lg group ${
                          isCut
                            ? 'border-2 border-dashed border-red-500 bg-red-500/25 hover:bg-red-500/40 text-red-300'
                            : 'border-2 border-emerald-400 bg-emerald-500/35 hover:bg-emerald-500/50 text-white shadow-emerald-500/20'
                        }`}
                        style={{
                          left: `${cavity.x}%`,
                          top: `${cavity.y}%`,
                          width: `${cavity.radius * 2.3}%`,
                          height: `${cavity.radius * 2.3}%`,
                        }}
                        title={`Cavity #${cavity.id}: ${isCut ? 'Cut / Dispensed' : 'Intact Tablet'} (Click to toggle)`}
                      >
                        {isCut ? (
                          <div className="flex flex-col items-center justify-center">
                            <Scissors className="h-3.5 w-3.5 text-red-400 group-hover:scale-125 transition-transform" />
                            <span className="text-[9px] font-mono font-bold text-red-200">CUT</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <div className="h-2.5 w-2.5 rounded-full bg-white shadow-sm" />
                            <span className="text-[9px] font-mono font-bold text-emerald-200">PILL</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Marg/Tally Dispense & Billing Actions */}
          <div className="lg:col-span-5 p-6 bg-muted/10 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              {/* Vision Statistics Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Vision Analysis Summary
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      // Toggle all cavities state
                      const next = dispenseMode === 'CUT' ? 'REMAINING' : 'CUT'
                      setDispenseMode(next)
                      const newOverrides: Record<number, 'FILLED' | 'CUT'> = {}
                      activeAnalysis.cavities.forEach((c) => {
                        newOverrides[c.id] = next === 'CUT' ? 'CUT' : 'FILLED'
                      })
                      setUserToggledCavities(newOverrides)
                    }}
                    className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    Mode: {dispenseMode === 'CUT' ? '✂️ Selling Cut Piece' : '💊 Showing Remaining'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-center flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">
                      Cut To Sell
                    </span>
                    <div className="flex items-center justify-center gap-1 py-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (currentCutCount <= 0) return
                          const cutCavities = currentCavities.filter((c) => c.state === 'CUT')
                          const lastCut = cutCavities[cutCavities.length - 1]
                          if (lastCut) {
                            setUserToggledCavities((prev) => ({ ...prev, [lastCut.id]: 'FILLED' }))
                          }
                        }}
                        disabled={currentCutCount <= 0}
                        className="h-6 w-6 rounded-full hover:bg-red-500/20 text-red-500 p-0"
                        title="Decrease Cut count"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="text-xl font-black text-red-600 dark:text-red-400 flex items-center justify-center gap-0.5">
                        <Scissors className="h-3.5 w-3.5" />
                        {currentCutCount}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (currentCutCount >= packCapacity) return
                          const filledCavity = currentCavities.find((c) => c.state === 'FILLED')
                          if (filledCavity) {
                            setUserToggledCavities((prev) => ({ ...prev, [filledCavity.id]: 'CUT' }))
                          } else {
                            const nextId = (Math.max(0, ...activeAnalysis.cavities.map((c) => c.id))) + 1
                            setActiveAnalysis((prev) => ({
                              ...prev,
                              cavities: [
                                ...prev.cavities,
                                {
                                  id: nextId,
                                  x: Math.min(85, 20 + ((prev.cavities.length % 5) * 15)),
                                  y: Math.min(80, 35 + (Math.floor(prev.cavities.length / 5) * 35)),
                                  radius: 8,
                                  state: 'CUT',
                                  confidence: 1,
                                  label: `Cut #${nextId}`,
                                },
                              ],
                              cutCount: prev.cutCount + 1,
                              filledCount: Math.max(0, packCapacity - (prev.cutCount + 1)),
                            }))
                          }
                        }}
                        disabled={currentCutCount >= packCapacity}
                        className="h-6 w-6 rounded-full hover:bg-red-500/20 text-red-500 p-0"
                        title="Increase Cut count"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Tablets Cut</span>
                  </div>

                  <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">
                      Remaining
                    </span>
                    <div className="flex items-center justify-center gap-1 py-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (currentFilledCount <= 0) return
                          const filledCavities = currentCavities.filter((c) => c.state === 'FILLED')
                          const lastFilled = filledCavities[filledCavities.length - 1]
                          if (lastFilled) {
                            setUserToggledCavities((prev) => ({ ...prev, [lastFilled.id]: 'CUT' }))
                          }
                        }}
                        disabled={currentFilledCount <= 0}
                        className="h-6 w-6 rounded-full hover:bg-emerald-500/20 text-emerald-500 p-0"
                        title="Decrease Remaining count"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
                        <Pill className="h-3.5 w-3.5" />
                        {currentFilledCount}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (currentFilledCount >= packCapacity) return
                          const cutCavity = currentCavities.find((c) => c.state === 'CUT')
                          if (cutCavity) {
                            setUserToggledCavities((prev) => ({ ...prev, [cutCavity.id]: 'FILLED' }))
                          }
                        }}
                        disabled={currentFilledCount >= packCapacity}
                        className="h-6 w-6 rounded-full hover:bg-emerald-500/20 text-emerald-500 p-0"
                        title="Increase Remaining count"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">In Strip</span>
                  </div>

                  <div className="p-2.5 rounded-xl border border-border bg-card text-center flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Pack Size
                    </span>
                    <div className="text-xl font-black text-foreground py-1">{packCapacity}</div>
                    <span className="text-[10px] text-muted-foreground">Total Units</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Medicine Product Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Linked Inventory Product
                </label>
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search medicine..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-lg border border-border/70 divide-y divide-border/60 bg-card">
                    {filteredProducts.map((p) => {
                      const isSelected = selectedProduct?.id === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedProduct(p)}
                          className={`w-full text-left p-2 flex items-center justify-between text-xs transition-colors ${
                            isSelected ? 'bg-teal-500/15 text-teal-900 dark:text-teal-200 font-semibold' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              Pack: {p.packSize || p.unitOfMeasure} • MRP: {formatCurrency(p.mrp)}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-teal-600 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Fractional Pricing Breakdown */}
              {selectedProduct && (
                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Full Strip MRP ({packCapacity}s):</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(selectedProduct.mrp)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Per Tablet Rate:</span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400 font-mono">
                      {formatCurrency(selectedProduct.mrp / packCapacity)} / tab
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border font-bold text-sm">
                    <span>Cut Quantity ({currentCutCount} Tabs):</span>
                    <span className="text-red-500 font-mono">
                      {formatCurrency((selectedProduct.mrp / packCapacity) * currentCutCount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Dispense Action Buttons (Marg/Tally Style) */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => handleDispenseAction('CUT')}
                disabled={!selectedProduct || currentCutCount === 0}
                className="w-full h-11 gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-teal-500/20"
              >
                <Scissors className="h-4 w-4" />
                Dispense Cut Quantity ({currentCutCount} Tabs) —{' '}
                {selectedProduct
                  ? formatCurrency((selectedProduct.mrp / packCapacity) * currentCutCount)
                  : ''}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDispenseAction('REMAINING')}
                  disabled={!selectedProduct || currentFilledCount === 0}
                  className="h-9 text-xs font-medium gap-1.5"
                >
                  <Pill className="h-3.5 w-3.5 text-emerald-500" />
                  Remaining ({currentFilledCount} Tabs)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleDispenseAction('FULL')}
                  disabled={!selectedProduct}
                  className="h-9 text-xs font-medium gap-1.5"
                >
                  <Package className="h-3.5 w-3.5 text-teal-500" />
                  Full Strip ({packCapacity})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
