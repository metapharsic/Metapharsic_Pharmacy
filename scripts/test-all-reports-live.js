const http = require('http')

async function loginAndGetCookie() {
  const csrfRes = await new Promise((resolve) => {
    http.get('http://localhost:5888/api/auth/csrf', (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || []
        resolve({ json: JSON.parse(data), cookies })
      })
    })
  })

  const csrfToken = csrfRes.json.csrfToken
  const csrfCookie = csrfRes.cookies.map((c) => c.split(';')[0]).join('; ')

  const postData = new URLSearchParams({
    csrfToken: csrfToken,
    email: 'admin@pharmacare.local',
    password: 'Admin@123',
    callbackUrl: 'http://localhost:5888/',
    json: 'true',
  }).toString()

  const loginRes = await new Promise((resolve) => {
    const req = http.request(
      {
        host: 'localhost',
        port: 5888,
        path: '/api/auth/callback/credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          Cookie: csrfCookie,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data,
          })
        })
      }
    )
    req.write(postData)
    req.end()
  })

  const sessionCookies = loginRes.headers['set-cookie'] || []
  const sessionTokenCookie = sessionCookies.find((c) => c.includes('next-auth.session-token'))
  return sessionTokenCookie ? sessionTokenCookie.split(';')[0] : ''
}

async function run() {
  const cookie = await loginAndGetCookie()
  console.log('Session cookie acquired:', cookie ? 'YES' : 'NO')

  const urls = [
    // Sub-Pages
    '/reports',
    '/reports/sales',
    '/reports/compliance',
    '/reports/inventory',
    '/reports/narcotics',
    '/reports/supplier',
    // APIs
    '/api/reports/sales',
    '/api/reports/sales-detailed',
    '/api/reports/doctors',
    '/api/reports/prescriptions',
    '/api/reports/gross-profit',
    '/api/reports/schedule-h',
    '/api/reports/narcotics',
    '/api/reports/stock',
    '/api/reports/expiry',
    '/api/reports/supplier',
    '/api/reports/consumption',
  ]

  console.log('Testing all Report URLs and APIs on live server...')
  let failed = 0

  for (const url of urls) {
    const res = await fetch(`http://localhost:5888${url}`, {
      headers: { Cookie: cookie },
    })
    const isJson = (res.headers.get('content-type') || '').includes('json')
    let info = ''
    if (isJson) {
      const data = await res.json()
      info = `success: ${data.success}`
    } else {
      const text = await res.text()
      info = `${text.length} bytes (HTML)`
    }
    const status = res.status
    const ok = status === 200
    if (!ok) failed++
    console.log(`${ok ? '✓ PASS' : '✗ FAIL'} [HTTP ${status}] ${url} -> ${info}`)
  }

  console.log(`\nReport Endpoints Test: ${urls.length - failed}/${urls.length} Passed`)
  if (failed > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
