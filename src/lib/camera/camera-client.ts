/**
 * Client-side Camera & Cash Drawer Hardware Helper
 * Handles camera frame capture and ESC/POS drawer kick pulse actuation.
 */

export async function captureCameraSnapshot(deviceId?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null
  }

  try {
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { width: { ideal: 640 }, height: { ideal: 480 } },
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const video = document.createElement('video')
    video.playsInline = true
    video.muted = true
    video.srcObject = stream

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject)
      }
      setTimeout(() => resolve(), 600)
    })

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      // Stamp timestamp onto the frame for legal and audit integrity
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, canvas.height - 24, canvas.width, 24)
      ctx.font = '12px monospace'
      ctx.fillStyle = '#10b981'
      ctx.fillText(
        `[AMJAD SEC-CAM] ${new Date().toISOString()} • 48H RETENTION`,
        8,
        canvas.height - 8
      )
    }

    // Stop all camera tracks immediately so hardware resources are freed
    stream.getTracks().forEach((track) => track.stop())

    return canvas.toDataURL('image/jpeg', 0.65)
  } catch (err) {
    console.debug('Camera capture bypassed or permission not granted:', err)
    return null
  }
}

/**
 * Play authentic Cash Drawer Mechanical Kick Sound & Pulse
 */
export function playDrawerKickSound() {
  if (typeof window === 'undefined') return
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, audioCtx.currentTime) // High ping (cash bell)
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start()
    osc.stop(audioCtx.currentTime + 0.4)
  } catch {
    // Audio context not allowed or failed
  }
}

/**
 * Dispatch automated cash collection drawer kick event
 */
export async function triggerCashCollectionDrawer(params: {
  invoiceNumber: string
  cashAmount: number
  notes?: string
}) {
  try {
    playDrawerKickSound()

    // 1. Fetch user's mapped camera deviceId if configured
    let mappedDeviceId: string | undefined
    try {
      const mapRes = await fetch('/api/camera/mapping')
      const mapJson = await mapRes.json()
      if (mapJson.success && mapJson.data?.deviceId) {
        mappedDeviceId = mapJson.data.deviceId
      }
    } catch {
      // Ignore if endpoint inaccessible
    }

    // 2. Capture snapshot from counter camera
    const snapshotData = await captureCameraSnapshot(mappedDeviceId)

    // 3. Post to drawer events API (will be accepted if organization has the feature privilege)
    const res = await fetch('/api/camera/drawer-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'AUTO_CASH_COLLECTED',
        invoiceNumber: params.invoiceNumber,
        cashAmount: params.cashAmount,
        snapshotData: snapshotData || undefined,
        deviceId: mappedDeviceId,
        notes: params.notes || 'Automated POS Cash Tender Drawer Kick',
      }),
    })

    const json = await res.json()
    return json.success
  } catch (err) {
    console.warn('Failed to record automated cash drawer kick:', err)
    return false
  }
}
