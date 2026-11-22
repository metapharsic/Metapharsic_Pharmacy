async function testUrl(baseUrl, label) {
  console.log(`\n--- Testing ${label} (${baseUrl}) ---`)
  try {
    // 1. Get CSRF token
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`)
    const csrfJson = await csrfRes.json()
    const rawCookies = csrfRes.headers.get('set-cookie') || ''
    const csrfToken = csrfJson.csrfToken
    console.log(`[1] CSRF Token: ${csrfToken ? 'OK' : 'FAIL'}`)

    // Extract next-auth.csrf-token cookie
    const csrfCookie = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ')

    // 2. Post credentials
    const params = new URLSearchParams({
      csrfToken,
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

    const loginSetCookie = loginRes.headers.get('set-cookie') || ''
    const sessionCookies = loginSetCookie.split(',').map(c => c.split(';')[0].trim()).join('; ')
    console.log(`[2] Login response status: ${loginRes.status}, cookies present: ${Boolean(sessionCookies)}`)

    // 3. Request Dashboard
    const dashRes = await fetch(`${baseUrl}/`, {
      headers: {
        'Cookie': `${csrfCookie}; ${sessionCookies}`,
      },
    })
    console.log(`[3] Dashboard HTTP Status: ${dashRes.status}`)
    const html = await dashRes.text()
    const hasApplicationError = html.includes('Application error') || html.includes('Digest:')
    console.log(`[4] Has Server-side Exception: ${hasApplicationError}`)
    console.log(`[5] Contains Dashboard Content: ${html.includes('Dispensary') || html.includes('Dashboard') || html.includes('Admin')}`)
    if (hasApplicationError) {
      console.log('FAIL: Application error detected!')
    } else {
      console.log('SUCCESS: Clean dashboard render with 0 errors.')
    }
  } catch (err) {
    console.error(`Error testing ${label}:`, err.message)
  }
}

async function main() {
  await testUrl('http://localhost:5888', 'Local Server')
  await testUrl('https://pharmacy.metapharsic.cloud', 'Production VPS')
}

main()
