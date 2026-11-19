import prisma from '../src/lib/db/prisma'
import {
  isCameraDrawerEnabled,
  setCameraDrawerPrivilege,
  purgeExpiredCameraStorage,
  getStoreCameraMapping,
  saveStoreCameraMapping,
  recordCashDrawerOpen,
  getCashDrawerAnalytics,
  CAMERA_RETENTION_MS,
} from '../src/lib/camera/camera-drawer-service'

async function runVerification() {
  console.log('--- STARTING IN-STORE CAMERA & CASH DRAWER INTEGRATION VERIFICATION ---')

  // 1. Find or pick Amjad Pharmacy Organization
  const org = await prisma.organization.findFirst({
    where: { code: 'AMJAD' },
    include: { users: true, branches: true },
  })

  if (!org) {
    throw new Error('Amjad Pharmacy organization not found in DB')
  }

  const branch = org.branches[0] || (await prisma.branch.findFirst({ where: { organizationId: org.id } }))
  const adminUser = org.users[0]

  if (!branch || !adminUser) {
    throw new Error('Branch or Admin user not found for Amjad Pharmacy')
  }

  console.log(`[PASS] Organization: ${org.name} (${org.id}), Branch: ${branch.name}, User: ${adminUser.name} (${adminUser.id})`)

  // 2. Test SuperAdmin Privilege Gate
  console.log('\n[TEST 1] Testing SuperAdmin Privilege Gate...')
  await setCameraDrawerPrivilege(org.id, false)
  const initialPrivilege = await isCameraDrawerEnabled(org.id)
  if (initialPrivilege !== false) {
    throw new Error('Privilege should be false when set to false')
  }
  console.log('  -> Privilege successfully revoked (false).')

  await setCameraDrawerPrivilege(org.id, true)
  const grantedPrivilege = await isCameraDrawerEnabled(org.id)
  if (grantedPrivilege !== true) {
    throw new Error('Privilege should be true when set to true')
  }
  console.log('  -> Privilege successfully granted by SuperAdmin (true). [PASS]')

  // 3. Test Camera Mapping (Isolated strictly to this Admin / Counter - No Merging)
  console.log('\n[TEST 2] Testing Counter Overhead Camera Mapping...')
  const mapped = await saveStoreCameraMapping({
    organizationId: org.id,
    branchId: branch.id,
    userId: adminUser.id,
    cameraName: 'Counter 1 Overhead 4K Cam',
    deviceId: 'usb-cam-counter1-overhead-device-id',
    streamType: 'WEBCAM',
    autoOpenDrawer: true,
    captureOnOpen: true,
  })

  if (!mapped || mapped.deviceId !== 'usb-cam-counter1-overhead-device-id') {
    throw new Error('Camera mapping failed to save')
  }

  const fetchedMapping = await getStoreCameraMapping(org.id, adminUser.id)
  if (!fetchedMapping || fetchedMapping.cameraName !== 'Counter 1 Overhead 4K Cam') {
    throw new Error('Retrieved camera mapping does not match')
  }
  console.log(`  -> Camera mapped strictly to Admin ${adminUser.name} counter: ${fetchedMapping.cameraName} (${fetchedMapping.deviceId}). [PASS]`)

  // 4. Test Automated Cash Drawer Kick on Cash Collection & Microsecond Snapshot
  console.log('\n[TEST 3] Testing Cash Collection Drawer Kick & Snapshot Recording...')
  const mockSnapshot = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

  const autoEvent = await recordCashDrawerOpen({
    organizationId: org.id,
    branchId: branch.id,
    userId: adminUser.id,
    eventType: 'AUTO_CASH_COLLECTED',
    invoiceNumber: 'AMJ-TEST-INV-001',
    cashAmount: 45.5,
    snapshotData: mockSnapshot,
    deviceId: mapped.deviceId,
    notes: 'POS Cash Sale Finalization Kick',
  })

  if (!autoEvent || autoEvent.eventType !== 'AUTO_CASH_COLLECTED' || Number(autoEvent.cashAmount) !== 45.5) {
    throw new Error('Failed to record AUTO_CASH_COLLECTED event')
  }
  console.log(`  -> Recorded AUTO_CASH_COLLECTED Event (ID: ${autoEvent.id}) with cash amount 45.50 and snapshot. [PASS]`)

  const manualEvent = await recordCashDrawerOpen({
    organizationId: org.id,
    branchId: branch.id,
    userId: adminUser.id,
    eventType: 'MANUAL_ADMIN_OPEN',
    cashAmount: 0,
    snapshotData: mockSnapshot,
    deviceId: mapped.deviceId,
    notes: 'Admin Test Drawer Kick Pulse',
  })

  if (!manualEvent || manualEvent.eventType !== 'MANUAL_ADMIN_OPEN') {
    throw new Error('Failed to record MANUAL_ADMIN_OPEN event')
  }
  console.log(`  -> Recorded MANUAL_ADMIN_OPEN Event (ID: ${manualEvent.id}). [PASS]`)

  // 5. Test Strict 48-Hour (2-Day) Rolling Storage Retention & Auto-Purge
  console.log('\n[TEST 4] Testing Strict 2-Day (48-Hour) Storage Purge...')
  // Create an old event with createdAt older than 48 hours (e.g. 50 hours ago)
  const fiftyHoursAgo = new Date(Date.now() - (50 * 60 * 60 * 1000))
  const expiredEvent = await prisma.cashDrawerEvent.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      userId: adminUser.id,
      eventType: 'AUTO_CASH_COLLECTED',
      invoiceNumber: 'AMJ-EXPIRED-INV-OLD',
      cashAmount: 100,
      snapshotData: mockSnapshot,
      openedAt: fiftyHoursAgo,
      createdAt: fiftyHoursAgo,
    },
  })
  console.log(`  -> Created simulated event older than 48 hours (Created: ${expiredEvent.createdAt.toISOString()})`)

  const purgedCount = await purgeExpiredCameraStorage(org.id)
  console.log(`  -> Executed purgeExpiredCameraStorage. Purged expired records count: ${purgedCount}`)
  if (purgedCount < 1) {
    throw new Error('Failed to purge expired records older than 48 hours')
  }

  const checkPurged = await prisma.cashDrawerEvent.findUnique({
    where: { id: expiredEvent.id },
  })
  if (checkPurged !== null) {
    throw new Error('Expired event was NOT deleted by 48-hour retention purge!')
  }
  console.log('  -> Verified: Expired event permanently removed from PostgreSQL. [PASS]')

  // 6. Test Cash Drawer Analytics Aggregation
  console.log('\n[TEST 5] Testing Cash Drawer Analytics & Metrics...')
  const analytics = await getCashDrawerAnalytics(org.id, adminUser.id, false)
  console.log(`  -> Total Opens (48h): ${analytics.totalOpens48h}`)
  console.log(`  -> Today Opens: ${analytics.todayOpens}`)
  console.log(`  -> Cash Collected Opens: ${analytics.cashCollectedOpens}`)
  console.log(`  -> Manual Admin Opens: ${analytics.manualAdminOpens}`)
  console.log(`  -> Events List Count: ${analytics.events.length}`)

  if (analytics.totalOpens48h < 2 || analytics.cashCollectedOpens < 1 || analytics.manualAdminOpens < 1) {
    throw new Error('Analytics counts do not match recorded events')
  }
  console.log('  -> Analytics counts and events timeline validated successfully. [PASS]')

  console.log('\n===============================================================')
  console.log('>>> ALL IN-STORE CAMERA & CASH DRAWER TESTS PASSED (100%) <<<')
  console.log('===============================================================')
}

runVerification()
  .catch((err) => {
    console.error('\n[FATAL ERROR]', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
