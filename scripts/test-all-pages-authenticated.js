const http = require('http');

async function loginAndGetCookie() {
  const csrfRes = await new Promise((resolve) => {
    http.get('http://localhost:5888/api/auth/csrf', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ json: JSON.parse(data), cookies });
      });
    });
  });

  const csrfToken = csrfRes.json.csrfToken;
  const csrfCookie = csrfRes.cookies.map(c => c.split(';')[0]).join('; ');

  const postData = new URLSearchParams({
    csrfToken: csrfToken,
    email: 'admin@pharmacare.local',
    password: 'Admin@123',
    callbackUrl: 'http://localhost:5888/',
    json: 'true'
  }).toString();

  const loginRes = await new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: 5888,
      path: '/api/auth/callback/credentials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': csrfCookie,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.write(postData);
    req.end();
  });

  const sessionCookieHeader = loginRes.headers['set-cookie'] || [];
  const sessionToken = sessionCookieHeader.find(c => c.startsWith('next-auth.session-token='));
  return sessionToken ? sessionToken.split(';')[0] : '';
}

const routes = [
  // Dashboard & POS
  '/',
  '/pos',
  '/pos2',
  
  // Products
  '/products',
  '/products/categories',
  '/products/hsn-codes',
  
  // Inventory
  '/inventory',
  '/inventory/adjustments',
  '/inventory/movements',
  '/batches',
  
  // Purchases
  '/purchases',
  '/purchases/agency',
  '/suppliers',
  
  // Sales & Rx
  '/sales',
  '/prescriptions',
  '/prescriptions/pending',
  '/customers',
  '/doctors',
  
  // Returns
  '/returns/sales',
  '/purchases/returns',
  
  // Expiry
  '/expiry',
  '/expiry/expiring',
  '/expiry/expired',
  
  // Financials
  '/finance',
  '/finance/vouchers/receipt',
  '/finance/receivables',
  '/finance/payables',
  '/finance/tally',
  '/gst',
  
  // Reports
  '/reports',
  '/reports/compliance',
  
  // System
  '/users',
  '/roles',
  '/audit',
  '/settings'
];

async function checkPage(path, cookie) {
  return new Promise((resolve) => {
    const req = http.get({
      host: 'localhost',
      port: 5888,
      path: path,
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const hasError = body.includes('Application error') || body.includes('server-side exception') || body.includes('Digest:');
        const digestMatch = body.match(/Digest:\s*([0-9]+)/i);
        resolve({
          path,
          status: res.statusCode,
          hasError,
          digest: digestMatch ? digestMatch[1] : null,
          length: body.length,
          bodySnippet: hasError ? body.slice(0, 500) : ''
        });
      });
    });
    req.on('error', (err) => resolve({ path, status: 'ERR', error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ path, status: 'TIMEOUT' }); });
  });
}

async function main() {
  console.log('Logging in to port 5888...');
  const cookie = await loginAndGetCookie();
  console.log('Got session cookie length:', cookie.length);

  console.log('Testing all pages with authenticated session...\n');

  let passed = 0;
  let failed = 0;
  for (const r of routes) {
    const res = await checkPage(r, cookie);
    const ok = (res.status === 200 && !res.hasError);
    const mark = ok ? '✓ OK' : '✗ FAIL';
    if (ok) passed++; else failed++;
    console.log(
      `${mark} | ${r.padEnd(28)} | HTTP ${String(res.status).padEnd(3)} | Crash: ${res.hasError ? ('YES (Digest: ' + res.digest + ')') : 'No '} | Size: ${res.length || 0} bytes`
    );
    if (res.hasError) {
      console.log('   -> Snippet:', res.bodySnippet.replace(/\n/g, ' '));
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${routes.length} total pages.`);
}

main().catch(console.error);
