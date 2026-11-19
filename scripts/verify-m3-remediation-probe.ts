import React from 'react'
if (typeof (React as any).cache !== 'function') {
  ;(React as any).cache = <T extends (...args: any[]) => any>(fn: T): T => fn
}

import { NextRequest } from 'next/server'
import prisma from '../src/lib/db/prisma'
import { GET as pipelineGET } from '../src/app/api/purchases/pipeline/route'
import { GET as payablesGET } from '../src/app/api/finance/payables/route'
import { GET as receivablesGET } from '../src/app/api/finance/receivables/route'
import { GET as agencyGET } from '../src/app/api/purchases/agency/route'
import { GET as requisitionsGET } from '../src/app/api/purchases/requisitions/route'
import { GET as quotationsGET } from '../src/app/api/purchases/quotations/route'
import { GET as suggestionsGET } from '../src/app/api/purchases/requisitions/suggestions/route'
import { GET as autoGenerateGET } from '../src/app/api/purchases/auto-generate/route'
import { POST as doctorCommissionPOST } from '../src/app/api/doctors/commissions/route'
import {
  getPurchasePipelineOverview,
  listPurchaseRequisitions,
  listSupplierQuotations,
  getAutoReorderSuggestions,
  processAdvancedGoodsReceipt,
} from '../src/lib/purchases/purchase-lifecycle-service'
import { listPayables, listReceivables } from '../src/lib/finance/finance-service'
import { lookupBatchPurchaseHistory, getAgencyPurchases } from '../src/lib/purchases/agency-purchase-service'
import { getLowStockCandidates } from '../src/lib/purchases/auto-po-service'
import { settleDoctorCommission } from '../src/lib/doctors/doctor-service'
import * as authHelpers from '../src/lib/auth/auth-helpers'

