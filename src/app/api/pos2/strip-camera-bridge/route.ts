import os from 'os'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import sharp from 'sharp'

import {
  getOrCreateSession,
  getSession,
  updateSession,
} from '@/lib/vision/session-store'
import {
  analyzeRawPixelBuffer,
  analyzeStripImageFrame,
  type StripAnalysisResult,
} from '@/lib/vision/strip-counter-engine'

// Helper to determine the best local LAN IPv4 address for phone scanning
function getLocalIpAddress(): string {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    const list = nets[name]
    if (!list) continue
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const session = getOrCreateSession(sessionId)
  const localIp = getLocalIpAddress()
  const port = process.env.PORT || '3000'
  const mobileUrl = `http://${localIp}:${port}/pos-camera?session=${sessionId}`

  // Generate QR Code data URL
  let qrCodeDataUrl = ''
  try {
    qrCodeDataUrl = await QRCode.toDataURL(mobileUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
  } catch (err) {
    console.error('Failed to generate QR code:', err)
  }

  return NextResponse.json({
    session,
    mobileUrl,
    localIp,
    qrCodeDataUrl,
    timestamp: Date.now(),
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { sessionId, action, frame, deviceName, productHint, options, analysis: clientAnalysis } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    if (action === 'ping') {
      const updated = updateSession(sessionId, {
        phoneConnected: true,
        phoneDeviceName: deviceName || 'Mobile Phone Camera',
        lastPing: Date.now(),
      })
      return NextResponse.json({ success: true, session: updated })
    }

    if (action === 'capture' || action === 'upload') {
      let analysis: StripAnalysisResult | null = null

      // If a real image frame was transmitted from camera/upload, analyze it via Sharp
      if (frame && typeof frame === 'string' && frame.startsWith('data:image/')) {
        try {
          const base64Data = frame.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')
          const { data, info } = await sharp(buffer)
            .resize(480, 270, { fit: 'inside' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })

          analysis = analyzeRawPixelBuffer(data, info.width, info.height, info.channels, {
            expectedCapacity: options?.expectedCapacity ?? 10,
            sensitivity: options?.sensitivity ?? 0.5,
            mode: options?.mode,
          })
        } catch (imgErr) {
          console.warn('Server frame processing error via sharp:', imgErr)
        }
      }

      // If server could not decode or client already had high-confidence analysis
      if ((!analysis || analysis.cavities.length === 0) && clientAnalysis && clientAnalysis.cavities?.length > 0) {
        analysis = clientAnalysis
      }

      // Fallback if no frame provided
      if (!analysis) {
        analysis = analyzeRawPixelBuffer(new Uint8Array(0), 0, 0, 4, {
          expectedCapacity: options?.expectedCapacity ?? 10,
          sensitivity: options?.sensitivity ?? 0.5,
        })
      }

      const updated = updateSession(sessionId, {
        latestFrame: frame,
        analysisResult: analysis,
        phoneConnected: true,
        selectedProductHint: productHint,
        lastPing: Date.now(),
      })

      return NextResponse.json({
        success: true,
        analysis,
        session: updated,
      })
    }

    if (action === 'sync_analysis') {
      // Sync manual or client-refined analysis directly
      const updated = updateSession(sessionId, {
        analysisResult: clientAnalysis,
        lastPing: Date.now(),
      })
      return NextResponse.json({ success: true, session: updated })
    }

    if (action === 'analyze_custom') {
      const analysis = analyzeRawPixelBuffer(new Uint8Array(0), 0, 0, 4, {
        expectedCapacity: options?.expectedCapacity ?? 10,
        sensitivity: options?.sensitivity ?? 0.5,
      })
      updateSession(sessionId, { analysisResult: analysis })
      return NextResponse.json({ success: true, analysis })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Strip camera bridge error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
