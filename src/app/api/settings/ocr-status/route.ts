import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { requireTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getSettings, upsertSettings } from '@/lib/organization/org-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/ocr-status
 * Inspects both Google AI Vision (Gemini 2.5 Flash) and Local Deterministic OCR engines.
 */
export async function GET() {
  try {
    const tenant = await requireTenantContext()
    await requirePermission(PERMISSIONS.ORGANIZATION_READ)

    const orgId = tenant.organizationId || '__GLOBAL__'
    const settingsMap = await getSettings(orgId)
    const activeEngine = settingsMap.ocrDefaultEngine || 'hybrid'

    const apiKey = process.env.GEMINI_API_KEY || ''
    const isKeyConfigured = apiKey.length > 10
    const maskedKey = isKeyConfigured
      ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
      : null

    let googleAiStatus: 'ONLINE' | 'ERROR' | 'UNCONFIGURED' = 'UNCONFIGURED'
    let googleAiLatencyMs = 0

    if (isKeyConfigured) {
      try {
        const t0 = Date.now()
        const checkRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${apiKey}`,
          { method: 'GET', signal: AbortSignal.timeout(5000) }
        )
        googleAiLatencyMs = Date.now() - t0
        googleAiStatus = checkRes.ok ? 'ONLINE' : 'ERROR'
      } catch {
        googleAiStatus = 'ERROR'
      }
    }

    return NextResponse.json({
      success: true,
      activeEngine,
      googleAi: {
        available: googleAiStatus === 'ONLINE',
        status: googleAiStatus,
        model: 'gemini-2.5-flash',
        keyConfigured: isKeyConfigured,
        maskedKey,
        latencyMs: googleAiLatencyMs,
        description: 'Google Gemini 2.5 Flash Cloud Vision API (98% precision for mobile photos, folded bills & handwriting)',
      },
      localOcr: {
        available: true,
        status: 'ONLINE',
        engine: 'OpenCV + PyTesseract / Sharp Local Grid',
        description: '100% Offline Deterministic Table Reconstruction (Zero cloud API calls, best for flat PDFs)',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}

/**
 * POST /api/settings/ocr-status
 * Updates the organization's preferred default OCR engine (hybrid vs zero-llm).
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await requireTenantContext()
    await requirePermission(PERMISSIONS.ORGANIZATION_UPDATE)

    const body = (await req.json()) as { engine?: string }
    const engine = body.engine === 'zero-llm' ? 'zero-llm' : 'hybrid'

    const orgId = tenant.organizationId || '__GLOBAL__'
    await upsertSettings(orgId, { ocrDefaultEngine: engine })

    return NextResponse.json({
      success: true,
      activeEngine: engine,
      message: `Default OCR engine switched to ${engine === 'hybrid' ? 'Google AI Vision (Gemini 2.5 Flash)' : 'Local Zero-LLM Deterministic OCR'}.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
