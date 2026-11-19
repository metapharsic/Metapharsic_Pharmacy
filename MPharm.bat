@echo off
setlocal EnableDelayedExpansion
title MPharm - PharmaCare Management System
color 0B

:: Ensure script runs in project root directory
cd /d "%~dp0"

set "EXTRA_ARGS="
if /i "%1"=="dev" set "EXTRA_ARGS=-Dev"
if /i "%1"=="--dev" set "EXTRA_ARGS=-Dev"
if /i "%1"=="rebuild" set "EXTRA_ARGS=-Rebuild"
if /i "%1"=="--rebuild" set "EXTRA_ARGS=-Rebuild"

echo.
echo =====================================================================
echo          MPharm - PharmaCare Management System Launcher
echo =====================================================================
echo.
echo Starting pre-flight diagnostic checks and high-speed launcher...
echo.

:: Launch the PowerShell Engine with unconstrained execution for this session
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\mpharm-launcher.ps1" -RootDir "%~dp0." -Port 5888 -RetentionDays 7 %EXTRA_ARGS%

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Launcher encountered an error (Exit Code: %ERRORLEVEL%).
    echo Please check the "logs" directory for full trace details.
    echo.
    pause
)
