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

async function testParallelFetch() {
  const cookie = await loginAndGetCookie();
  console.log('Testing /api/db/parallel-fetch with auth cookie...');

  const result = await new Promise((resolve) => {
    http.get({
      host: 'localhost',
      port: 5888,
      path: '/api/db/parallel-fetch',
      headers: {
        'Cookie': cookie
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
  });

  console.log('HTTP Status:', result.statusCode);
  console.log('Response:', result.body);
}

testParallelFetch().catch(console.error);

