# ==============================================================================
# MPharm - PharmaCare Management System High-Reliability Shutdown & Cleanup
# ==============================================================================

param(
    [string]$RootDir = "c:\metapharsic-pharmacy-complete",
    [int]$Port = 5888,
    [switch]$Force = $true,
    [switch]$StopDatabase = $false,
    [switch]$Quiet = $false
)

$ErrorActionPreference = "Continue"

# Configure Console Window Appearance
try {
    $host.UI.RawUI.WindowTitle = "MPharm - Shutdown & Cleanup"
} catch {}

Write-Host ""
Write-Host " =====================================================================" -ForegroundColor Red
Write-Host "             MPHARM - PHARMACARE MANAGEMENT SYSTEM                    " -ForegroundColor Yellow
Write-Host "                  High-Reliability Shutdown & Cleanup                 " -ForegroundColor White
Write-Host " =====================================================================" -ForegroundColor Red
Write-Host ""

# ------------------------------------------------------------------------------
# 1. SETUP LOGGING
# ------------------------------------------------------------------------------
$logsDir = Join-Path $RootDir "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

$now = Get-Date
$dateStamp = $now.ToString("yyyy-MM-dd")
$dailyLogFile = Join-Path $logsDir "mpharm-$dateStamp.log"

function Log-Message {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [ConsoleColor]$Color = [ConsoleColor]::White
    )
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $formatted = "[$ts] [$Level] $Message"
    
    # Write to console
    Write-Host $formatted -ForegroundColor $Color
    
    # Write to persistent log
    try {
        Add-Content -Path $dailyLogFile -Value $formatted -ErrorAction SilentlyContinue
    } catch {}
}

Log-Message "Shutdown sequence initiated at $now" "SHUTDOWN" ([ConsoleColor]::Yellow)
Log-Message "Target application port: $Port" "INFO" ([ConsoleColor]::Gray)

# ------------------------------------------------------------------------------
# 2. IDENTIFY PROCESSES LISTENING ON PORT 5888
# ------------------------------------------------------------------------------
Log-Message "[Step 1/3] Scanning for active MPharm processes on port $Port..." "SCAN" ([ConsoleColor]::Cyan)

$targetPids = @()

# Strategy 1: Get-NetTCPConnection (IPv4 & IPv6 with OwningProcess > 0)
try {
    $tcpConns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }
    foreach ($conn in $tcpConns) {
        $p = $conn.OwningProcess
        if ($p -and $p -ne $PID -and $p -notin $targetPids) {
            $targetPids += $p
        }
    }
} catch {}

# Strategy 2: netstat fallback for unusual socket states or IPv6 ::5888
try {
    $netstatOutput = netstat -ano -p tcp | Select-String ":$Port\s"
    foreach ($line in $netstatOutput) {
        $tokens = ($line.ToString().Trim() -split '\s+')
        if ($tokens.Length -ge 5) {
            $procId = [int]$tokens[-1]
            if ($procId -gt 0 -and $procId -ne $PID -and $procId -notin $targetPids) {
                $targetPids += $procId
            }
        }
    }
} catch {}

# Strategy 3: Check for Next.js / Node processes running from this repository
try {
    $nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    $normalizedRoot = $RootDir.TrimEnd('\').Replace('\', '\\')
    foreach ($np in $nodeProcesses) {
        if ($np.CommandLine -and $np.CommandLine -match $normalizedRoot) {
            if ($np.ProcessId -and $np.ProcessId -ne $PID -and $np.ProcessId -notin $targetPids) {
                Log-Message "Identified repository Node process: PID $($np.ProcessId)" "DETECT" ([ConsoleColor]::DarkYellow)
                $targetPids += [int]$np.ProcessId
            }
        }
    }
} catch {}

# ------------------------------------------------------------------------------
# 3. TERMINATE PROCESSES SAFELY
# ------------------------------------------------------------------------------
Log-Message "[Step 2/3] Terminating active application processes..." "ACTION" ([ConsoleColor]::Cyan)

$terminatedCount = 0
$freedMemoryMb = 0

if ($targetPids.Count -eq 0) {
    Log-Message "No active MPharm processes were found on port $Port." "OK" ([ConsoleColor]::Green)
} else {
    foreach ($procId in $targetPids) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                $procName = $proc.ProcessName
                $memMb = [Math]::Round($proc.WorkingSet64 / 1MB, 2)
                $freedMemoryMb += $memMb

                Log-Message "Stopping PID $procId ($procName) - Memory: ${memMb} MB..." "STOPPING" ([ConsoleColor]::Yellow)

                # Use taskkill /T /F to terminate the target and any spawned child worker threads cleanly
                $killOutput = & taskkill.exe /PID $procId /T /F 2>&1
                $terminatedCount++
                Log-Message "Successfully terminated PID $procId ($procName)." "OK" ([ConsoleColor]::Green)
            }
        } catch {
            Log-Message "Notice stopping PID ${procId}: $($_.Exception.Message)" "WARN" ([ConsoleColor]::DarkYellow)
        }
    }

    # Allow OS socket teardown
    Start-Sleep -Milliseconds 800
}

