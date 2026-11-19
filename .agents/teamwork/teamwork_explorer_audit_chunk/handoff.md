# Investigation Report: Root Cause & Remediation of ChunkLoadError on `/inventory/audit`

## 1. Observation

### 1.1 Verbatim Error Reported by User
```text
7023-38f96106d50572d6.js:1 ChunkLoadError: Loading chunk 9194 failed.
(error: http://localhost:5888/_next/static/chunks/app/(dashboard)/inventory/audit/page-af7a5580052ef57e.js)
    at Object.j (webpack-fcd61f508aae644d.js:1:3261)
    at webpack-fcd61f508aae644d.js:1:1400
    at Array.reduce (<anonymous>)
    at d.e (webpack-fcd61f508aae644d.js:1:1366)
    at 7023-38f96106d50572d6.js:2:18878
    at 7023-38f96106d50572d6.js:2:19080
    at t (7023-38f96106d50572d6.js:2:19283)
push.10353.window.console.error @ 7023-38f96106d50572d6.js:1
```

### 1.2 Inspection of Source Files at `/inventory/audit`
- **File**: `c:\metapharsic-pharmacy-complete\src\app\(dashboard)\inventory\audit\page.tsx`
  ```tsx
  import type { Metadata } from 'next'
  import { InventoryAuditClient } from '@/components/inventory/inventory-audit-client'

  export const metadata: Metadata = {
    title: 'Inventory Audit & Stock Reconciliation | PharmaCare',
    description: 'Enterprise multi-threaded physical inventory audit, Schedule H1/X compliance, and cryptographic integrity verification.',
  }

  export default function InventoryAuditPage() {
    return (
      <div className="space-y-4">
        <InventoryAuditClient />
      </div>
    )
  }
  ```
  - **Syntax / Exports**: Fully valid React server component, proper `metadata` export, default export `InventoryAuditPage`.
  - **Related Files in Directory**: No local `layout.tsx`, `loading.tsx`, or `error.tsx` exist inside `src/app/(dashboard)/inventory/audit/`. Layout is provided by `src/app/(dashboard)/layout.tsx`.
  - **Component**: `src/components/inventory/inventory-audit-client.tsx` (1,722 lines). Correctly exports `export function InventoryAuditClient()`.
  - **Type Checking (`tsc --noEmit`)**: Evaluated via `npx tsc --noEmit -p tsconfig.json --skipLibCheck`. **Zero TypeScript errors** exist anywhere in `src/`. All errors reported by `tsc` were in non-runtime root/scripts folders (`generate_dummy.ts`, `prisma/seeds/`, `scripts/`).

### 1.3 Inspection of `.next` Build Manifests & Static Files on Disk
- **File**: `c:\metapharsic-pharmacy-complete\.next\BUILD_ID`
  - Current content on disk:
    ```text
    caSMTdjttHM6p5LJreuR_
    ```
  - File timestamp (`LastWriteTimeUtc`): `11/1/2026 6:22:34 PM UTC` (18:22:34 UTC).
- **Directory**: `c:\metapharsic-pharmacy-complete\.next\static\chunks\app\(dashboard)\inventory\audit\`
  - Only **one** chunk exists on disk:
    `page-19c4690bd47e20e3.js` (Size: 51,091 bytes, Last Modified: `11/1/2026 6:22:32 PM UTC`).
  - The chunk requested by the client, `page-af7a5580052ef57e.js`, **does not exist on disk anywhere**.
- **Manifest**: `c:\metapharsic-pharmacy-complete\.next\server\app\(dashboard)\inventory\audit\page_client-reference-manifest.js`
  - Explicitly maps Chunk ID **9194** to:
    ```json
    "9194","static/chunks/app/(dashboard)/inventory/audit/page-19c4690bd47e20e3.js"
    ```
- **Manifest**: `c:\metapharsic-pharmacy-complete\.next\app-build-manifest.json` (lines 380-396):
  ```json
  "/(dashboard)/inventory/audit/page": [
    "static/chunks/webpack-fcd61f508aae644d.js",
    "static/chunks/fd9d1056-35fa662b325501f1.js",
    "static/chunks/7023-38f96106d50572d6.js",
    "static/chunks/main-app-4aae7931eb1c8e25.js",
    "static/chunks/9247-bca36f89912d63b5.js",
    "static/chunks/9692-c47110830053440f.js",
    "static/chunks/3395-027c1335cefb386e.js",
    "static/chunks/5437-511904930f73eeca.js",
    "static/chunks/381-b07d2b462693e40e.js",
    "static/chunks/2342-07c98c920a8c9777.js",
    "static/chunks/1601-14a18ca62a81b228.js",
    "static/chunks/2240-65b15ae447fc841c.js",
    "static/chunks/7084-3849106e0828a2bb.js",
    "static/chunks/906-3959378470a03e19.js",
    "static/chunks/app/(dashboard)/inventory/audit/page-19c4690bd47e20e3.js"
  ]
  ```
  All 15 referenced chunk files were confirmed to exist on disk via `fs.existsSync`.

### 1.4 Active Background Processes & Server State on Port 5888
- **Process Check**:
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
  ```
  Found:
  - PID **28840**: `"C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" start`
  - PID **27912**: `"node" "C:\metapharsic-pharmacy-complete\node_modules\.bin\..\next\dist\bin\next" start -p 5888`