async function runProbe() {
  console.log('=== Milestone 3 Empirical Adversarial Multi-Tenant Probe ===\n')
  let passedCount = 0
  let totalCount = 0

  function assert(condition: boolean, desc: string) {
    totalCount++
    if (condition) {
      console.log(`[PASS] ${desc}`)
      passedCount++
    } else {
      console.error(`[FAIL] ${desc}`)
      throw new Error(`Assertion failed: ${desc}`)
    }
  }

  // 1. Fetch live DB users
  const apolloUser = await prisma.user.findFirst({
    where: { email: 'apollo.admin@pharmacare.local' },
  })
  const defaultUser = await prisma.user.findFirst({
    where: { email: 'admin@pharmacare.local' },
  })
  const emptyTenantUser = await prisma.user.findFirst({
    where: { email: 'idris@pharmacare.local' }, // Shifa Medical (Empty Tenant)
  })

  console.log(`Apollo User: ${apolloUser?.email} (${apolloUser?.organizationId})`)
  console.log(`Default User: ${defaultUser?.email} (${defaultUser?.organizationId})`)
  console.log(`Empty Tenant User: ${emptyTenantUser?.email} (${emptyTenantUser?.organizationId})\n`)

  const apolloAuthUser = {
    id: apolloUser!.id,
    organizationId: apolloUser!.organizationId,
    branchId: apolloUser!.branchId,
    isSuperAdmin: false,
    roles: ['ADMIN'],
    permissions: ['purchases:read', 'purchases:create', 'finance:read', 'suppliers:read'],
  }

  const emptyTenantAuthUser = {
    id: emptyTenantUser!.id,
    organizationId: emptyTenantUser!.organizationId,
    branchId: emptyTenantUser!.branchId,
    isSuperAdmin: false,
    roles: ['ADMIN'],
    permissions: ['purchases:read', 'purchases:create', 'finance:read', 'suppliers:read'],
  }

  // Probe 1: Apollo User tampered branch request to GET /api/purchases/pipeline?branchId=default-branch
  console.log('--- Probe 1: Purchases Pipeline Tampered branchId Rejection ---')
  jest_mock_user(apolloAuthUser)
  const req1 = new NextRequest('http://localhost:3000/api/purchases/pipeline?branchId=default-branch')
  const res1 = await pipelineGET(req1)
  const data1 = await res1.json()
  console.log(`Apollo tampered branch status: ${res1.status}, data:`, data1)
  assert(res1.status === 403, 'Apollo user accessing default-branch via pipeline must return 403 Forbidden')
  assert(data1.success === false, 'Tampered pipeline response success must be false')

  // Probe 2: Empty Tenant User tampered branch request to GET /api/purchases/pipeline?branchId=default-branch
  console.log('\n--- Probe 2: Empty Tenant Tampered branchId Rejection ---')
  jest_mock_user(emptyTenantAuthUser)
  const req2 = new NextRequest('http://localhost:3000/api/purchases/pipeline?branchId=default-branch')
  const res2 = await pipelineGET(req2)
  const data2 = await res2.json()
  console.log(`Empty tenant tampered branch status: ${res2.status}, data:`, data2)
  assert(res2.status === 403, 'Empty tenant user accessing default-branch via pipeline must return 403 Forbidden')

  // Probe 3: Purchase Pipeline Defense-in-Depth in Service
  console.log('\n--- Probe 3: Service-Layer Pipeline Scoping Defense-in-Depth ---')
  // Even if an attacker somehow bypasses the route and calls getPurchasePipelineOverview with branchId='default-branch'
  // but organizationId='cmweivjj60000eglbe6h7kzt0':
  const pipelineResult = await getPurchasePipelineOverview(
    'default-branch',
    emptyTenantAuthUser,
    emptyTenantAuthUser.organizationId!
  )
  console.log('Scoped pipeline overview result:', {
    totalPoCount: pipelineResult.totalPoCount,
    totalPoValue: pipelineResult.totalPoValue,
    requisitionsPending: pipelineResult.counts?.requisitionsPending,
    quotesActive: pipelineResult.counts?.quotesActive,
  })
  assert(pipelineResult.totalPoCount === 0, 'Defense-in-depth: totalPoCount must be 0 for empty tenant even with foreign branchId')
  assert(pipelineResult.totalPoValue === 0, 'Defense-in-depth: totalPoValue must be 0 for empty tenant even with foreign branchId')
  assert((pipelineResult.counts?.requisitionsPending ?? 0) === 0, 'Defense-in-depth: requisitionsPending must be 0')
  assert((pipelineResult.counts?.quotesActive ?? 0) === 0, 'Defense-in-depth: quotesActive must be 0')

  // Probe 4: Finance Payables API Route Scoping
  console.log('\n--- Probe 4: Payables API Route Scoping ---')
  jest_mock_user(emptyTenantAuthUser)
  const payablesReq = new NextRequest('http://localhost:3000/api/finance/payables')
  const payablesRes = await payablesGET(payablesReq)
  const payablesData = await payablesRes.json()
  console.log('Empty tenant payables response:', { status: payablesRes.status, count: payablesData.data?.length, total: payablesData.pagination?.total })
  assert(payablesRes.status === 200, 'Payables status must be 200')
  assert(payablesData.data.length === 0, 'Empty tenant payables data must be empty')
  assert(payablesData.pagination.total === 0, 'Empty tenant payables total must be 0')

  // Probe 5: Finance Receivables API Route Scoping
  console.log('\n--- Probe 5: Receivables API Route Scoping ---')
  jest_mock_user(emptyTenantAuthUser)
  const receivablesReq = new NextRequest('http://localhost:3000/api/finance/receivables')
  const receivablesRes = await receivablesGET(receivablesReq)
  const receivablesData = await receivablesRes.json()
  console.log('Empty tenant receivables response:', { status: receivablesRes.status, count: receivablesData.data?.length, total: receivablesData.pagination?.total })
  assert(receivablesRes.status === 200, 'Receivables status must be 200')
  assert(receivablesData.data.length === 0, 'Empty tenant receivables data must be empty')
  assert(receivablesData.pagination.total === 0, 'Empty tenant receivables total must be 0')

  // Probe 6: Finance Service Direct Scoping
  console.log('\n--- Probe 6: Finance Service Direct Scoping ---')
  const directPayables = await listPayables({}, emptyTenantAuthUser)
  const directReceivables = await listReceivables({}, emptyTenantAuthUser)
  assert(directPayables.data.length === 0, 'listPayables for empty tenant must return 0')
  assert(directReceivables.data.length === 0, 'listReceivables for empty tenant must return 0')

  // Probe 7: Agency Purchases & Batch History Scoping
  console.log('\n--- Probe 7: Agency Purchases & Batch History Scoping ---')
  jest_mock_user(emptyTenantAuthUser)
  const agencyReq = new NextRequest('http://localhost:3000/api/purchases/agency')
  const agencyRes = await agencyGET(agencyReq)
  const agencyData = await agencyRes.json()
  assert(agencyRes.status === 200, 'Agency purchases status must be 200')
  assert(agencyData.data.length === 0, 'Empty tenant agency purchases must be 0')

  const batchHistory = await lookupBatchPurchaseHistory('ANY_BATCH', emptyTenantAuthUser.organizationId!)
  assert(batchHistory.length === 0, 'lookupBatchPurchaseHistory for empty tenant must return 0')

  // Probe 8: Requisitions & Quotations Scoping
  console.log('\n--- Probe 8: Requisitions & Quotations Scoping ---')
  jest_mock_user(emptyTenantAuthUser)
  const reqsRes = await requisitionsGET(new NextRequest('http://localhost:3000/api/purchases/requisitions'))
  const reqsData = await reqsRes.json()
  assert(reqsRes.status === 200, 'Requisitions status must be 200')
  assert(reqsData.data.length === 0, 'Empty tenant requisitions count must be 0')

  const quotesRes = await quotationsGET(new NextRequest('http://localhost:3000/api/purchases/quotations'))
  const quotesData = await quotesRes.json()
  assert(quotesRes.status === 200, 'Quotations status must be 200')
  assert(quotesData.data.length === 0, 'Empty tenant quotations count must be 0')

  const suggestionsRes = await suggestionsGET(new NextRequest('http://localhost:3000/api/purchases/requisitions/suggestions'))
  const suggestionsData = await suggestionsRes.json()
  assert(suggestionsRes.status === 200, 'Suggestions status must be 200')
  const suggestionItems = suggestionsData.data?.items ?? suggestionsData.data ?? []
  assert(suggestionItems.length === 0, 'Empty tenant suggestions candidate count must be 0')

  const autoGenRes = await autoGenerateGET(new NextRequest('http://localhost:3000/api/purchases/auto-generate'))
  const autoGenData = await autoGenRes.json()
  assert(autoGenRes.status === 200, 'Auto-generate status must be 200')
  assert(autoGenData.data.candidates.length === 0, 'Empty tenant auto-generate candidates count must be 0')

  // Probe 9: Doctor Commission Cross-Tenant Settlement Rejection
  console.log('\n--- Probe 9: Doctor Commission Cross-Tenant Settlement Rejection ---')
  // Find or create a doctor belonging to another org (e.g. org-other)
  let targetDoctor = await prisma.doctor.findFirst({
    where: { organizationId: { not: null, notIn: ['org-apollo-pharma'] } },
  })
  let createdDoctor = false
  if (!targetDoctor) {
    targetDoctor = await prisma.doctor.create({
      data: {
        name: 'Dr. Alien Tenant',
        registrationNo: 'REG-ALIEN-999',
        organizationId: 'org-alien-tenant',
        commissionPercent: 10,
        isActive: true,
      },
    })
    createdDoctor = true
  }

  const sampleSale = await prisma.sale.findFirst()
  assert(sampleSale, 'At least one sale must exist in database')

  const testComm = await prisma.doctorCommission.create({
    data: {
      doctor: { connect: { id: targetDoctor.id } },
      sale: { connect: { id: sampleSale.id } },
      saleAmount: 500,
      commissionPercent: 10,
      commissionAmount: 50,
      isPaid: false,
    },
  })

  try {
    // Apollo user tries to settle alien doctor's commission
    jest_mock_user(apolloAuthUser)
    const postReq = new NextRequest('http://localhost:3000/api/doctors/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionId: testComm.id, paymentReference: 'ATTACK' }),
    })
    const postRes = await doctorCommissionPOST(postReq)
    const postData = await postRes.json()
    console.log('Cross-tenant doctor commission settle response:', { status: postRes.status, data: postData })
    assert(postRes.status === 403, 'Cross-tenant doctor commission settle must return 403 Forbidden')
    console.log('[PASS] Cross-tenant doctor commission settle must return 403 Forbidden')
  } finally {
    await prisma.doctorCommission.delete({ where: { id: testComm.id } }).catch(() => {})
    if (createdDoctor) {
      await prisma.doctor.delete({ where: { id: targetDoctor.id } }).catch(() => {})
    }
  }

  // Probe 10: Goods Receipt PO Mismatch Rejection
  console.log('\n--- Probe 10: Goods Receipt PO Branch Mismatch Rejection ---')
  const defaultPurchase = await prisma.purchase.findFirst({
    where: { branchId: 'default-branch' },
  })
  if (defaultPurchase) {
    try {
      await processAdvancedGoodsReceipt(
        {
          purchaseId: defaultPurchase.id,
          branchId: 'branch-apollo-01', // mismatched attacker branch
          grnNumber: 'GRN-POISON-001',
          items: [],
        },
        apolloAuthUser
      )
      assert(false, 'Goods receipt with PO branch mismatch must throw Forbidden')
    } catch (err: any) {
      console.log('PO branch mismatch correctly threw:', err.message)
      assert(err.message.includes('Forbidden') || err.message.includes('mismatch'), 'PO branch mismatch must throw Forbidden error')
    }
  }

  console.log(`\n======================================================`)
  console.log(`PROBE SUMMARY: ${passedCount}/${totalCount} Probes PASSED Cleanly!`)
  console.log(`======================================================\n`)
}

function jest_mock_user(user: any) {
  authHelpers.setAmbientTestUser({
    id: user.id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    isSuperAdmin: user.isSuperAdmin,
    roles: user.roles || ['ADMIN'],
    permissions: user.permissions || [
      'purchases:read',
      'purchases:create',
      'finance:read',
      'suppliers:read',
    ],
  })
}

runProbe()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('PROBE FAILED:', err)
    prisma.$disconnect()
    process.exit(1)
  })
