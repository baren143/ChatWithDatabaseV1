@echo off
REM --- Native Mode: Infra in Docker, Apps run locally ---
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ========================================================
echo   Chat with Database - Native Mode
echo   (PostgreSQL + Redis in Docker, Apps run locally)
echo ========================================================
echo.

REM --------------------------------------------------------
REM 1. Start only the infrastructure containers (DB + Redis)
REM --------------------------------------------------------
echo [INFO] Starting Docker infrastructure (PostgreSQL and Redis)...
docker compose up -d db redis 2>nul || docker-compose up -d db redis 2>nul

if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARN] Could not start named services. Trying full docker compose...
    docker compose up -d 2>nul || docker-compose up -d 2>nul
)

echo [INFO] Waiting 5 seconds for database to be ready...
timeout /t 5 >nul

REM --------------------------------------------------------
REM 2. Setup Python virtual environment (backend)
REM --------------------------------------------------------
cd /d "%~dp0backend"

if not exist "venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
)

echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

echo [INFO] Installing backend dependencies...
pip install -r requirements.txt --quiet

REM --------------------------------------------------------
REM 3. Start FastAPI server in a new window
REM --------------------------------------------------------
echo [INFO] Starting FastAPI server on http://localhost:8000 ...
start "FastAPI Server" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM --------------------------------------------------------
REM 4. Start Celery worker in a new window (solo pool for Windows)
REM --------------------------------------------------------
echo [INFO] Starting Celery worker...
start "Celery Worker" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && celery -A celery_app worker --loglevel=info -P solo"

REM --------------------------------------------------------
REM 5. Setup and start Next.js frontend in a new window
REM --------------------------------------------------------
cd /d "%~dp0frontend"
echo [INFO] Installing frontend dependencies...
call npm install --silent

echo [INFO] Starting Next.js frontend on http://localhost:3000 ...
start "Next.js Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

REM --------------------------------------------------------
REM 6. Open browser after a short delay
REM --------------------------------------------------------
echo [INFO] Opening browser in 5 seconds...
timeout /t 5 >nul
start "" "http://localhost:3000"

echo.
echo ========================================================
echo   All services started in Native mode!
echo   FastAPI  : http://localhost:8000
echo   Frontend : http://localhost:3000
echo ========================================================
echo.
echo   Close the individual terminal windows to stop services.
echo.
