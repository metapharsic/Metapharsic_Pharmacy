'use client'

import {
  Camera,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  FlipHorizontal,
  Info,
  Layers,
  Maximize2,
  RefreshCw,
  Scissors,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  analyzeStripImageFrame,
  type StripAnalysisResult,
} from '@/lib/vision/strip-counter-engine'

function MobileCameraView() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session') || 'pos-default'

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [streamActive, setStreamActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [processing, setProcessing] = useState(false)
  const [connected, setConnected] = useState(false)
  const [lastResult, setLastResult] = useState<StripAnalysisResult | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fallback: Direct photo snap via HTML5 capture (works over HTTP & Mobile Hotspot without HTTPS)
  const handleFileCaptured = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 50, 40])
      }

      const reader = new FileReader()
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string
        if (!dataUrl) {
          setProcessing(false)
          return
        }
        setCapturedImage(dataUrl)

        const img = new window.Image()
        img.onload = async () => {
          const canvas = canvasRef.current || document.createElement('canvas')
          canvas.width = img.naturalWidth || 1280
          canvas.height = img.naturalHeight || 720
          const ctx = canvas.getContext('2d')

          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const analysis = analyzeStripImageFrame(imgData, { expectedCapacity: 10 })
            setLastResult(analysis)

            // Transmit to POS 2 Desktop Screen
            const res = await fetch('/api/pos2/strip-camera-bridge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                action: 'capture',
                frame: dataUrl,
                deviceName: navigator.userAgent.includes('iPhone')
                  ? 'iPhone Native Camera'
                  : 'Android Native Camera',
                options: { expectedCapacity: 10 },
                analysis,
              }),
            })
            if (res.ok) {
              const resData = await res.json()
              if (resData.analysis) {
                setLastResult(resData.analysis)
              }
            }
          }
          setProcessing(false)
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('File capture error:', err)
      setProcessing(false)
    }
  }

  // Register presence with the POS 2 desktop session
  const pingSession = useCallback(async () => {
    try {
      const res = await fetch('/api/pos2/strip-camera-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'ping',
          deviceName: navigator.userAgent.includes('iPhone')
            ? 'iPhone Camera'
            : navigator.userAgent.includes('Android')
              ? 'Android Camera'
              : 'Mobile Web Camera',
        }),
      })
      if (res.ok) {
        setConnected(true)
      }
    } catch (err) {
      console.warn('Failed to ping session:', err)
    }
  }, [sessionId])

  useEffect(() => {
    void pingSession()
    const timer = setInterval(() => void pingSession(), 8000)
    return () => clearInterval(timer)
  }, [pingSession])

  // Start mobile camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      if (videoRef.current?.srcObject) {
        const curStream = videoRef.current.srcObject as MediaStream
        curStream.getTracks().forEach((t) => t.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStreamActive(true)

        // Check torch support
        const track = stream.getVideoTracks()[0]
        const capabilities = (track?.getCapabilities?.() as { torch?: boolean }) || {}
        setHasTorch(Boolean(capabilities.torch))
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraError(
        'Unable to access camera. Please allow camera permissions in your browser or try selecting another camera.'
      )
      setStreamActive(false)
    }
  }, [facingMode])

  useEffect(() => {
    void startCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [startCamera])

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    try {
      if (!videoRef.current?.srcObject) return
      const stream = videoRef.current.srcObject as MediaStream
      const track = stream.getVideoTracks()[0]
      if (track) {
        const nextState = !torchOn
        // @ts-expect-error torch is standard in mobile browsers
        await track.applyConstraints({ advanced: [{ torch: nextState }] })
        setTorchOn(nextState)
      }
    } catch (err) {
      console.warn('Torch not supported:', err)
    }
  }

  // Flip front/rear camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Capture frame, analyze cavities and transmit to desktop POS 2
  const handleCapture = async () => {
    if (!videoRef.current || processing) return
    setProcessing(true)

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 50, 40])
      }

      const video = videoRef.current
      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setCapturedImage(frameDataUrl)

        // Local fast analysis
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const analysis = analyzeStripImageFrame(imgData, { expectedCapacity: 10 })
        setLastResult(analysis)

        // Sync with Desktop POS 2
        const res = await fetch('/api/pos2/strip-camera-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action: 'capture',
            frame: frameDataUrl,
            deviceName: 'Mobile Phone Camera',
            options: { expectedCapacity: 10 },
            analysis,
          }),
        })
        if (res.ok) {
          const resData = await res.json()
          if (resData.analysis) {
            setLastResult(resData.analysis)
          }
        }
      }
    } catch (err) {
      console.error('Capture and transmit error:', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-white font-sans select-none">
      {/* Top Header Bar */}
      <header className="z-20 flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              PharmaVision™ Mobile
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                LIVE
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Session: <span className="text-teal-400">{sessionId.slice(0, 12)}...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] font-medium border ${
              connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            <Wifi className="h-3 w-3 mr-1 inline animate-pulse" />
            {connected ? 'POS 2 Synced' : 'Connecting...'}
          </Badge>
        </div>
      </header>

      {/* Main Camera Viewport */}
      <main className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {/* Live Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            streamActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Hidden File Input for Native Camera Capture (Bypasses HTTP/HTTPS WebRTC restrictions) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileCaptured}
          className="hidden"
        />

        {/* Hidden Canvas for Frame Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Captured Image Preview (when snapped via native camera) */}
        {capturedImage && !streamActive && (
          <div className="relative h-full w-full flex items-center justify-center bg-black">
            <img
              src={capturedImage}
              alt="Captured Medicine Strip"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        {/* Camera Loading / Error State */}
        {!streamActive && !capturedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-950">
            {cameraError ? (
              <div className="max-w-xs space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-lg shadow-teal-500/10">
                  <Camera className="h-7 w-7" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">Live Stream Blocked by Browser</h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Mobile browsers require HTTPS for live video on IP addresses. You can snap a photo directly using your phone camera below:
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="default"
                    className="w-full gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold shadow-lg text-xs h-10"
                  >
                    <Camera className="h-4 w-4" /> Snap Strip with Camera
                  </Button>

                  <Button
                    onClick={() => void startCamera()}
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs h-8"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Try Live Video Again
                  </Button>
                </div>

                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800 text-left">
                  <div className="text-[10px] font-semibold text-teal-400 uppercase tracking-wide flex items-center gap-1">
                    <Info className="h-3 w-3" /> Hotspot Tip
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400 leading-normal">
                    On Android Chrome, open <span className="font-mono text-teal-300">chrome://flags</span>, search for <span className="font-mono text-teal-300">unsafely-treat-insecure-origin-as-secure</span>, and add your laptop IP to enable live stream.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 text-teal-400 animate-spin" />
                <p className="text-xs text-slate-400 font-mono">Initializing rear camera sensor...</p>
              </div>
            )}
          </div>
        )}

        {/* High-Tech Strip Alignment HUD Overlay */}
        {streamActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
            {/* Guide Text */}
            <div className="z-10 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-teal-500/30 text-[11px] font-medium text-teal-300 flex items-center gap-1.5 shadow-lg">
              <Scissors className="h-3.5 w-3.5" />
              Place cut medicine strip flat in box below
            </div>

            {/* Reticle Guide Box */}
            <div className="relative w-full max-w-sm aspect-[16/10] rounded-2xl border-2 border-dashed border-teal-400/60 bg-teal-500/5 shadow-[0_0_25px_rgba(20,184,166,0.15)] flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-teal-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-teal-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-teal-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-teal-400 rounded-br-xl" />

              {/* Grid guide for 10-pack */}
              <div className="w-4/5 h-3/5 grid grid-cols-5 grid-rows-2 gap-2 opacity-30">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="rounded-full border border-teal-400 flex items-center justify-center text-[9px] text-teal-400 font-mono">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Center scan line */}
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
            </div>

            {/* Quick stats banner if result received */}
            {lastResult && (
              <div className="z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-emerald-500/40 text-center w-full max-w-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Strip Analyzed!
                  </span>
                  <span className="text-emerald-400 font-mono text-[10px]">
                    {(lastResult.confidence * 100).toFixed(0)}% Match
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-800/80 rounded-lg p-1.5 border border-slate-700">
                    <div className="text-[10px] text-slate-400">Cut</div>
                    <div className="font-bold text-red-400 text-sm">{lastResult.cutCount}</div>
                  </div>
                  <div className="bg-slate-800/80 rounded-lg p-1.5 border border-slate-700">
                    <div className="text-[10px] text-slate-400">Intact</div>
                    <div className="font-bold text-emerald-400 text-sm">{lastResult.filledCount}</div>
                  </div>
                  <div className="bg-slate-800/80 rounded-lg p-1.5 border border-slate-700">
                    <div className="text-[10px] text-slate-400">Capacity</div>
                    <div className="font-bold text-teal-400 text-sm">{lastResult.totalCapacity}</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-emerald-300 font-medium">
                  ✓ Sent to POS 2 Desktop Screen
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Action & Shutter Toolbar */}
      <footer className="z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-6 py-4 flex items-center justify-between">
        {/* Flashlight toggle */}
        <button
          type="button"
          onClick={toggleTorch}
          disabled={!hasTorch && !streamActive}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
            torchOn
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Flashlight"
        >
          {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
          <span className="text-[10px] font-medium">{torchOn ? 'Torch On' : 'Torch'}</span>
        </button>

        {/* Shutter Button */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={streamActive ? handleCapture : () => fileInputRef.current?.click()}
            disabled={processing}
            className={`relative flex h-18 w-18 items-center justify-center rounded-full p-1.5 transition-all shadow-xl ${
              processing
                ? 'opacity-60 scale-95'
                : 'active:scale-95 hover:shadow-teal-500/20'
            } bg-gradient-to-tr from-teal-600 via-teal-400 to-emerald-400`}
            aria-label="Capture and count strip"
          >
            <div className="h-full w-full rounded-full border-2 border-slate-950 bg-white flex items-center justify-center text-teal-600 shadow-inner">
              {processing ? (
                <RefreshCw className="h-7 w-7 animate-spin text-teal-600" />
              ) : streamActive ? (
                <Zap className="h-7 w-7 text-teal-600 fill-teal-500" />
              ) : (
                <Camera className="h-7 w-7 text-teal-600" />
              )}
            </div>
          </button>
          <span className="text-[10px] font-semibold text-teal-300 mt-1 uppercase tracking-wider">
            {processing ? 'Analyzing...' : streamActive ? 'Scan Strip' : 'Snap Photo'}
          </span>
        </div>

        {/* Camera Switcher */}
        <button
          type="button"
          onClick={toggleFacingMode}
          disabled={!streamActive}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 hover:text-white transition-all"
          title="Switch Camera"
        >
          <FlipHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">Flip</span>
        </button>
      </footer>
    </div>
  )
}

export default function MobileCameraPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white font-mono text-xs">
          Loading camera companion...
        </div>
      }
    >
      <MobileCameraView />
    </Suspense>
  )
}
