@echo off
rem --- Setup and start all services in one go ---

rem Check for required environment files
if not exist backend\.env (
    echo [ERROR] Backend .env file not found. Please create backend\.env from backend\.env.example
    pause
    exit /b 1
)
if not exist frontend\.env.local (
    echo [ERROR] Frontend .env.local file not found. Please create frontend\.env.local from frontend\.env.local.example
    pause
    exit /b 1
)

rem Clear ports before starting by killing only the processes using these ports
echo Clearing ports 8000 and 3000...
call :killPort 8000
call :killPort 3000
rem Also kill uvicorn and celery specifically if they are left over
taskkill /f /im uvicorn.exe >nul 2>&1
taskkill /f /im celery.exe >nul 2>&1
netsh int ipv4 delete excludedportrange protocol=tcp start=8000 number=1 >nul 2>&1
netsh int ipv4 delete excludedportrange protocol=tcp start=3000 number=1 >nul 2>&1
goto :afterClearPorts

:killPort
rem %1 = port number
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%1 ^| findstr LISTENING') do (
    taskkill /f /pid %%a
)
goto :eof

:afterClearPorts

rem 1. Start Docker containers (PostgreSQL & Redis)
cd /d "%~dp0"
echo Starting Docker containers (PostgreSQL and Redis)...
docker compose up -d || docker-compose up -d
if %ERRORLEVEL% neq 0 (
    echo Failed to start Docker containers. Make sure Docker is running!
    pause
    exit /b %ERRORLEVEL%
)

rem Wait 10 seconds to let the database and redis start up fully
timeout /t 10 >nul

rem 2. Setup backend
cd /d "%~dp0backend"
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
echo Installing backend requirements...
call venv\Scripts\pip install --upgrade pip
call venv\Scripts\pip install --only-binary :all: -r requirements.txt

rem 3. Start FastAPI server
echo Starting FastAPI server...
start "FastAPI Server" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

rem 4. Start Celery worker (using solo pool for Windows)
echo Starting Celery worker...
start "Celery Worker" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && celery -A celery_app worker --loglevel=info -P solo"

rem 5. Start Next.js frontend
cd /d "%~dp0frontend"
echo Installing frontend dependencies...
call npm install --silent
echo Starting Next.js frontend...
start "Next.js Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

rem 6. Wait for services to be ready (adjust time as needed)
echo Waiting for services to start...
timeout /t 30 >nul

rem 7. Open browser to frontend
echo Opening browser...
start "" "http://localhost:3000"

echo All services started. Check the individual windows for logs.
timeout /t 5 >nul
exit /b 0