async function testExports(baseUrl = 'https://pharmacy.metapharsic.cloud') {
  console.log(`\n--- Testing Ledger & Accounts CSV Exports on ${baseUrl} ---`)

  // 1. Authenticate as admin
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`)
  const csrfJson = await csrfRes.json()
  const rawCookies = csrfRes.headers.get('set-cookie') || ''
  const csrfCookie = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ')

  const params = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email: 'admin@pharmacare.local',
    password: 'Admin@123',
    json: 'true',
    redirect: 'false',
  })

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookie,
    },
    body: params,
  })
  const sessionCookies = (loginRes.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).join('; ')
  const cookieHeader = `${csrfCookie}; ${sessionCookies}`

  const types = [
    'sales',
    'purchases',
    'daybook',
    'customers',
    'suppliers',
    'stock_items',
    'debit_notes',
    'units',
    'price_lists',
    'company_setup',
    'gstr1',
    'batch_summary',
  ]

  let allPassed = true
  for (const t of types) {
    // Test default format (should be CSV)
    const res = await fetch(`${baseUrl}/api/tally/export?type=${t}`, {
      headers: { 'Cookie': cookieHeader },
    })
    const contentType = res.headers.get('content-type') || ''
    const disposition = res.headers.get('content-disposition') || ''
    const text = await res.text()
    const isCsv = contentType.includes('csv') || disposition.includes('.csv')
    const firstLine = text.split(/\r?\n/)[0]
    console.log(`[Package: ${t.padEnd(14)}] Status: ${res.status} | Content-Type: ${contentType.padEnd(23)} | Filename: ${disposition.slice(20, 55).padEnd(35)} | Headers: ${firstLine.slice(0, 40)}...`)
    if (!isCsv || res.status !== 200) {
      console.error(`❌ FAILED for ${t}`)
      allPassed = false
    }
  }

  if (allPassed) {
    console.log('\n🎉 ALL 12 PACKAGES SUCCESSFULLY EXPORT TO CSV BY DEFAULT!')
  } else {
    console.error('\n⚠️ SOME PACKAGES FAILED!')
    process.exit(1)
  }
}

testExports().catch(console.error)
