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
    '/api/settings',
    '/api/organization',
    '/api/users',
    '/api/roles',
    '/api/permissions',
    '/api/branches',
  ]

  console.log('Testing Settings & Users APIs on live server...')
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
      if (url === '/api/settings') {
        info += `, settings: ${data.data?.settings?.length}, audit: ${data.data?.audit?.status}`
      }
      if (url === '/api/organization') {
        info += `, name: "${data.data?.name}", dlNumber: "${data.data?.dlNumber}", gstin: "${data.data?.gstin}"`
      }
      if (url === '/api/users') {
        info += `, users: ${data.data?.length}, with branch: ${data.data?.filter(u => u.branch).length}`
      }
    } else {
      const text = await res.text()
      info = `${text.length} bytes (HTML)`
    }
    const status = res.status
    const ok = status === 200
    if (!ok) failed++
    console.log(`${ok ? '✓ PASS' : '✗ FAIL'} [HTTP ${status}] ${url} -> ${info}`)
  }

  // Also test PUT /api/organization (Save settings test)
  console.log('\nTesting PUT /api/organization (Settings update)...')
  const updateRes = await fetch('http://localhost:5888/api/organization', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: 'PharmaCare Medical Store',
      legalName: 'PharmaCare Medical Store Pvt. Ltd.',
      gstin: '29ABCDE1234F1Z5',
      dlNumber: 'DL-KA-12345',
      settings: {
        invoicePrefix: 'PC-HO-',
        receiptFooter: 'Thank you for trusting PharmaCare. Get well soon!',
        lowStockThreshold: '10',
        expiryAlertDays: '90',
      },
    }),
  })
  const updateJson = await updateRes.json()
  const putOk = updateRes.status === 200 && updateJson.success
  if (!putOk) failed++
  console.log(`${putOk ? '✓ PASS' : '✗ FAIL'} [HTTP ${updateRes.status}] PUT /api/organization -> success: ${updateJson.success}, message: "${updateJson.message}"`)

  console.log(`\nSettings & Users Live Test: ${urls.length + 1 - failed}/${urls.length + 1} Passed`)
  if (failed > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

