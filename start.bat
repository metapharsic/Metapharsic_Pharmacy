@echo off
REM Force a window that never vanishes on error/crash - the #1 cause of
REM "it just closes" is cmd.exe closing the instant a command fails when
REM launched by double-click. This relaunches itself inside a window that
REM stays open (cmd /k) no matter what happens below.
if not defined METAPHARSIC_KEEP_OPEN (
    set METAPHARSIC_KEEP_OPEN=1
    cmd /k call "%~f0"
    exit /b
)
REM ============================================================
REM  METAPHARSIC PHARMACY - ONE-SHOT FIRE STARTER (consolidated)
REM  First run  = build Laravel + plant WHOLE app scaffold + migrate + seed
REM  Every run  = just start server
REM  URL after start: http://127.0.0.1:5656
REM  Login (first run seeds this):
REM    admin@metapharsic.local / ChangeMe123!   <-- CHANGE IT after login
REM  Needs on this PC BEFORE running: PHP 8.3, Composer, PostgreSQL 16
REM   (build cannot happen in the cloud cave - no internet to packagist there,
REM    so this script does the real build here, on your machine)
REM ============================================================
title Metapharsic Pharmacy
cd /d "%~dp0"

if exist app\artisan goto :RUN

echo ==========================================================
echo  FIRST FIRE - building the hut. This take few minute.
echo ==========================================================

where composer >nul 2>&1
if errorlevel 1 (
  echo ERROR: composer not found. Install PHP 8.3 + Composer first.
  echo Get it: https://getcomposer.org/download/
  pause
  exit /b 1
)

composer create-project laravel/laravel:^12.0 app --prefer-dist --no-interaction
if errorlevel 1 (
  echo ERROR: could not create Laravel project. Check internet.
  pause
  exit /b 1
)

cd app

echo Configuring .env for PostgreSQL + port 5656 ...
powershell -Command "(gc .env) -replace 'DB_CONNECTION=.*','DB_CONNECTION=pgsql' -replace 'DB_HOST=.*','DB_HOST=127.0.0.1' -replace 'DB_PORT=.*','DB_PORT=5432' -replace 'DB_DATABASE=.*','DB_DATABASE=metapharsic_pharmacy' -replace 'DB_USERNAME=.*','DB_USERNAME=postgres' -replace 'DB_PASSWORD=.*','DB_PASSWORD=postgres' -replace 'APP_URL=.*','APP_URL=http://127.0.0.1:5656' | Out-File -encoding ASCII .env"

echo Creating database (needs Postgres running + psql on PATH) ...
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE metapharsic_pharmacy;" 2>nul

echo Installing Breeze auth scaffolding ...
composer require laravel/breeze --dev --no-interaction
php artisan breeze:install blade --no-interaction
call npm install
call npm run build

cd ..
echo ==========================================================
echo  Planting WHOLE app scaffold (all 6 phase in one go) ...
echo  Source: pharmacy-app-scaffold\ (plain folder, no zip)
echo ==========================================================
xcopy /E /Y /I "pharmacy-app-scaffold\*" "app\" >nul

echo Also copy operator docs (deploy, backup drill, staff training, fallback) ...
if exist app\ops (
  xcopy /E /Y /I "app\ops" "ops\" >nul
  rd /s /q "app\ops"
)

echo Set timezone by hand: open config\app.php in app\, set
echo   'timezone' =^> 'Asia/Kolkata'  (one line, script will not touch this file)

cd app
echo Running all migrations ...
php artisan migrate --force

echo Checking ledger with stock:verify ...
php artisan stock:verify

echo Seeding roles, permissions, admin user, categories, manufacturers ...
php artisan db:seed --force

cd ..
echo ==========================================================
echo  Hut fully built. Login: admin@metapharsic.local / ChangeMe123!
echo  Run start.bat again to light fire.
echo ==========================================================
pause
exit /b 0

:RUN
echo Waking database bear ...
net start postgresql-x64-16 >nul 2>&1
REM wrong service name? run: sc query state=all | findstr postgres

cd app
start "Metapharsic Pharmacy Server" cmd /k "php artisan serve --host=127.0.0.1 --port=5656"
cd ..

timeout /t 2 >nul
start http://127.0.0.1:5656

echo ==========================================================
echo  Shop LIVE at:  http://127.0.0.1:5656
echo  Login: admin@metapharsic.local / ChangeMe123!
echo  Stop: close the black server window
echo ==========================================================
pause
