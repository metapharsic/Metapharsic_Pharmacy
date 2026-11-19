const fs = require('fs');
let code = fs.readFileSync('src/app/api/branches/route.ts', 'utf8');
const postIdx = code.indexOf('export async function POST');
if (postIdx !== -1) {
  const authIdx = code.indexOf('await requireAuth()', postIdx);
  if (authIdx !== -1) {
    code = code.slice(0, authIdx) + 'await requirePermission(PERMISSIONS.BRANCHES_MANAGE)' + code.slice(authIdx + 'await requireAuth()'.length);
    fs.writeFileSync('src/app/api/branches/route.ts', code, 'utf8');
    console.log('Fixed POST in branches/route.ts');
  }
}

