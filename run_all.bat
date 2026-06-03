@echo off
rem --- Complete Production-Ready Development Startup Script ---
setlocal enabledelayedexpansion

cd /d "%~dp0"
echo.
echo ========================================================
echo   Chat with Database - Development Startup
echo ========================================================
echo.

rem Create .env files if missing
if not exist backend\.env (
    echo Creating backend\.env...
    (
        echo # Environment variables for Chat with Database v1
        echo POSTGRES_USER=postgres
        echo POSTGRES_PASSWORD=postgres_password
        echo POSTGRES_DB=chat_db
        echo DATABASE_URL=postgresql+psycopg://postgres:postgres_password@localhost:5432/chat_db
        echo REDIS_URL=redis://localhost:6379/0
        echo JWT_SECRET_KEY=your_secret_key_for_jwt_here_min_32_chars
        echo NVIDIA_API_KEY=dummy_key_for_testing
        echo ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
    ) > backend\.env
    echo [OK] backend\.env created
)

if not exist frontend\.env.local (
    echo Creating frontend\.env.local...
    (
        echo # Local Development Environment
        echo NEXT_PUBLIC_API_URL=http://localhost:8000
    ) > frontend\.env.local
    echo [OK] frontend\.env.local created
)

echo.
echo [1/5] Starting Docker containers (PostgreSQL and Redis)...
docker compose up -d || docker-compose up -d
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Docker containers failed to start
    echo [INFO] Make sure Docker is installed and running
    echo [INFO] Attempting to continue...
) else (
    echo [OK] Docker containers started
)

echo.
echo [2/5] Waiting for services to be ready...
timeout /t 5 >nul

echo.
echo [3/5] Setting up Python virtual environment...
cd /d "%~dp0backend"
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment
        echo [INFO] Make sure Python 3.9+ is installed
        pause
        exit /b 1
    )
)

echo Installing/updating dependencies...
call venv\Scripts\pip install --upgrade pip setuptools wheel >nul 2>&1
call venv\Scripts\pip install -r requirements.txt >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Some dependencies failed to install
    echo [INFO] This may not be critical for development
)
echo [OK] Python environment ready

echo.
echo [4/5] Starting services...
echo.

rem Start FastAPI backend
echo Starting FastAPI backend (port 8000)...
start "FastAPI Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 >nul

rem Start Next.js frontend
echo Starting Next.js frontend (port 3000)...
cd /d "%~dp0frontend"
call npm install --silent >nul 2>&1
start "Next.js Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [OK] All services started!
echo.
echo [5/5] Opening browser...
timeout /t 10 >nul
start "" "http://localhost:3000"

echo.
echo ========================================================
echo   Application is starting!
echo ========================================================
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   If services don't start, check the terminal windows
echo   for error messages. Press Ctrl+C to stop services.
echo.
pause