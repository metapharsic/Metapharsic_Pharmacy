async function testAnalytics() {
  console.log('--- Testing Super-Admin Chemist Financial Analytics API ---')

  // 1. Fetch CSRF token
  const csrfRes = await fetch('http://localhost:5888/api/auth/csrf')
  const csrfData = await csrfRes.json()
  const csrfCookies = csrfRes.headers.getSetCookie
    ? csrfRes.headers.getSetCookie()
    : [csrfRes.headers.get('set-cookie') || '']
  const csrfCookie = csrfCookies.map(c => c.split(';')[0]).join('; ')
  console.log('✓ CSRF token obtained:', csrfData.csrfToken ? 'YES' : 'NO')

  // 2. Login as Super Admin
  const params = new URLSearchParams({
    csrfToken: csrfData.csrfToken,
    email: 'superadmin@pharmacare.local',
    password: 'SuperAdmin@123',
    redirect: 'false',
    callbackUrl: 'http://localhost:5888/platform',
    json: 'true',
  })

  const loginRes = await fetch('http://localhost:5888/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookie,
    },
    body: params.toString(),
  })

  const loginCookies = loginRes.headers.getSetCookie
    ? loginRes.headers.getSetCookie()
    : [loginRes.headers.get('set-cookie') || '']
  const allCookies = [...csrfCookies, ...loginCookies].map(c => c.split(';')[0]).join('; ')
  console.log('✓ Super-Admin Login status:', loginRes.status, 'Session cookie obtained:', allCookies.includes('next-auth.session-token'))

  const authHeaders = {
    Cookie: allCookies,
  }

  // 3. Fetch Platform Financial Analytics as Super Admin
  const analyticsRes = await fetch('http://localhost:5888/api/platform/analytics', {
    headers: authHeaders,
    redirect: 'manual'
  })
  console.log('✓ Analytics API status:', analyticsRes.status)
  const analyticsJson = await analyticsRes.json()
  console.log('✓ Analytics Response Success:', analyticsJson.success)

  if (analyticsJson.data) {
    console.log('\n--- Platform Executive Summary ---')
    console.log(JSON.stringify(analyticsJson.data.platformSummary, null, 2))

    console.log(`\n--- Individual Chemist Performance (${analyticsJson.data.chemists.length} Shops) ---`)
    for (const c of analyticsJson.data.chemists) {
      console.log(`\n🏪 Chemist: ${c.organizationName} [${c.organizationCode}] (${c.city || 'India'})`)
      console.log(`   Purchases Inward: ₹${c.purchases.totalAmount} (${c.purchases.billsCount} bills)`)
      console.log(`   Gross Sales:      ₹${c.sales.grossRevenue} (${c.sales.invoicesCount} invoices, ${c.sales.unitsSold} units)`)
      console.log(`   COGS:             ₹${c.profitability.cogs}`)
      console.log(`   Gross Profit:     ₹${c.profitability.grossProfit} (Margin: ${c.profitability.profitMarginPercent}%) [${c.profitability.healthTier}]`)
      console.log(`   Stock Valuation:  Cost: ₹${c.inventory.valuationAtCost} | Retail MRP: ₹${c.inventory.valuationAtMrp}`)
      console.log(`   Ledger:           Payables: ₹${c.ledger.accountsPayable} | Receivables: ₹${c.ledger.accountsReceivable}`)
      if (c.topMedicines && c.topMedicines.length > 0) {
        console.log(`   Top Profit Medicine: ${c.topMedicines[0].name} (Profit: ₹${c.topMedicines[0].profit}, ${c.topMedicines[0].marginPercent}% margin)`)
      }
    }
  } else {
    console.error('Error fetching analytics:', analyticsJson.error)
  }

  // 4. Test RBAC Security Boundary: Attempt to access as Apollo Admin (Regular Store Admin)
  console.log('\n--- Testing RBAC Security Boundary (Store Admin Access Attempt) ---')
  const apolloParams = new URLSearchParams({
    csrfToken: csrfData.csrfToken,
    email: 'apollo.admin@pharmacare.local',
    password: 'Apollo@123',
    redirect: 'false',
    callbackUrl: 'http://localhost:5888/dashboard',
    json: 'true',
  })

  const apolloLoginRes = await fetch('http://localhost:5888/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookie,
    },
    body: apolloParams.toString(),
  })
  const apolloLoginCookies = apolloLoginRes.headers.getSetCookie
    ? apolloLoginRes.headers.getSetCookie()
    : [apolloLoginRes.headers.get('set-cookie') || '']
  const apolloAllCookies = [...csrfCookies, ...apolloLoginCookies].map(c => c.split(';')[0]).join('; ')
  console.log('✓ Apollo Admin Login status:', apolloLoginRes.status)

  const apolloAttemptRes = await fetch('http://localhost:5888/api/platform/analytics', {
    headers: { Cookie: apolloAllCookies },
    redirect: 'manual'
  })
  console.log('✓ Apollo Admin Access Attempt Status:', apolloAttemptRes.status, '(Expected: 403 Forbidden)')
  const apolloAttemptJson = await apolloAttemptRes.json()
  console.log('✓ Apollo Admin Access Error Message:', apolloAttemptJson.error?.message)
}

testAnalytics().catch(console.error)
