# ==============================================================================
# MPharm - Setup Launcher Assets (Icon & Windows Shortcut)
# ==============================================================================
param(
    [string]$RootDir = "c:\metapharsic-pharmacy-complete"
)

$ErrorActionPreference = "Stop"

try {
    Add-Type -AssemblyName System.Drawing
    $pngPath = Join-Path $RootDir "public\logo.png"
    $icoPath = Join-Path $RootDir "mpharm.ico"
    $batPath = Join-Path $RootDir "MPharm.bat"
    $lnkPath = Join-Path $RootDir "MPharm.lnk"

    # 1. Create .ico from logo.png if needed or update
    if (Test-Path $pngPath) {
        $sourceBmp = [System.Drawing.Bitmap]::FromFile($pngPath)
        # Create standard icon size 256x256
        $iconBmp = New-Object System.Drawing.Bitmap(256, 256)
        $g = [System.Drawing.Graphics]::FromImage($iconBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($sourceBmp, 0, 0, 256, 256)
        $g.Dispose()

        $hIcon = $iconBmp.GetHicon()
        $iconObj = [System.Drawing.Icon]::FromHandle($hIcon)
        
        $fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
        $iconObj.Save($fs)
        $fs.Close()
        
        $iconObj.Dispose()
        $iconBmp.Dispose()
        $sourceBmp.Dispose()
        Write-Host "[OK] Created icon: $icoPath"
    } else {
        Write-Host "[WARN] Logo PNG not found at $pngPath"
    }

    # 2. Create Windows Shortcut (MPharm.lnk) in project root
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($lnkPath)
    $shortcut.TargetPath = $batPath
    $shortcut.WorkingDirectory = $RootDir
    $shortcut.Description = "MPharm - PharmaCare Pharmacy Management System"
    if (Test-Path $icoPath) {
        $shortcut.IconLocation = "$icoPath,0"
    }
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Write-Host "[OK] Created launcher shortcut: $lnkPath"

    # 2B. Create Windows Stop Shortcut (MPharm-Stop.lnk) in project root
    $stopBatPath = Join-Path $RootDir "MPharm-Stop.bat"
    $stopLnkPath = Join-Path $RootDir "MPharm-Stop.lnk"
    if (Test-Path $stopBatPath) {
        $stopShortcut = $wsh.CreateShortcut($stopLnkPath)
        $stopShortcut.TargetPath = $stopBatPath
        $stopShortcut.WorkingDirectory = $RootDir
        $stopShortcut.Description = "Stop MPharm - PharmaCare Application Server"
        $shell32 = Join-Path $env:SystemRoot "System32\shell32.dll"
        if (Test-Path $shell32) {
            $stopShortcut.IconLocation = "$shell32,27"
        } elseif (Test-Path $icoPath) {
            $stopShortcut.IconLocation = "$icoPath,0"
        }
        $stopShortcut.WindowStyle = 1
        $stopShortcut.Save()
        Write-Host "[OK] Created stop shortcut: $stopLnkPath"
    }

    # 3. Also check if Desktop shortcut can be placed
    $desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    if (Test-Path $desktopPath) {
        $desktopLnk = Join-Path $desktopPath "MPharm - PharmaCare.lnk"
        $dtShortcut = $wsh.CreateShortcut($desktopLnk)
        $dtShortcut.TargetPath = $batPath
        $dtShortcut.WorkingDirectory = $RootDir
        $dtShortcut.Description = "MPharm - PharmaCare Pharmacy Management System"
        if (Test-Path $icoPath) {
            $dtShortcut.IconLocation = "$icoPath,0"
        }
        $dtShortcut.WindowStyle = 1
        $dtShortcut.Save()
        Write-Host "[OK] Created desktop launcher shortcut: $desktopLnk"

        if (Test-Path $stopBatPath) {
            $desktopStopLnk = Join-Path $desktopPath "MPharm - Stop PharmaCare.lnk"
            $dtStopShortcut = $wsh.CreateShortcut($desktopStopLnk)
            $dtStopShortcut.TargetPath = $stopBatPath
            $dtStopShortcut.WorkingDirectory = $RootDir
            $dtStopShortcut.Description = "Stop MPharm - PharmaCare Application Server"
            $shell32 = Join-Path $env:SystemRoot "System32\shell32.dll"
            if (Test-Path $shell32) {
                $dtStopShortcut.IconLocation = "$shell32,27"
            } elseif (Test-Path $icoPath) {
                $dtStopShortcut.IconLocation = "$icoPath,0"
            }
            $dtStopShortcut.WindowStyle = 1
            $dtStopShortcut.Save()
            Write-Host "[OK] Created desktop stop shortcut: $desktopStopLnk"
        }
    }
} catch {
    Write-Host "[ERROR] Failed to setup launcher assets: $_"
    exit 1
}
