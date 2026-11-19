import type { StripAnalysisResult } from './strip-counter-engine'

export interface CameraPairingSession {
  sessionId: string
  createdAt: number
  lastPing: number
  phoneConnected: boolean
  phoneDeviceName?: string
  latestFrame?: string // base64 data URL
  analysisResult?: StripAnalysisResult
  selectedProductHint?: string
  updatedAt: number
}

// In-memory cache for fast real-time pairing between phone and desktop POS
declare global {
  // eslint-disable-next-line no-var
  var __vision_sessions: Map<string, CameraPairingSession> | undefined
}

const sessions = globalThis.__vision_sessions ?? new Map<string, CameraPairingSession>()
if (process.env.NODE_ENV !== 'production') {
  globalThis.__vision_sessions = sessions
}

// Auto-cleanup sessions older than 2 hours
function cleanupExpired() {
  const now = Date.now()
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > 2 * 60 * 60 * 1000) {
      sessions.delete(id)
    }
  }
}

export function getOrCreateSession(sessionId: string): CameraPairingSession {
  cleanupExpired()
  let s = sessions.get(sessionId)
  if (!s) {
    s = {
      sessionId,
      createdAt: Date.now(),
      lastPing: Date.now(),
      phoneConnected: false,
      updatedAt: Date.now(),
    }
    sessions.set(sessionId, s)
  }
  return s
}

export function updateSession(
  sessionId: string,
  update: Partial<CameraPairingSession>
): CameraPairingSession {
  const s = getOrCreateSession(sessionId)
  Object.assign(s, update, { updatedAt: Date.now() })
  return s
}

export function getSession(sessionId: string): CameraPairingSession | null {
  return sessions.get(sessionId) || null
}