- **Creation Timestamps**:
  - PID 27912 was launched at: **Sunday, November 1, 2026 4:05:08 PM UTC (16:05:08 UTC)**.
  - Notice that PID 27912 was started **2 hours and 17 minutes BEFORE** the `next build` that generated the current `.next` files at **18:22:32 UTC**.
- **Empirical Server Verification**:
  Requesting the stale chunk directly from the running server:
  ```powershell
  curl.exe -i -s "http://127.0.0.1:5888/_next/static/chunks/app/(dashboard)/inventory/audit/page-af7a5580052ef57e.js"
  ```
  Output:
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: text/html; charset=utf-8
  Content-Length: 1987

  <!DOCTYPE html><html><head>...
  <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"statusCode":400}},"page":"/_error","query":{},"buildId":"Tu0GhpGB4sSZsBD9c8MlF","isFallback":false,"isExperimentalCompile":false,"gip":true,"scriptLoader":[]}</script>
  ```
  The running server returned HTTP 400 and explicitly reported its active in-memory Build ID as:
  `"buildId": "Tu0GhpGB4sSZsBD9c8MlF"`.

---

## 2. Logic Chain

1. **Premise 1**: Next.js in production mode (`next start`) loads build manifests, chunk hashes, and route configurations into process memory upon startup.
2. **Premise 2**: At **16:05:08 UTC**, `next start -p 5888` (PID 27912) was booted from an earlier build whose Build ID was `Tu0GhpGB4sSZsBD9c8MlF`. Under that build, chunk `9194` (the route bundle for `app/(dashboard)/inventory/audit/page`) was named `page-af7a5580052ef57e.js`.
3. **Premise 3**: At **18:22:32 UTC**, a production build command (`npm run build`) was executed on the filesystem. This build generated a new Build ID (`caSMTdjttHM6p5LJreuR_`), recompiled chunk `9194` to `page-19c4690bd47e20e3.js`, and purged the old chunk file (`page-af7a5580052ef57e.js`) from `.next/static/chunks/app/(dashboard)/inventory/audit/`.
4. **Premise 4**: The server process PID 27912 was **never restarted** following the 18:22:32 UTC build. It continued running in memory with Build ID `Tu0GhpGB4sSZsBD9c8MlF`.
5. **Premise 5**: At **04:32:16 UTC**, a client browser connected to `http://localhost:5888` executed client-side navigation or requested the chunk corresponding to `app/(dashboard)/inventory/audit/page`. The client router, operating on the manifests served by the un-restarted server or cached in the browser session, dispatched an HTTP GET request for `/_next/static/chunks/app/(dashboard)/inventory/audit/page-af7a5580052ef57e.js`.
6. **Premise 6**: Because the physical file `page-af7a5580052ef57e.js` was deleted from disk during the subsequent build, the Next.js server rejected the request with `HTTP 400 Bad Request`.
7. **Conclusion**: Webpack's client-side chunk loader (`webpack-fcd61f508aae644d.js:1:3261`) threw `ChunkLoadError: Loading chunk 9194 failed` because the requested static chunk had been removed from disk by a subsequent build while the server process remained stuck on the previous build.

---

## 3. Caveats

1. **No Application Source Code Flaw**: There are no syntax errors, circular dependencies, missing exports, or build compilation failures in `src/app/(dashboard)/inventory/audit/page.tsx` or `src/components/inventory/inventory-audit-client.tsx`. The code itself compiles and packages cleanly.
2. **Development vs. Production Mode Conflict**: `package.json` defines `"dev": "next dev -p 5888"` and `"start": "next start -p 5888"`. Both share port `5888`. Because `npm start` (PID 28840 / 27912) was running in the background, attempting to run `npm run dev` would result in an `EADDRINUSE` port collision.
3. **Lack of ChunkLoadError Recovery Handler**: The application does not currently have a route-level `error.tsx` in `src/app/(dashboard)/inventory/audit/` or a root `error.tsx` / `global-error.tsx` configured to intercept `ChunkLoadError` and trigger an automatic cache-bust reload (`window.location.reload()`).

