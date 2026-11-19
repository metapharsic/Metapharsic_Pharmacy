// ─────────────────────────────────────────────────────────────
// Tally HTTP Client & Live Communication Engine
// Handles HTTP POST dispatching to Tally ERP 9 / TallyPrime
// (default port 9000), health checks, and response parsing.
// ─────────────────────────────────────────────────────────────
import { DEFAULT_TALLY_CONFIG, type TallyPushResult, type TallyServerStatus } from './tally-types'

/**
 * Ping the Tally XML / ODBC server to check connectivity and responsiveness.
 */
export async function pingTallyServer(
  url = DEFAULT_TALLY_CONFIG.serverUrl,
  timeoutMs = 2500
): Promise<TallyServerStatus> {
  const startTime = Date.now()
  const checkedAt = new Date().toISOString()

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Send a lightweight Tally request to verify the server is listening
    const pingEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'text/xml',
      },
      body: pingEnvelope,
      signal: controller.signal,
    })

    clearTimeout(timer)
    const latencyMs = Date.now() - startTime

    if (res.ok || res.status === 200) {
      return {
        online: true,
        url,
        latencyMs,
        message: 'Tally XML server is connected and responding',
        checkedAt,
      }
    }

    return {
      online: false,
      url,
      latencyMs,
      message: `Tally server responded with status ${res.status} ${res.statusText}`,
      checkedAt,
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime
    const isAbort =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
    const message = isAbort
      ? `Connection timed out after ${timeoutMs}ms (Tally server not responding at ${url})`
      : `Cannot reach Tally server at ${url}: ${err instanceof Error ? err.message : 'Connection refused'}`

    return {
      online: false,
      url,
      latencyMs,
      message,
      checkedAt,
    }
  }
}

/**
 * Parse Tally's XML response envelope and extract outcome statistics and error messages.
 */
export function parseTallyResponse(rawXml: string): {
  createdCount: number
  alteredCount: number
  errorCount: number
  lineErrors: string[]
  success: boolean
} {
  const createdMatch = rawXml.match(/<CREATED>(\d+)<\/CREATED>/i)
  const alteredMatch = rawXml.match(/<ALTERED>(\d+)<\/ALTERED>/i)
  const errorsMatch = rawXml.match(/<ERRORS>(\d+)<\/ERRORS>/i)

  const createdCount = createdMatch ? parseInt(createdMatch[1], 10) : 0
  const alteredCount = alteredMatch ? parseInt(alteredMatch[1], 10) : 0
  const errorCount = errorsMatch ? parseInt(errorsMatch[1], 10) : 0

  const lineErrors: string[] = []
  const lineErrorRegex = /<LINEERROR>([^<]+)<\/LINEERROR>/gi
  let match: RegExpExecArray | null
  while ((match = lineErrorRegex.exec(rawXml)) !== null) {
    lineErrors.push(match[1].trim())
  }

  // Also catch generic <DESCRIPTION> errors
  const descRegex = /<DESCRIPTION>([^<]+)<\/DESCRIPTION>/gi
  while ((match = descRegex.exec(rawXml)) !== null) {
    const text = match[1].trim()
    if (!lineErrors.includes(text)) {
      lineErrors.push(text)
    }
  }

  const success =
    errorCount === 0 &&
    (createdCount > 0 || alteredCount > 0 || rawXml.includes('<STATUS>1</STATUS>'))

  return {
    createdCount,
    alteredCount,
    errorCount,
    lineErrors,
    success,
  }
}

/**
 * Push an XML payload (Vouchers, Masters, etc.) directly into Tally via HTTP POST.
 */
export async function pushXmlToTally(
  xml: string,
  serverUrl = DEFAULT_TALLY_CONFIG.serverUrl,
  timeoutMs = 4500
): Promise<TallyPushResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'text/xml',
      },
      body: xml,
      signal: controller.signal,
    })

    clearTimeout(timer)
    const durationMs = Date.now() - startTime

    if (!res.ok) {
      return {
        success: false,
        status: 'FAILED',
        createdCount: 0,
        alteredCount: 0,
        errorCount: 1,
        errorMessage: `Tally HTTP server returned status ${res.status} ${res.statusText}`,
        durationMs,
      }
    }

    const rawResponse = await res.text()
    const parsed = parseTallyResponse(rawResponse)

    if (parsed.success) {
      return {
        success: true,
        status: 'SYNCED',
        createdCount: parsed.createdCount,
        alteredCount: parsed.alteredCount,
        errorCount: 0,
        rawResponse,
        durationMs,
      }
    }

    const errorMsg =
      parsed.lineErrors.length > 0
        ? parsed.lineErrors.join('; ')
        : `Tally import reported ${parsed.errorCount} error(s)`

    return {
      success: false,
      status: 'FAILED',
      createdCount: parsed.createdCount,
      alteredCount: parsed.alteredCount,
      errorCount: parsed.errorCount || 1,
      errorMessage: errorMsg,
      rawResponse,
      durationMs,
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
    const errorMessage = isTimeout
      ? `Tally connection timed out after ${timeoutMs}ms (Tally might not be running at ${serverUrl})`
      : `Tally connection failed: ${err instanceof Error ? err.message : 'Server unreachable'}`

    return {
      success: false,
      status: 'OFFLINE',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 1,
      errorMessage,
      durationMs,
    }
  }
}
