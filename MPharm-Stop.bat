@echo off
title MPharm - Shutdown and Cleanup
color 0C

cd /d "%~dp0"

set "EXTRA_ARGS="
if /i "%~1"=="--db" set "EXTRA_ARGS=-StopDatabase"
if /i "%~1"=="-db" set "EXTRA_ARGS=-StopDatabase"
if /i "%~1"=="--database" set "EXTRA_ARGS=-StopDatabase"
if /i "%~1"=="all" set "EXTRA_ARGS=-StopDatabase"
if /i "%~1"=="--quiet" set "EXTRA_ARGS=-Quiet"
if /i "%~1"=="-q" set "EXTRA_ARGS=-Quiet"

echo.
echo =====================================================================
echo          MPharm - PharmaCare Management System Shutdown
echo =====================================================================
echo.
echo Terminating running MPharm server instances and releasing port 5888...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\mpharm-stop.ps1" -RootDir "%~dp0." -Port 5888 %EXTRA_ARGS%

if errorlevel 1 (
    echo.
    echo [ERROR] Shutdown encountered an unexpected error.
    echo Please check the "logs" directory for full trace details.
    echo.
    pause
)
