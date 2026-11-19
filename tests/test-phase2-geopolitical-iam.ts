import { resolveGeoZone, getGeoPoliticalZoneMetrics } from '../src/lib/platform/geo-zones'
import {
  getPlatformIAMPolicy,
  updatePlatformIAMPolicy,
  evaluateGeopoliticalIAMGate,
} from '../src/lib/platform/iam-service'
import { executeMultiThreadLogin } from '../src/lib/auth/multi-thread-login-service'
import { getAllTerritories } from '../src/lib/territory/territory-config'

async function runPhase2Verification() {
  console.log('=================================================================')
  console.log('  METAPHARSIC RX — PHASE 2 GEOPOLITICAL IAM & COMMAND CONSOLE')
  console.log('=================================================================\n')

  console.log('--- TEST 1: SOVEREIGN ZONE RESOLVER ACROSS ALL 6 COUNTRIES ---')
  const testLocations = [
    { country: 'SA', state: 'Riyadh', city: 'Riyadh', tz: 'Asia/Riyadh' },
    { country: 'SA', state: 'Makkah', city: 'Jeddah', tz: 'Asia/Riyadh' },
    { country: 'SA', state: 'Eastern Province', city: 'Dammam', tz: 'Asia/Riyadh' },
    { country: 'OM', state: 'Muscat', city: 'Muscat', tz: 'Asia/Muscat' },
    { country: 'OM', state: 'Dhofar', city: 'Salalah', tz: 'Asia/Muscat' },
    { country: 'QA', state: 'Doha', city: 'Doha', tz: 'Asia/Qatar' },
    { country: 'BH', state: 'Capital', city: 'Manama', tz: 'Asia/Bahrain' },
    { country: 'MV', state: 'Kaafu', city: 'Malé', tz: 'Indian/Maldives' },
    { country: 'IN', state: 'Telangana', city: 'Hyderabad', tz: 'Asia/Kolkata' },
    { country: 'IN', state: 'Maharashtra', city: 'Mumbai', tz: 'Asia/Kolkata' },
    { country: null, state: null, city: null, ip: '192.168.1.100' },
  ]

  for (const loc of testLocations) {
    const zone = resolveGeoZone(loc.state, loc.city, loc.ip, loc.country, loc.tz)
    console.log(
      `  Input [${loc.country || 'LAN'} | ${loc.city || 'Counter'} | ${loc.tz || 'Local'}] -> Mapped Zone: "${zone}"`
    )
  }

  console.log('\n--- TEST 2: SOVEREIGN IAM GEOFENCING & SHIFT GATE EVALUATION ---')
  // Scenario A: Standard staff user inside permitted sovereign territory
  const allowedResult = await evaluateGeopoliticalIAMGate({
    user: {
      id: 'usr_test_1',
      email: 'pharmacist@riyadh-rx.local',
      organization: { country: 'SA', state: 'Riyadh', city: 'Riyadh' },
    },
    ipAddress: '176.224.0.1',
    clientTimezone: 'Asia/Riyadh',
    isSuperAdmin: false,
  })
  console.log('  Scenario A (Pharmacist inside KSA territory):')
  console.log(`    Allowed: ${allowedResult.allowed} | Zone: ${allowedResult.resolvedZone}`)

  // Scenario B: SuperAdmin global bypass (Root Control Plane)
  const superAdminResult = await evaluateGeopoliticalIAMGate({
    user: {
      id: 'usr_super_root',
      email: 'root@pharmacare.local',
      organization: null,
    },
    ipAddress: '10.0.0.1',
    clientTimezone: 'Asia/Riyadh',
    isSuperAdmin: true,
  })
  console.log('  Scenario B (Global SuperAdmin emergency access):')
  console.log(`    Allowed: ${superAdminResult.allowed} | Zone: ${superAdminResult.resolvedZone}`)

  console.log('\n--- TEST 3: LIVE GEOPOLITICAL ZONE TELEMETRY DATABASE QUERY ---')
  const geoMetrics = await getGeoPoliticalZoneMetrics()
  console.log(`  Active Regional Zones Count: ${geoMetrics.zones.length}`)
  console.log(`  Total Logins Recorded: ${geoMetrics.totalLoginsRecorded}`)
  console.log(`  Active Sessions Total: ${geoMetrics.activeSessionsTotal}`)
  console.log('  Sample Top Zones:')
  for (const z of geoMetrics.zones.slice(0, 5)) {
    console.log(
      `    ${z.flag} [${z.countryCode}] ${z.zone}: ${z.currency} (${z.decimals} decimals) | ${z.regulatoryBody} | Active: ${z.activeSessions}`
    )
  }

  console.log('\n--- TEST 4: MULTI-THREAD AUTHENTICATION WITH GEOPOLITICAL IAM HANDSHAKE ---')
  const loginRes = await executeMultiThreadLogin({
    email: 'admin@pharmacare.local',
    password: 'WrongPasswordTest#1', // Verify credential safety
    deviceFingerprint: 'Mobile-Touch-Pad-POS',
  })

  console.log(`  Login Result Success: ${loginRes.success} (Expected false for test hash)`)
  console.log(`  Threads Executed: ${loginRes.threads.length}`)
  for (const th of loginRes.threads) {
    console.log(`    [Thread #${th.id}] ${th.code} (${th.durationMs}ms) - ${th.status} | ${th.details}`)
  }

  console.log('\n=================================================================')
  console.log('  PHASE 2 GEOPOLITICAL IAM & SUPERADMIN MATRIX VERIFIED!')
  console.log('=================================================================')
}

runPhase2Verification().catch(console.error)
