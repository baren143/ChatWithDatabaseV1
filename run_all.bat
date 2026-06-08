@echo off
REM --- Chat with Database - Quick Start Script ---
REM This script offers two modes:
REM   1. Docker mode (default) - Starts everything via Docker Compose
REM   2. Native mode - Starts backend + frontend natively (infra in Docker)
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ========================================================
echo   Chat with Database - Quick Start
echo ========================================================
echo.
echo Select startup mode:
echo   1. Docker mode (all services in containers) [default]
echo   2. Native mode (apps run locally, infra in Docker)
echo.

set /p CHOICE="Enter choice (1 or 2, press Enter for default 1): "

if "!CHOICE!"=="2" (
    echo.
    echo [INFO] Starting in Native mode...
    call start_dev.bat
    exit /b !ERRORLEVEL!
)

echo.
echo [INFO] Starting in Docker mode...
echo.

REM Call the Docker setup script
call setup_env.bat

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Setup failed. Check the messages above.
    echo [INFO] See SETUP_GUIDE.md for troubleshooting help.
    echo.
    echo [TIP] Try Native mode: press 2 at the prompt above.
    pause
    exit /b 1
)

exit /b 0