'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileHeart,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Video,
  VideoOff,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { playBarcodeScanSound, playSuccessCheckoutSound, playWarningSound } from '@/lib/sound/sound-effects'
import type { ResolvedCounterItem } from '@/app/api/pos/camera-to-bill/detect/route'
import type { PosCartLine } from '@/lib/stores/pos-cart-store'

interface CameraCounterScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string
  onCommitItemsToCart: (cartItems: PosCartLine[]) => void
}

export function CameraCounterScannerModal({
  open,
  onOpenChange,
  branchId,
  onCommitItemsToCart,
}: CameraCounterScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [processing, setProcessing] = useState<boolean>(false)
  const [detectedItems, setDetectedItems] = useState<ResolvedCounterItem[]>([])
  const [ringLightFilter, setRingLightFilter] = useState<boolean>(true)
  const [activeEngine, setActiveEngine] = useState<string>('GEMINI_MULTIMODAL_VLM')

  // Request camera list
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter(d => d.kind === 'videoinput')
      setAvailableDevices(videoInputs)
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId)
      }
    } catch (err) {
      console.warn('[CameraScanner] Device enumeration warning:', err)
    }
  }, [selectedDeviceId])

  // Start video stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(newStream)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }
      setIsCameraActive(true)
    } catch (err) {
      console.warn('[CameraScanner] Camera access failed (fallback to demo/upload mode):', err)
      setIsCameraActive(false)
    }
  }, [stream])

  // Stop video stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }, [stream])

  useEffect(() => {
    if (open) {
      refreshDevices()
      startCamera(selectedDeviceId)
    } else {
      stopCamera()
      setDetectedItems([])
    }
    return () => {
      stopCamera()
    }
  }, [open])

  // Capture frame from active video stream
  const captureAndDetect = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('No video stream available. Use demo buttons to test detection.')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64Image = canvas.toDataURL('image/jpeg', 0.85)

    await runDetection({ imageBase64: base64Image })
  }

  // Core detection trigger
  const runDetection = async (payload: { imageBase64?: string; demoSampleKey?: string }) => {
    try {
      setProcessing(true)
      const res = await fetch('/api/pos/camera-to-bill/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, branchId }),
      })

      const data = await res.json()
      if (data.success && Array.isArray(data.items)) {
        setDetectedItems(data.items)
        setActiveEngine(data.engine || 'GEMINI_MULTIMODAL_VLM')
        playBarcodeScanSound()
        toast.success(`Vision AI localized ${data.items.length} item(s) on the counter`)
      } else {
        toast.error(data.error || 'Failed to detect items')
      }
    } catch (err) {
      console.error('[CameraScanner] Detection error:', err)
      toast.error('Computer vision server error')
    } finally {
      setProcessing(false)
    }
  }

  // Modify tablet quantity for a cut strip
  const handleUpdateCutQty = (id: string, delta: number) => {
    setDetectedItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const maxCapacity = item.tabsPerStrip || 10
        const currentQty = item.proRataPricing?.dispenseCount ?? item.blisterDetails?.filledCount ?? 1
        const newQty = Math.max(1, Math.min(maxCapacity, currentQty + delta))

        const stripMrp = item.mrp || 100
        const pricePerTab = Math.round((stripMrp / maxCapacity) * 100) / 100
        const lineTotal = Math.round(newQty * pricePerTab * 100) / 100

        return {
          ...item,
          blisterDetails: item.blisterDetails
            ? { ...item.blisterDetails, filledCount: newQty, cutCount: maxCapacity - newQty }
            : undefined,
          proRataPricing: {
            stripMrp,
            tabsPerStrip: maxCapacity,
            dispenseCount: newQty,
            pricePerTab,
            lineTotal,
            gstRate: item.matchedGstRate || 12,
            taxableAmount: Math.round((lineTotal / 1.12) * 100) / 100,
            taxAmount: Math.round((lineTotal - lineTotal / 1.12) * 100) / 100,
          },
        }
      })
    )
  }

  // Remove individual detected item
  const handleRemoveItem = (id: string) => {
    setDetectedItems(prev => prev.filter(item => item.id !== id))
  }

  // Commit all detected items to active POS Cart
  const handleCommitAll = () => {
    if (detectedItems.length === 0) {
      toast.warning('No items detected on counter')
      return
    }

    const cartLines: PosCartLine[] = detectedItems.map(item => {
      const isCut = item.itemType === 'BLISTER_CUT_STRIP'
      const qty = isCut
        ? item.proRataPricing?.dispenseCount || 1
        : 1
      const price = isCut
        ? item.proRataPricing?.lineTotal || item.mrp || 100
        : item.mrp || 100

      return {
        productId: item.matchedProductId || `scan-${Date.now()}-${item.id}`,
        sku: item.matchedProductSku || `SKU-${item.brandName.slice(0, 4).toUpperCase()}`,
        barcode: null,
        name: item.matchedProductName || item.brandName,
        genericName: item.genericComposition || null,
        unitOfMeasure: isCut ? 'Tablet' : 'Strip',
        unit: isCut ? 'TABLET' : 'STRIP',
        isTabletSale: isCut,
        tabsCut: isCut ? qty : null,
        tabsPerStrip: item.tabsPerStrip || 10,
        originalMrp: item.mrp,
        mrp: price,
        gstRate: item.matchedGstRate || 12,
        cgstRate: (item.matchedGstRate || 12) / 2,
        sgstRate: (item.matchedGstRate || 12) / 2,
        igstRate: 0,
        hsnCode: item.matchedHsnCode || '3004',
        drugSchedule: item.drugSchedule || 'NONE',
        isPrescriptionRequired: item.isPrescriptionRequired,
        isGstExempt: false,
        quantity: isCut ? qty : 1,
        discountPercent: 0,
        availableQuantity: item.matchedBatchStock ?? 100,
        categoryName: item.itemType.replace(/_/g, ' '),
        composition: item.genericComposition,
        batchId: item.matchedBatchId,
        batchNumber: item.matchedBatchNumber || item.batchNumber || 'FEFO-ACTIVE',
        expiryDate: item.matchedBatchExpiry || item.expiryDate || new Date().toISOString(),
      }
    })

    onCommitItemsToCart(cartLines)
    playSuccessCheckoutSound()

    const hasRx = detectedItems.some(it => it.isPrescriptionRequired)
    if (hasRx) {
      playWarningSound()
      toast.warning('Schedule H/H1 item committed: Prescription attachment required in POS before bill settlement.')
    } else {
      toast.success(`Committed ${cartLines.length} item(s) to active POS bill`)
    }

    onOpenChange(false)
  }

  const estimatedTotal = detectedItems.reduce(
    (acc, it) => acc + (it.proRataPricing?.lineTotal || it.mrp || 0),
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-md border-border/80 shadow-2xl rounded-2xl">
        {/* Header Bar */}
        <DialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                AI Vision Counter (Camera-to-Bill)
                <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 font-semibold">
                  Multi-Item YOLO + Cut-Strip Pro-Rata
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Place blister strips, cut strips, or bottles under the overhead counter camera. Visual attention segments items and auto-calculates remaining tablets.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {availableDevices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={e => {
                  setSelectedDeviceId(e.target.value)
                  startCamera(e.target.value)
                }}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {availableDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRingLightFilter(!ringLightFilter)}
              title="Diffused Ring Light & Anti-Glare Polarization Filter"
              className={cn(
                'h-8 text-xs font-semibold gap-1.5 transition-colors',
                ringLightFilter
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground'
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              Anti-Glare Filter
            </Button>
          </div>
        </DialogHeader>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
          {/* Left: Video Preview & Canvas (7 cols) */}
          <div className="lg:col-span-7 relative bg-slate-950 flex flex-col items-center justify-center p-3 border-r border-border/60">
            <div className="relative w-full h-[360px] lg:h-[400px] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  'w-full h-full object-cover transition-all',
                  ringLightFilter && 'contrast-125 brightness-105'
                )}
              />

              {/* Hidden Canvas for Frame Capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Fallback Overlay when camera is off */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-center p-6 text-slate-300">
                  <VideoOff className="h-10 w-10 text-slate-500 mb-2" />
                  <p className="font-semibold text-sm">No Active Video Feed</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Connect an overhead counter camera, or test instantly using the pre-calibrated retail samples below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startCamera(selectedDeviceId)}
                    className="mt-3 gap-1.5 border-teal-500/40 text-teal-400 hover:bg-teal-500/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry Camera
                  </Button>
                </div>
              )}

              {/* Augmented Reality Bounding Boxes */}
              {detectedItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    left: `${item.box.x}%`,
                    top: `${item.box.y}%`,
                    width: `${item.box.width}%`,
                    height: `${item.box.height}%`,
                  }}
                  className={cn(
                    'absolute border-2 rounded-lg pointer-events-none transition-all duration-300 flex flex-col justify-between p-1 shadow-lg',
                    item.isPrescriptionRequired
                      ? 'border-rose-500 bg-rose-500/10'
                      : item.requiresConfirmation
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-emerald-500 bg-emerald-500/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="bg-black/80 backdrop-blur-xs text-[10px] font-bold px-1.5 py-0.5 rounded text-white border border-white/20 truncate max-w-[150px]">
                      {item.label}
                    </span>
                    <Badge
                      className={cn(
                        'text-[9px] px-1 py-0 uppercase font-mono font-bold',
                        item.isPrescriptionRequired ? 'bg-rose-600' : 'bg-emerald-600'
                      )}
                    >
                      {item.isPrescriptionRequired ? `Rx ${item.drugSchedule}` : `${Math.round(item.confidence * 100)}%`}
                    </Badge>
                  </div>

                  {item.itemType === 'BLISTER_CUT_STRIP' && item.blisterDetails && (
                    <div className="bg-teal-900/90 text-teal-200 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center justify-between border border-teal-400/30">
                      <span>Cut: {item.blisterDetails.filledCount}/{item.blisterDetails.totalCapacity} Tabs</span>
                      <span>₹{item.proRataPricing?.lineTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Processing Overlay */}
              {processing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                  <div className="relative">
                    <RefreshCw className="h-8 w-8 animate-spin text-teal-400" />
                    <Sparkles className="h-4 w-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <p className="font-bold text-xs mt-3 tracking-wide">Vision AI Segmenting Items...</p>
                  <p className="text-[11px] text-slate-400">Counting blister cavities & resolving FEFO batches</p>
                </div>
              )}
            </div>

            {/* Bottom Controls on Video Panel */}
            <div className="w-full mt-3 flex items-center justify-between gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={captureAndDetect}
                disabled={processing || !isCameraActive}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-2 shadow-md"
              >
                <Camera className="h-4 w-4" />
                Scan Counter (Space)
              </Button>

              {/* Quick Demo Pre-Calibrated Samples */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Demo:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runDetection({ demoSampleKey: 'dolo-cut-strip' })}
                  disabled={processing}
                  className="h-7 text-[11px] px-2 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Dolo Cut Strip (7 Tabs)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runDetection({ demoSampleKey: 'augmentin-schedule-h1' })}
                  disabled={processing}
                  className="h-7 text-[11px] px-2 border-slate-700 text-rose-400 hover:bg-slate-800"
                >
                  Augmentin (Schedule H1)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runDetection({ demoSampleKey: 'multi-item-tray' })}
                  disabled={processing}
                  className="h-7 text-[11px] px-2 border-teal-500/40 text-teal-400 hover:bg-teal-500/10 font-bold"
                >
                  Multi-Item Tray (3)
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Detected Items List & Cart Ingestion (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-card p-4">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="font-bold text-sm text-foreground">
                    Detected Items ({detectedItems.length})
                  </span>
                </div>
                {detectedItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetectedItems([])}
                    className="h-6 text-[10px] text-muted-foreground hover:text-rose-600"
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {/* Items Scrollable List */}
              <div className="space-y-2.5 max-h-[310px] overflow-y-auto pr-1">
                {detectedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Layers className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-xs text-foreground">Counter is Empty</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                      Place medicines under camera and click &quot;Scan Counter&quot; or choose a demo sample above.
                    </p>
                  </div>
                ) : (
                  detectedItems.map(item => {
                    const isCut = item.itemType === 'BLISTER_CUT_STRIP'
                    const qty = item.proRataPricing?.dispenseCount ?? 1
                    const lineAmt = item.proRataPricing?.lineTotal ?? item.mrp ?? 0

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'p-3 rounded-xl border transition-all text-left relative',
                          item.isPrescriptionRequired
                            ? 'bg-rose-500/[0.04] border-rose-500/30'
                            : item.requiresConfirmation
                              ? 'bg-amber-500/[0.04] border-amber-500/30'
                              : 'bg-muted/30 border-border/70 hover:border-teal-500/40'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-foreground truncate">
                                {item.matchedProductName || item.brandName}
                              </span>
                              {item.isPrescriptionRequired && (
                                <Badge className="text-[9px] px-1 py-0 bg-rose-600 font-bold uppercase">
                                  Rx {item.drugSchedule}
                                </Badge>
                              )}
                              {isCut && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 font-semibold">
                                  Cut Strip
                                </Badge>
                              )}
                            </div>

                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {item.genericComposition || 'Composition matched'}
                            </p>

                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground font-mono">
                              <span>B.No: {item.matchedBatchNumber || item.batchNumber || 'FEFO'}</span>
                              <span>•</span>
                              <span>Exp: {item.matchedBatchExpiry || item.expiryDate || 'Active'}</span>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-rose-600 shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Cut Strip Quantity Adjustment & Pro-Rata Price */}
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/40">
                          {isCut ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleUpdateCutQty(item.id, -1)}
                                className="h-6 w-6 rounded-md"
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </Button>
                              <span className="text-xs font-bold px-1.5 font-mono text-teal-600 dark:text-teal-400">
                                {qty} / {item.tabsPerStrip || 10} Tabs
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleUpdateCutQty(item.id, 1)}
                                className="h-6 w-6 rounded-md"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Full Pack (1 Strip)
                            </span>
                          )}

                          <div className="text-right">
                            <span className="text-xs font-bold text-foreground">
                              ₹{lineAmt.toFixed(2)}
                            </span>
                            {isCut && (
                              <p className="text-[9px] text-muted-foreground">
                                @ ₹{item.proRataPricing?.pricePerTab.toFixed(2)}/tab
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Warning/Confirmation Reason if present */}
                        {item.confirmationReason && (
                          <div className="mt-2 text-[10px] p-1.5 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{item.confirmationReason}</span>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Bottom Total & Ingestion Bar */}
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-muted-foreground">Estimated Invoice Total:</span>
                <span className="text-base font-extrabold text-foreground">
                  ₹{estimatedTotal.toFixed(2)}
                </span>
              </div>

              <Button
                variant="default"
                size="lg"
                disabled={detectedItems.length === 0}
                onClick={handleCommitAll}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs gap-2 shadow-lg"
              >
                <CheckCircle2 className="h-4 w-4" />
                Commit All to POS Cart (Enter)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
