$urls = @(
    'http://localhost:5888/login',
    'http://localhost:5888/pos',
    'http://localhost:5888/products',
    'http://localhost:5888/inventory',
    'http://localhost:5888/reports',
    'http://localhost:5888/sales',
    'http://localhost:5888/batches'
)

Write-Host "`nBenchmarking MPharm High-Speed Page Loads..." -ForegroundColor Cyan
foreach ($u in $urls) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 0
    try {
        $res = Invoke-WebRequest -Uri $u -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
        $status = $res.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        } else {
            $status = 500
        }
    }
    $sw.Stop()
    $ms = $sw.ElapsedMilliseconds
    $color = if ($ms -lt 100) { "Green" } elseif ($ms -lt 500) { "Yellow" } else { "Red" }
    Write-Host ("  {0,-36} Status: {1} | Response Time: {2,4} ms" -f $u, $status, $ms) -ForegroundColor $color
}
Write-Host ""