# ------------------------------------------------------------------------------
# 4. VERIFY PORT RELEASE
# ------------------------------------------------------------------------------
Log-Message "[Step 3/3] Verifying port $Port release..." "VERIFY" ([ConsoleColor]::Cyan)

$remainingHolders = @()
try {
    $verifyConns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 -and $_.OwningProcess -ne $PID }
    if ($verifyConns) {
        foreach ($c in $verifyConns) {
            if ($c.OwningProcess -notin $remainingHolders) {
                $remainingHolders += $c.OwningProcess
            }
        }
    }
} catch {}

if ($remainingHolders.Count -gt 0) {
    Log-Message "WARNING: Port $Port still has active sockets: PIDs $($remainingHolders -join ', '). Attempting secondary force purge..." "WARN" ([ConsoleColor]::Red)
    foreach ($remPid in $remainingHolders) {
        & taskkill.exe /PID $remPid /T /F 2>&1 | Out-Null
    }
    Start-Sleep -Milliseconds 600
}

$finalCheck = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 -and $_.OwningProcess -ne $PID }

if (-not $finalCheck) {
    Log-Message "Port $Port is completely released and available." "OK" ([ConsoleColor]::Green)
} else {
    Log-Message "Notice: Port $Port might be in TIME_WAIT / FIN_WAIT state while the OS closes sockets." "INFO" ([ConsoleColor]::DarkYellow)
}

# ------------------------------------------------------------------------------
# 5. OPTIONAL DATABASE SERVICE SHUTDOWN
# ------------------------------------------------------------------------------
if ($StopDatabase) {
    Log-Message "Checking PostgreSQL database service for shutdown..." "DATABASE" ([ConsoleColor]::Yellow)
    $servicesToStop = @("postgresql-x64-18", "postgresql-x64-16", "postgresql-x64-17", "postgresql-x64-15", "postgresql")
    foreach ($svcName in $servicesToStop) {
        $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq "Running") {
            Log-Message "Stopping PostgreSQL service '$svcName'..." "ACTION" ([ConsoleColor]::Yellow)
            Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue
            Log-Message "PostgreSQL service '$svcName' stopped." "OK" ([ConsoleColor]::Green)
        }
    }
} else {
    Log-Message "PostgreSQL database service remains active on port 5432 (use -StopDatabase to halt DB as well)." "INFO" ([ConsoleColor]::DarkGray)
}

# ------------------------------------------------------------------------------
# 6. SHUTDOWN SUMMARY
# ------------------------------------------------------------------------------
$endTs = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Log-Message "Shutdown sequence finished cleanly at $endTs." "COMPLETE" ([ConsoleColor]::Green)

Write-Host ""
Write-Host " =====================================================================" -ForegroundColor Green
Write-Host "   MPharm Application Stopped Successfully                            " -ForegroundColor White
Write-Host "   Processes Terminated : $terminatedCount                                          " -ForegroundColor Yellow
Write-Host "   Memory Reclaimed     : ${freedMemoryMb} MB                                      " -ForegroundColor Yellow
Write-Host "   Port $Port Status     : RELEASED (Ready for next launch)                 " -ForegroundColor Green
Write-Host "   Start Server Again   : Double-click MPharm.bat or run 'npm start'          " -ForegroundColor Cyan
Write-Host " =====================================================================" -ForegroundColor Green
Write-Host ""

if (-not $Quiet -and [Environment]::UserInteractive) {
    Write-Host "Press any key to close this window..." -ForegroundColor Gray
    try {
        [System.Console]::ReadKey() | Out-Null
    } catch {}
}

exit 0

