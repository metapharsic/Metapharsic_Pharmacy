'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  KeyRound,
  Lock,
  Maximize2,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Video,
  Volume2,
  X,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/lib/hooks/use-toast'
import { useI18n } from '@/lib/i18n/i18n-context'
import { captureCameraSnapshot, playDrawerKickSound } from '@/lib/camera/camera-client'

interface DrawerEvent {
  id: string
  eventType: string
  invoiceNumber: string | null
  cashAmount: number
  snapshotData: string | null
  openedAt: string
  userName: string
  branchName: string
  notes: string | null
}

interface CameraAnalytics {
  enabled: boolean
  totalOpens48h: number
  todayOpens: number
  cashCollectedOpens: number
  manualAdminOpens: number
  sensorDetectedOpens: number
  lastOpenedAt: string | null
  events: DrawerEvent[]
}

interface CameraMapping {
  id?: string
  cameraName: string
  deviceId: string
  streamType: string
  ipStreamUrl?: string | null
  autoOpenDrawer: boolean
  captureOnOpen: boolean
  lastDetectedAt?: string | null
}

export default function CameraDrawerSettingsPage() {
  const toast = useToast()
  let isAr = false
  try {
    const i18n = useI18n()
    isAr = i18n?.locale === 'ar'
  } catch {
    isAr = false
  }

  // State
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<CameraAnalytics | null>(null)
  const [mapping, setMapping] = useState<CameraMapping>({
    cameraName: 'Counter Overhead Camera',
    deviceId: '',
    streamType: 'WEBCAM',
    ipStreamUrl: '',
    autoOpenDrawer: true,
    captureOnOpen: true,
  })

  // Hardware Devices
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [savingMapping, setSavingMapping] = useState(false)
  const [testingKick, setTestingKick] = useState(false)

  // Snapshot zoom modal
  const [zoomSnapshot, setZoomSnapshot] = useState<{
    url: string
    title: string
    time: string
    invoice?: string | null
  } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // ─── 1. Load Data ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [eventsRes, mapRes] = await Promise.all([
        fetch('/api/camera/drawer-events', { cache: 'no-store' }),
        fetch('/api/camera/mapping', { cache: 'no-store' }),
      ])

      const eventsJson = await eventsRes.json()
      const mapJson = await mapRes.json()

      if (eventsJson.success) {
        setAnalytics(eventsJson.data)
      } else if (eventsJson.error?.code === 'PRIVILEGE_REQUIRED') {
        setAnalytics({
          enabled: false,
          totalOpens48h: 0,
          todayOpens: 0,
          cashCollectedOpens: 0,
          manualAdminOpens: 0,
          sensorDetectedOpens: 0,
          lastOpenedAt: null,
          events: [],
        })
      }

      if (mapJson.success && mapJson.data) {
        setMapping(mapJson.data)
        if (mapJson.data.deviceId) {
          setSelectedDeviceId(mapJson.data.deviceId)
        }
      }
    } catch (err: any) {
      toast.error('Failed to load camera settings', err.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── 2. Enumerate Media Devices ────────────────────────────
  const listVideoDevices = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return
    }
    try {
      // First request permission once to get labels
      const stream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null)
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput')
      setDevices(videoInputs)

      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId)
      }
    } catch (err: any) {
      console.warn('Unable to list camera devices:', err)
      setCameraError('Please allow camera access in browser permissions.')
    }
  }, [selectedDeviceId])

  useEffect(() => {
    void listVideoDevices()
  }, [listVideoDevices])

  // ─── 3. Start Camera Live Stream ───────────────────────────
  const startCameraStream = useCallback(async (deviceIdToUse?: string) => {
    const devId = deviceIdToUse || selectedDeviceId
    if (!devId && devices.length === 0) return

    try {
      setCameraError(null)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      }

      const constraints: MediaStreamConstraints = {
        video: devId ? { deviceId: { exact: devId } } : true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      mediaStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => null)
      }
      setCameraActive(true)
    } catch (err: any) {
      console.error('Camera streaming error:', err)
      setCameraError(err.message || 'Could not start camera feed')
      setCameraActive(false)
    }
  }, [devices.length, selectedDeviceId])

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [stopCameraStream])

  // ─── 4. Save Camera Mapping ────────────────────────────────
  const handleSaveMapping = async () => {
    if (!selectedDeviceId) {
      toast.error('Select a camera device first')
      return
    }

    setSavingMapping(true)
    try {
      const selectedDev = devices.find((d) => d.deviceId === selectedDeviceId)
      const devLabel = selectedDev?.label || 'Counter Camera'

      const res = await fetch('/api/camera/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraName: devLabel,
          deviceId: selectedDeviceId,
          streamType: mapping.streamType || 'WEBCAM',
          ipStreamUrl: mapping.ipStreamUrl || null,
          autoOpenDrawer: mapping.autoOpenDrawer,
          captureOnOpen: mapping.captureOnOpen,
        }),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to save mapping')
      }

      setMapping(json.data)
      toast.success(
        isAr ? 'تم ربط الكاميرا بنجاح بنقطة البيع الحالية' : 'Camera mapped to counter successfully',
        isAr
          ? 'تم تفعيل التوثيق الصوري التلقائي لمدة 48 ساعة.'
          : 'Isolated stream active. Microsecond snapshots enabled.'
      )
    } catch (err: any) {
      toast.error('Mapping error', err.message)
    } finally {
      setSavingMapping(false)
    }
  }

  // ─── 5. Test Cash Drawer Hardware Kick ────────────────────
  const handleTestDrawerKick = async () => {
    setTestingKick(true)
    try {
      playDrawerKickSound()

      // Capture snapshot frame if stream is active or device available
      let snapshotData: string | null = null
      if (videoRef.current && cameraActive) {
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth || 640
        canvas.height = videoRef.current.videoHeight || 480
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
          ctx.fillRect(0, canvas.height - 24, canvas.width, 24)
          ctx.font = '12px monospace'
          ctx.fillStyle = '#10b981'
          ctx.fillText(`[TEST KICK AUDIT] ${new Date().toISOString()}`, 8, canvas.height - 8)
          snapshotData = canvas.toDataURL('image/jpeg', 0.65)
        }
      } else {
        snapshotData = await captureCameraSnapshot(selectedDeviceId)
      }

      const res = await fetch('/api/camera/drawer-kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotData: snapshotData || undefined,
          deviceId: selectedDeviceId,
          reason: 'Admin Manual Inspection & Hardware Pulse Test',
        }),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'Drawer kick failed')
      }

      toast.success(
        isAr ? 'تم إرسال نبضة فتح الدرج النقدي بنجاح (ESC/POS)' : 'Cash Drawer Kick Pulse Fired (ESC/POS)',
        `Command: ${json.escposHex} • Event Recorded`
      )
      void fetchData()
    } catch (err: any) {
      toast.error('Cash Drawer Kick Failed', err.message)
    } finally {
      setTestingKick(false)
    }
  }

  // ─── Calculate 48h Expiry Label ───────────────────────────
  const getRemainingHours = (openedAtStr: string) => {
    const openedTime = new Date(openedAtStr).getTime()
    const expiryTime = openedTime + 48 * 60 * 60 * 1000
    const diffMs = expiryTime - Date.now()
    if (diffMs <= 0) return isAr ? 'منتهي الصلاحية' : 'Expired (Purging)'
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return isAr ? `يُحذف بعد ${hours}س ${minutes}د` : `Purges in ${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header & Sovereign Security Badges ─────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {isAr
                  ? 'مراقبة الكاميرا وذكاء الدرج النقدي'
                  : 'In-Store Camera Surveillance & Cash Drawer Intelligence'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? 'ربط مباشر لكاميرا الصيدلية، الفتح التلقائي للدرج عند قبض النقد، واحتفاظ أمني مشدد لمدة يومين (48 ساعة).'
                  : 'Admin-exclusive counter camera mapping, auto-kick on cash collection, and strict 48-hour rolling retention.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-mono text-[11px] px-2.5 py-1"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            {isAr ? 'حذف تلقائي بعد 48 ساعة' : '48-Hour Auto-Purge Active'}
          </Badge>
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-blue-600 font-mono text-[11px] px-2.5 py-1"
          >
            <Lock className="h-3.5 w-3.5 mr-1" />
            {isAr ? 'عزل تام (لا دمج بين الكاميرات)' : 'Strict User Isolation'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* ─── SuperAdmin Enterprise Privilege Gate Check ────── */}
      {analytics && !analytics.enabled && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle className="text-base font-bold">
                {isAr
                  ? 'ميزة متقدمة: تتطلب تفعيل صلاحية المراقبة من المشرف العام (SuperAdmin)'
                  : 'Advanced Feature: Enterprise Privilege Required'}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {isAr
                ? 'خدمة ربط كاميرات المتجر وفتح الدرج النقدي الذكي تتطلب صلاحية خاصة تُمنح حصرياً من قِبل SuperAdmin لكل متجر.'
                : 'Overhead counter camera mapping and cash collection microsecond auditing are gated behind SuperAdmin platform authorization.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border bg-background/50 p-3">
                <span className="font-semibold text-foreground">
                  {isAr ? '💵 الفتح التلقائي للدرج:' : '💵 Automated Drawer Kick:'}
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  {isAr
                    ? 'إرسال نبضة ESC/POS فورية لفتح الدرج آلياً بمجرد تأكيد استلام النقد في نقطة البيع.'
                    : 'Fires ESC/POS pulse upon cash tender in POS, minimizing cashier delay.'}
                </p>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <span className="font-semibold text-foreground">
                  {isAr ? '📸 التوثيق الصوري اللحظي:' : '📸 Microsecond Snapshot:'}
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  {isAr
                    ? 'التقاط صورة ميكروثانية لوجه العميل والكاونتر عند لحظة فتح الدرج النقدي.'
                    : 'Captures an instantaneous frame of the counter whenever the drawer opens.'}
                </p>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <span className="font-semibold text-foreground">
                  {isAr ? '🔒 خصوصية وعزل تام:' : '🔒 Isolated Stream (No Merging):'}
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  {isAr
                    ? 'الكاميرا مخصصة لهذا المستخدم والكاونتر فقط، ولا يمكن دمجها أو مشاركتها عبر المتاجر.'
                    : 'Feeds remain strictly private to this counter session; no cross-store merging.'}
                </p>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <span className="font-semibold text-foreground">
                  {isAr ? '⏳ تخزين مشدد لـ 48 ساعة فقط:' : '⏳ Strict 48-Hour TTL Storage:'}
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  {isAr
                    ? 'حذف دائم وتلقائي لجميع اللقطات والتسجيلات بمجرد مرور يومين (48 ساعة).'
                    : 'Rolling auto-purge permanently removes all snapshots and logs after 2 days.'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              {isAr
                ? 'ℹ️ إذا كنت بحاجة لتفعيل هذه الميزة لصيدليتك، تواصل مع المشرف العام للمنصة لمنح ترخيص الكاميرا والدرج الذكي.'
                : 'ℹ️ Contact your Platform SuperAdmin to enable the "Smart Camera & Cash Drawer Vision" privilege for this dispensary.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Real-Time KPI Cards (48-Hour Metrics) ──────────── */}
      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">
                {isAr ? 'إجمالي فتحات الدرج (آخر 48 ساعة)' : 'Total Opens (48-Hour Window)'}
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-foreground flex items-center justify-between">
                <span>{analytics.totalOpens48h}</span>
                <Clock className="h-5 w-5 text-teal-600 opacity-60" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'جميع الفتحات المسجلة خلال 48 ساعة' : 'Monitored across rolling 48-hr retention'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">
                {isAr ? 'فتحات اليوم (منذ منتصف الليل)' : "Today's Drawer Opens"}
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>{analytics.todayOpens}</span>
                <Zap className="h-5 w-5 text-emerald-600 opacity-60" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'نشاط درج النقدية لليوم الحالي' : 'Active shift operations since 00:00'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">
                {isAr ? 'تحصيل النقد التلقائي (POS)' : 'Cash Collected Auto-Opens'}
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 flex items-center justify-between">
                <span>{analytics.cashCollectedOpens}</span>
                <DollarSign className="h-5 w-5 text-blue-600 opacity-60" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'الدرج فُتح تلقائياً مع فواتير الكاش' : 'Triggered automatically upon cash sale'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">
                {isAr ? 'فتحات يدوية / اختبار المشرف' : 'Manual / Admin Test Opens'}
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>{analytics.manualAdminOpens}</span>
                <KeyRound className="h-5 w-5 text-amber-600 opacity-60" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'فتح بمفتاح يدوي أو اختبار نبضة' : 'Manual key turns or hardware test kicks'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Camera Hardware Mapping & Live Stream Grid ─────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Video Preview & Hardware Stream (7 cols) */}
        <Card className="lg:col-span-7 border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Video className="h-4 w-4 text-teal-600" />
                  {isAr ? 'البث المباشر لكاميرا الكاونتر' : 'Counter Surveillance Stream'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isAr
                    ? 'معاينة مباشرة للكاميرا الموجهة لدرج النقدية والكاونتر'
                    : 'Live overhead video feed pointing at the counter and cash drawer.'}
                </CardDescription>
              </div>

              {cameraActive ? (
                <Badge className="bg-emerald-600 text-white font-mono text-[10px] animate-pulse">
                  ● LIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[10px]">
                  STANDBY
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Video Container */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/80 bg-black/90 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover transition-opacity duration-300 ${
                  cameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/20 text-muted-foreground/60 mb-3">
                    <Camera className="h-7 w-7" />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {isAr ? 'الكاميرا في وضع الاستعداد' : 'Camera Feed on Standby'}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                    {cameraError ||
                      (isAr
                        ? 'انقر على "بدء المعاينة المباشرة" لتشغيل الكاميرا واختبار زاوية الرؤية.'
                        : 'Select your counter device below and click "Start Preview" to test framing.')}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => startCameraStream()}
                    className="mt-3 bg-teal-600 text-white hover:bg-teal-700 h-8 text-xs gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {isAr ? 'بدء المعاينة المباشرة' : 'Start Live Preview'}
                  </Button>
                </div>
              )}

              {cameraActive && (
                <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                  <div className="rounded-md bg-black/70 px-2 py-1 font-mono text-[10px] text-emerald-400 backdrop-blur-sm">
                    {mapping.cameraName || 'Counter Overhead'} • 30 FPS
                  </div>
                </div>
              )}

              {cameraActive && (
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={stopCameraStream}
                    className="h-7 px-2.5 text-[11px]"
                  >
                    {isAr ? 'إيقاف المعاينة' : 'Stop Preview'}
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Test Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">
                  {isAr ? 'اختبار نبضة فتح الدرج النقدي (ESC/POS)' : 'Test Cash Drawer Hardware Kick'}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? 'إرسال نبضة كهرومغناطيسية لالتقاط لقطة فورية واختبار الفتح الميكانيكي'
                    : 'Sends pulse to thermal printer / serial drawer and captures proof frame.'}
                </p>
              </div>

              <Button
                size="sm"
                onClick={handleTestDrawerKick}
                disabled={testingKick}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                {testingKick
                  ? (isAr ? 'جاري الفتح...' : 'Kicking...')
                  : (isAr ? 'فتح الدرج الآن' : 'Kick Drawer Now')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Device Configuration & Mapping Form (5 cols) */}
        <Card className="lg:col-span-5 border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              {isAr ? 'إعدادات ربط الكاميرا بالمستخدم' : 'Admin Counter Device Mapping'}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr
                ? 'ربط حصري لهذه الكاميرا بهذا الكاونتر والمستخدم (بدون أي تداخل)'
                : 'Dedicated hardware binding strictly scoped to this store admin.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Device Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isAr ? 'اختر جهاز الكاميرا المتصل:' : 'Select Counter Video Input:'}
              </Label>
              <Select
                value={selectedDeviceId}
                onValueChange={(val) => {
                  setSelectedDeviceId(val)
                  if (cameraActive) {
                    startCameraStream(val)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue
                    placeholder={
                      devices.length === 0
                        ? (isAr ? 'جاري البحث عن كاميرات...' : 'Detecting video devices...')
                        : (isAr ? 'اختر الكاميرا' : 'Choose Camera')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d, idx) => (
                    <SelectItem key={d.deviceId || idx} value={d.deviceId} className="text-xs">
                      {d.label || `Camera Device ${idx + 1}`}
                    </SelectItem>
                  ))}
                  {devices.length === 0 && (
                    <SelectItem value="default" disabled className="text-xs">
                      {isAr ? 'لا توجد كاميرا موصولة حالياً' : 'No camera detected'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Camera Alias */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isAr ? 'اسم تعريف الكاميرا في السجلات:' : 'Camera Location Tag / Name:'}
              </Label>
              <Input
                value={mapping.cameraName}
                onChange={(e) => setMapping((m) => ({ ...m, cameraName: e.target.value }))}
                placeholder="e.g. Counter 1 Overhead Camera"
                className="h-9 text-xs"
              />
            </div>

            {/* Switches */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    {isAr ? 'فتح الدرج تلقائياً عند قبض النقد' : 'Auto-Kick on Cash Collection'}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr
                      ? 'فتح الدرج فورياً عند اختيار طريقة الدفع كاش في POS'
                      : 'Actuate drawer automatically when POS tender is Cash.'}
                  </p>
                </div>
                <Switch
                  checked={mapping.autoOpenDrawer}
                  onCheckedChange={(checked) =>
                    setMapping((m) => ({ ...m, autoOpenDrawer: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    {isAr ? 'التقاط صورة توثيق عند كل فتح' : 'Capture Frame on Open'}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr
                      ? 'التقاط إطار ميكروثانية لوجه العميل والكاونتر عند الفتح'
                      : 'Snap high-speed frame on every drawer event.'}
                  </p>
                </div>
                <Switch
                  checked={mapping.captureOnOpen}
                  onCheckedChange={(checked) =>
                    setMapping((m) => ({ ...m, captureOnOpen: checked }))
                  }
                />
              </div>
            </div>

            {/* Strict Isolation Notice */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-900 dark:text-blue-300">
              <div className="flex items-center gap-1.5 font-bold">
                <Lock className="h-3.5 w-3.5" />
                {isAr ? 'عزل كامل للبث والبيانات' : 'No Stream Merging Guarantee'}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-blue-800/80 dark:text-blue-300/80">
                {isAr
                  ? 'هذا البث محمي ومقيد فقط بحساب المشرف الحالي. لا يمكن لأي كاشير أو متجر آخر الوصول إلى هذه اللقطات أو استعراضها.'
                  : 'This stream is bound to your store admin counter session only. Cashiers cannot view cameras or access the 48-hour audit vault.'}
              </p>
            </div>

            <Button
              onClick={handleSaveMapping}
              disabled={savingMapping || !selectedDeviceId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 text-xs"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {savingMapping
                ? (isAr ? 'جاري حفظ الربط...' : 'Saving Mapping...')
                : (isAr ? 'حفظ وربط الكاميرا بالكاونتر' : 'Save & Map Camera to Counter')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── Surveillance Audit Log & Microsecond Snapshots ── */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                {isAr
                  ? 'سجل فتحات الدرج النقدي واللقطات التوثيقية (آخر 48 ساعة)'
                  : 'Cash Drawer Open Audit Vault & Photo Snapshots (48-Hour Log)'}
              </CardTitle>
              <CardDescription className="text-xs">
                {isAr
                  ? 'توثيق كل عملية فتح للدرج النقدي مع الصورة اللحظية والمبلغ ورقم الفاتورة. يُحذف تلقائياً بعد 48 ساعة.'
                  : 'Audited log of every opening with microsecond photo frames. Auto-purged after 48 hours.'}
              </CardDescription>
            </div>

            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-[11px] font-mono">
              TTL: 48 HOURS ROLLING
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              {isAr ? 'جاري تحميل السجلات واللقطات...' : 'Loading cash drawer audit logs...'}
            </div>
          ) : !analytics || analytics.events.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                {isAr ? 'لا توجد عمليات فتح مسجلة حالياً' : 'No Cash Drawer Events in Last 48 Hours'}
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                {isAr
                  ? 'عند تحصيل أول فاتورة نقدية في نقطة البيع أو اختبار الفتح اليدوي، ستظهر اللقطات والبيانات هنا فورياً.'
                  : 'When cash is tendered in POS or a manual drawer kick is performed, microsecond audit records will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">{isAr ? 'الصورة التوثيقية' : 'Snapshot'}</th>
                    <th className="p-3">{isAr ? 'نوع الحدث' : 'Event Type'}</th>
                    <th className="p-3">{isAr ? 'التوقيت' : 'Timestamp'}</th>
                    <th className="p-3">{isAr ? 'الفاتورة والمبلغ' : 'Invoice & Amount'}</th>
                    <th className="p-3">{isAr ? 'المستخدم / الكاشير' : 'Staff / User'}</th>
                    <th className="p-3">{isAr ? 'حالة التخزين (48س)' : 'Storage TTL'}</th>
                    <th className="p-3 text-right">{isAr ? 'تفاصيل' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {analytics.events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-muted/30 transition-colors">
                      {/* Photo Thumbnail */}
                      <td className="p-3">
                        {evt.snapshotData ? (
                          <div
                            onClick={() =>
                              setZoomSnapshot({
                                url: evt.snapshotData!,
                                title: evt.eventType,
                                time: new Date(evt.openedAt).toLocaleString(),
                                invoice: evt.invoiceNumber,
                              })
                            }
                            className="group relative h-12 w-16 cursor-pointer overflow-hidden rounded-md border border-border/80 bg-black/60 shadow-sm"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={evt.snapshotData}
                              alt="Counter Snapshot"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-md border border-dashed bg-muted/30 text-muted-foreground">
                            <Camera className="h-4 w-4 opacity-40" />
                          </div>
                        )}
                      </td>

                      {/* Event Type */}
                      <td className="p-3">
                        {evt.eventType === 'AUTO_CASH_COLLECTED' ? (
                          <Badge className="bg-emerald-600 font-mono text-[10px] text-white">
                            AUTO CASH
                          </Badge>
                        ) : evt.eventType === 'MANUAL_ADMIN_OPEN' ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 font-mono text-[10px]">
                            MANUAL ADMIN
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            SENSOR
                          </Badge>
                        )}
                        {evt.notes && (
                          <div className="mt-1 text-[10px] text-muted-foreground max-w-[180px] truncate">
                            {evt.notes}
                          </div>
                        )}
                      </td>

                      {/* Time */}
                      <td className="p-3">
                        <div className="font-medium text-foreground">
                          {new Date(evt.openedAt).toLocaleTimeString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(evt.openedAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Invoice & Amount */}
                      <td className="p-3">
                        {evt.invoiceNumber ? (
                          <div className="font-mono font-bold text-foreground">
                            {evt.invoiceNumber}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                        {evt.cashAmount > 0 && (
                          <div className="font-mono text-[11px] font-semibold text-emerald-600">
                            Cash: {evt.cashAmount.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* User */}
                      <td className="p-3">
                        <div className="font-medium text-foreground">{evt.userName}</div>
                        <div className="text-[10px] text-muted-foreground">{evt.branchName}</div>
                      </td>

                      {/* 48-Hour TTL */}
                      <td className="p-3">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                          {getRemainingHours(evt.openedAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        {evt.snapshotData && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setZoomSnapshot({
                                url: evt.snapshotData!,
                                title: evt.eventType,
                                time: new Date(evt.openedAt).toLocaleString(),
                                invoice: evt.invoiceNumber,
                              })
                            }
                            className="h-7 px-2 text-xs text-teal-600 hover:text-teal-700"
                          >
                            <Maximize2 className="h-3.5 w-3.5 mr-1" />
                            {isAr ? 'معاينة' : 'Inspect'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Zoom Snapshot Modal ─────────────────────────────── */}
      <Dialog open={Boolean(zoomSnapshot)} onOpenChange={() => setZoomSnapshot(null)}>
        <DialogContent className="max-w-2xl p-4">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Camera className="h-4 w-4 text-teal-600" />
                {isAr ? 'اللقطة التوثيقية لفتح الدرج النقدي' : 'Surveillance Frame Inspection'}
              </DialogTitle>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono text-[10px]">
                48-HR VERIFIED
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              {zoomSnapshot?.time} {zoomSnapshot?.invoice ? `• Invoice: ${zoomSnapshot.invoice}` : ''}
            </DialogDescription>
          </DialogHeader>

          {zoomSnapshot?.url && (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomSnapshot.url}
                alt="Zoomed Snapshot"
                className="h-full w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
