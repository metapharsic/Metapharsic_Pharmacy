// ─────────────────────────────────────────────────────────────
// Optical Camera & Stream Simulator Service
// Multi-Tier Camera Acquisition (Physical UVC / Mobile + Canvas Simulation)
// ─────────────────────────────────────────────────────────────

import type { PackagingSurfaceType } from './strip-scanner-types'

export interface CameraAcquisitionOptions {
  deviceId?: string
  idealWidth?: number
  idealHeight?: number
  idealFrameRate?: number
  preferEnvironment?: boolean
}

export interface CameraAcquisitionResult {
  stream: MediaStream
  isSimulated: boolean
  error?: string
}

/**
 * Attempts to acquire real webcam stream with multi-tiered fallback.
 * Tier 1: User requested deviceId or facingMode at ideal 1080p/60fps
 * Tier 2: Generic 720p stream
 * Tier 3: Permissive `{ video: true }`
 */
export async function acquireCameraStream(
  options: CameraAcquisitionOptions = {}
): Promise<CameraAcquisitionResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera MediaDevices API is not supported in this browser environment.')
  }

  const {
    deviceId,
    idealWidth = 1920,
    idealHeight = 1080,
    idealFrameRate = 60,
    preferEnvironment = true,
  } = options

  // TIER 1: High-Definition Ideal
  try {
    const constraints: MediaStreamConstraints = {
      video: {
        ...(deviceId
          ? { deviceId: { ideal: deviceId } }
          : preferEnvironment
          ? { facingMode: { ideal: 'environment' } }
          : {}),
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
        frameRate: { ideal: idealFrameRate },
      },
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return { stream, isSimulated: false }
  } catch (errTier1) {
    console.warn('[Camera] Tier 1 constraint failed, trying standard fallback...', errTier1)
  }

  // TIER 2: Standard 720p @ 30fps
  try {
    const constraints: MediaStreamConstraints = {
      video: {
        ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return { stream, isSimulated: false }
  } catch (errTier2) {
    console.warn('[Camera] Tier 2 fallback failed, trying permissive fallback...', errTier2)
  }

  // TIER 3: Universal Permissive `{ video: true }`
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    return { stream, isSimulated: false }
  } catch (errTier3: any) {
    console.error('[Camera] All physical camera tiers failed:', errTier3)
    let message = 'Unable to access physical camera.'
    if (errTier3?.name === 'NotAllowedError' || errTier3?.name === 'PermissionDeniedError') {
      message = 'Camera permission denied. Please allow camera access in browser settings.'
    } else if (errTier3?.name === 'NotFoundError' || errTier3?.name === 'DevicesNotFoundError') {
      message = 'No physical camera detected on this system.'
    } else if (errTier3?.name === 'NotReadableError' || errTier3?.name === 'TrackStartError') {
      message = 'Camera is currently in use by another application.'
    }
    throw new Error(message)
  }
}

/**
 * Creates an animated 30 FPS optical stream from an offscreen HTML5 canvas.
 * Simulates high-resolution pharmaceutical medicine strip with active diffuse LED illumination,
 * blister pockets, dot-matrix debossed text, and moving laser inspection reticle.
 */
export function createOpticalStreamSimulator(
  surfaceType: PackagingSurfaceType = 'ALU_ALU',
  medicineLabel = 'AUGMENTIN 625 DUO'
): { stream: MediaStream; stop: () => void } {
  if (typeof document === 'undefined') {
    throw new Error('Canvas stream simulator requires DOM environment.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }

  let animationFrameId: number
  let isRunning = true
  let frame = 0

  const render = () => {
    if (!isRunning) return
    frame++

    const w = canvas.width
    const h = canvas.height

    // 1. Dark Inspection Workbench Background
    ctx.fillStyle = '#090a0f'
    ctx.fillRect(0, 0, w, h)

    // Diffuse LED soft overhead light ring
    const radGrd = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 500)
    radGrd.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
    radGrd.addColorStop(0.5, 'rgba(100, 140, 255, 0.05)')
    radGrd.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = radGrd
    ctx.fillRect(0, 0, w, h)

    // 2. Pharmaceutical Strip Body (Centered)
    const stripW = 760
    const stripH = 380
    const stripX = (w - stripW) / 2
    const stripY = (h - stripH) / 2

    ctx.save()

    // Subtle 3D shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 15

    // Surface Styling
    if (surfaceType === 'ALU_ALU') {
      // Metallic Foil Reflection with angle shimmer
      const foilGrd = ctx.createLinearGradient(stripX, stripY, stripX + stripW, stripY + stripH)
      const shimmer = (Math.sin(frame * 0.03) + 1) / 2
      foilGrd.addColorStop(0, '#a8b2c1')
      foilGrd.addColorStop(0.3 + shimmer * 0.2, '#f0f4f8')
      foilGrd.addColorStop(0.6, '#9ba3b0')
      foilGrd.addColorStop(1, '#788191')
      ctx.fillStyle = foilGrd
    } else if (surfaceType === 'BLISTER') {
      // Clear PVC over silver back
      ctx.fillStyle = '#cbd5e1'
    } else {
      // Carton Box White Board
      ctx.fillStyle = '#f8fafc'
    }

    // Strip rounded rectangle
    ctx.beginPath()
    ctx.roundRect(stripX, stripY, stripW, stripH, 20)
    ctx.fill()
    ctx.restore()

    // Inner embossed border
    ctx.strokeStyle = surfaceType === 'ALU_ALU' ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8'
    ctx.lineWidth = 2
    ctx.strokeRect(stripX + 10, stripY + 10, stripW - 20, stripH - 20)

    // 3. Tablet Pockets Grid (2 rows x 5 columns = 10 Tablets)
    const pocketCols = 5
    const pocketRows = 2
    const cellW = (stripW - 60) / pocketCols
    const cellH = (stripH - 140) / pocketRows

    for (let r = 0; r < pocketRows; r++) {
      for (let c = 0; c < pocketCols; c++) {
        const px = stripX + 30 + c * cellW + cellW / 2
        const py = stripY + 110 + r * cellH + cellH / 2

        ctx.save()
        // Tablet cavity 3D emboss
        ctx.beginPath()
        ctx.ellipse(px, py, cellW * 0.38, cellH * 0.38, 0, 0, Math.PI * 2)
        ctx.fillStyle = surfaceType === 'ALU_ALU' ? '#8e96a4' : '#e2e8f0'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 4
        ctx.fill()

        // Highlight ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
    }

    // 4. Dot-Matrix & Inkjet Printed Pharmaceutical Details
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 24px monospace'
    ctx.fillText(medicineLabel, stripX + 30, stripY + 45)

    ctx.fillStyle = '#475569'
    ctx.font = '13px sans-serif'
    ctx.fillText('Amoxicillin and Potassium Clavulanate Tablets IP 625 mg', stripX + 30, stripY + 68)

    // Red Schedule H1 / Caution bar
    ctx.fillStyle = '#dc2626'
    ctx.fillRect(stripX + 30, stripY + 76, 260, 4)

    // Dot-Matrix debossed batch number & expiry
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 13px monospace'
    ctx.fillText('B.No.: AG-9842   MFD: 01/2026   EXP: 12/2028', stripX + 30, stripY + 98)
    ctx.fillText('M.R.P. ₹ 223.50 INCL. ALL TAXES / 10 TABS', stripX + 410, stripY + 98)

    // Manufacturer mark
    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText('GlaxoSmithKline Pharmaceuticals Ltd. • Schedule H1 Drug', stripX + 30, stripY + stripH - 18)

    // EAN-13 Barcode representation in bottom right
    const barcodeX = stripX + stripW - 190
    const barcodeY = stripY + stripH - 42
    ctx.fillStyle = '#000000'
    for (let b = 0; b < 40; b++) {
      const bw = (b % 3 === 0 || b % 5 === 0) ? 3 : 1.5
      ctx.fillRect(barcodeX + b * 4, barcodeY, bw, 22)
    }
    ctx.font = '10px monospace'
    ctx.fillText('8901234567890', barcodeX + 20, barcodeY + 32)

    // 5. Active Laser Scanner Beam (Moving Vertical Sweep)
    const sweepY = stripY + ((Math.sin(frame * 0.05) + 1) / 2) * stripH
    const beamGrd = ctx.createLinearGradient(stripX, sweepY, stripX + stripW, sweepY)
    beamGrd.addColorStop(0, 'rgba(239, 68, 68, 0)')
    beamGrd.addColorStop(0.2, 'rgba(239, 68, 68, 0.8)')
    beamGrd.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
    beamGrd.addColorStop(0.8, 'rgba(239, 68, 68, 0.8)')
    beamGrd.addColorStop(1, 'rgba(239, 68, 68, 0)')

    ctx.fillStyle = beamGrd
    ctx.fillRect(stripX - 20, sweepY - 1.5, stripW + 40, 3)

    // 6. Camera Viewfinder HUD Overlay
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)'
    ctx.lineWidth = 1.5
    // Top-left bracket
    ctx.strokeRect(stripX - 15, stripY - 15, 40, 40)
    // Top-right bracket
    ctx.strokeRect(stripX + stripW - 25, stripY - 15, 40, 40)
    // Bottom-left bracket
    ctx.strokeRect(stripX - 15, stripY + stripH - 25, 40, 40)
    // Bottom-right bracket
    ctx.strokeRect(stripX + stripW - 25, stripY + stripH - 25, 40, 40)

    // Live HUD Status text
    ctx.fillStyle = '#10b981'
    ctx.font = 'bold 12px monospace'
    ctx.fillText('● HIGH-SPEED OPTICAL STREAM [SIMULATOR ACTIVE]', 25, 30)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = '11px monospace'
    ctx.fillText(`PROFILE: 1080P @ 60 FPS • SURFACE: ${surfaceType} • GLOSS DEFLECTION 40°`, 25, 48)

    animationFrameId = requestAnimationFrame(render)
  }

  render()

  // Capture standard MediaStream from the canvas
  const stream: MediaStream | null = (canvas as any).captureStream ? canvas.captureStream(30) : null

  if (!stream) {
    throw new Error('Browser does not support canvas.captureStream')
  }

  const stop = () => {
    isRunning = false
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    stream.getTracks().forEach((track) => track.stop())
  }

  return { stream, stop }
}

/**
 * Capture frame from active video element into high-resolution Base64 / Canvas
 */
export function captureFrameFromVideoElement(video: HTMLVideoElement): {
  canvas: HTMLCanvasElement
  dataUrl: string
} {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }
  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
  }
}
