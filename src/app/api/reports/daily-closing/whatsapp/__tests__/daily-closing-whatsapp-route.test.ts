/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET, POST } from '@/app/api/reports/daily-closing/whatsapp/route'
import { getSession } from '@/lib/auth/auth-helpers'
import { DailyClosingDigestService } from '@/lib/reports/daily-closing-digest-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn().mockImplementation(async (user, requestedBranch) => requestedBranch || user.branchId),
}))

jest.mock('@/lib/reports/daily-closing-digest-service', () => ({
  DailyClosingDigestService: {
    generateDigest: jest.fn(),
    sendClosingDigest: jest.fn(),
  },
}))

const mockedGetSession = getSession as jest.Mock
const mockedDailyClosingDigestService = DailyClosingDigestService as unknown as {
  generateDigest: jest.Mock
  sendClosingDigest: jest.Mock
}

function makeGetReq(url = 'http://localhost:3000/api/reports/daily-closing/whatsapp'): NextRequest {
  return { url } as unknown as NextRequest
}

function makePostReq(body: any, url = 'http://localhost:3000/api/reports/daily-closing/whatsapp'): NextRequest {
  return {
    url,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/reports/daily-closing/whatsapp', () => {
  it('returns 401 Unauthorized when session is missing', async () => {
    mockedGetSession.mockResolvedValueOnce(null)
    const res = await GET(makeGetReq())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 403 Forbidden when user has no report permissions or role', async () => {
    mockedGetSession.mockResolvedValueOnce({
      user: {
        id: 'u-cashier',
        roles: ['cashier'],
        permissions: ['sales:create'],
        branchId: 'br-1',
      },
    })
    const res = await GET(makeGetReq())
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('allows pharmacist with role pharmacist to preview closing digest', async () => {
    mockedGetSession.mockResolvedValueOnce({
      user: {
        id: 'u-pharm',
        roles: ['pharmacist'],
        permissions: ['reports:sales', 'sales:read'],
        branchId: 'br-1',
      },
    })
    mockedDailyClosingDigestService.generateDigest.mockResolvedValueOnce({
      branchId: 'br-1',
      branchName: 'Main Dispensary',
      ownerPhone: '+91-9876543210',
      sales: { totalRevenue: 25894.6 },
    })

    const res = await GET(makeGetReq())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.branchName).toBe('Main Dispensary')
    expect(json.canDispatch).toBe(true)
  })

  it('allows owner or admin to preview closing digest', async () => {
    mockedGetSession.mockResolvedValueOnce({
      user: {
        id: 'u-admin',
        roles: ['owner'],
        permissions: [],
        branchId: 'br-1',
      },
    })
    mockedDailyClosingDigestService.generateDigest.mockResolvedValueOnce({
      branchId: 'br-1',
      branchName: 'Main Dispensary',
      ownerPhone: '+91-9876543210',
      sales: { totalRevenue: 1000 },
    })

    const res = await GET(makeGetReq())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.canDispatch).toBe(true)
  })
})

describe('POST /api/reports/daily-closing/whatsapp', () => {
  it('returns 401 Unauthorized when session is missing', async () => {
    mockedGetSession.mockResolvedValueOnce(null)
    const res = await POST(makePostReq({ phone: '+919876543210' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 Forbidden when unauthorized user tries to dispatch', async () => {
    mockedGetSession.mockResolvedValueOnce({
      user: {
        id: 'u-cashier',
        roles: ['cashier'],
        permissions: [],
        branchId: 'br-1',
      },
    })
    const res = await POST(makePostReq({ phone: '+919876543210' }))
    expect(res.status).toBe(403)
  })

  it('allows authorized staff to dispatch digest', async () => {
    mockedGetSession.mockResolvedValueOnce({
      user: {
        id: 'u-pharm',
        roles: ['pharmacist'],
        permissions: ['reports:sales'],
        branchId: 'br-1',
      },
    })
    mockedDailyClosingDigestService.sendClosingDigest.mockResolvedValueOnce({
      digest: { branchName: 'Main Dispensary' },
      sendResult: {
        toPhone: '+919876543210',
        providerUsed: 'Simulation',
        status: 'SIMULATED',
      },
    })

    const res = await POST(makePostReq({ phone: '+919876543210' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toContain('+919876543210')
  })
})