---

## 4. Conclusion

The `ChunkLoadError: Loading chunk 9194 failed` on `/inventory/audit` is **not a code syntax, module resolution, or compilation bug**.

It is an **out-of-sync process and filesystem state (Deployment / Build Skew)**:
- **Root Cause**: The Next.js production server process (PID `27912`) has been running continuously since **16:05:08 UTC** using Build ID `Tu0GhpGB4sSZsBD9c8MlF`. When `npm run build` was run at **18:22:32 UTC**, the `.next` directory on disk was completely overwritten with a new build (`caSMTdjttHM6p5LJreuR_`), deleting `page-af7a5580052ef57e.js` and creating `page-19c4690bd47e20e3.js`. Because PID 27912 was not terminated or restarted, incoming requests for the old chunk failed with HTTP 400/404, throwing the `ChunkLoadError`.

### Remediation Steps

#### Step 1: Terminate the Stale Background Node Server Process
Kill the stale background `next start` process holding port 5888:
```powershell
Stop-Process -Id 27912 -Force
Stop-Process -Id 28840 -Force
```

#### Step 2: Restart Next.js in the Appropriate Mode
- **If operating in Development Mode** (as indicated in `ORIGINAL_REQUEST.md: "Integrity mode: development"`):
  ```powershell
  npm run dev
  ```
  `next dev` will compile chunks on demand and maintain HMR without static hash drift.
- **If operating in Production Mode**:
  ```powershell
  npm run build
  npm start
  ```
  This ensures the server memory and `.next/` disk manifests have matching Build IDs.

#### Step 3: Hard Reload the Browser
In the client browser, perform a hard reload (`Ctrl + F5` or `Ctrl + Shift + R`) to purge old cached chunks and fetch the updated HTML and chunk manifests.

#### Step 4: Recommended Architectural Enhancement (ChunkLoadError Auto-Recovery)
To permanently insulate clients against `ChunkLoadError` during future builds and deployments, add an `error.tsx` error boundary under `src/app/(dashboard)/error.tsx` or `src/app/(dashboard)/inventory/audit/error.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // If chunk failed to load due to a new deployment, auto-reload once to fetch fresh assets
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      const lastReload = sessionStorage.getItem('chunk_reload_ts')
      const now = Date.now()
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('chunk_reload_ts', now.toString())
        window.location.reload()
      }
    }
  }, [error])

  return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4 text-center">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">
        {error.message.includes('Loading chunk')
          ? 'A newer version of the application was deployed. Please reload.'
          : error.message}
      </p>
      <Button onClick={() => window.location.reload()}>Reload Page</Button>
    </div>
  )
}
```

---

## 5. Verification Method

To independently verify this analysis:

1. **Verify PID 27912 Start Time vs Build Time**:
   ```powershell
   Get-CimInstance Win32_Process -Filter "ProcessId = 27912" | Select-Object ProcessId, @{N='StartTimeUtc';E={$_.CreationDate.ToUniversalTime()}}, CommandLine
   Get-Item .next\BUILD_ID | Select-Object Name, LastWriteTimeUtc
   ```
   *Expected result*: PID 27912 StartTimeUtc is ~16:05 UTC, whereas `BUILD_ID` LastWriteTimeUtc is ~18:22 UTC.

2. **Verify That Current Chunk on Disk is `page-19c4690bd47e20e3.js` and Stale Chunk is Missing**:
   ```powershell
   Test-Path ".next\static\chunks\app\(dashboard)\inventory\audit\page-19c4690bd47e20e3.js"
   Test-Path ".next\static\chunks\app\(dashboard)\inventory\audit\page-af7a5580052ef57e.js"
   ```
   *Expected result*: `True` for `page-19c4690bd47e20e3.js`, `False` for `page-af7a5580052ef57e.js`.

3. **Verify Server Build ID Mismatch via HTTP Request**:
   ```powershell
   curl.exe -i -s "http://127.0.0.1:5888/_next/static/chunks/app/(dashboard)/inventory/audit/page-af7a5580052ef57e.js" | Select-String "buildId"
   ```
   *Expected result*: Contains `"buildId":"Tu0GhpGB4sSZsBD9c8MlF"`, which does not match `.next\BUILD_ID` (`caSMTdjttHM6p5LJreuR_`).
