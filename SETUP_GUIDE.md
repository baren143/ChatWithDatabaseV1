# Setup Guide - Chat with Database v1

## Prerequisites

### 0. Python Version (IMPORTANT!)

**Use Python 3.12 or 3.13** - NOT 3.14+
- Check current version: `python --version`
- Download Python 3.12: https://www.python.org/downloads/release/python-3128/
- Download Python 3.13: https://www.python.org/downloads/release/python-3132/

**Why:** Python 3.14 is too new and several package wheels aren't built for it yet.

### 1. Visual Studio Build Tools (Required for Windows)

**Why:** Some Python packages (like `pydantic-core`) require C++ compilation on Windows.

#### Option A: Quick Install (Recommended)
```bash
# Download and run the installer
https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

In the installer:
- Select **"Desktop development with C++"**
- Click Install

#### Option B: Command Line
```bash
# Run PowerShell as Administrator
powershell -Command "& {
    $url = 'https://aka.ms/vs/17/release/vs_BuildTools.exe'
    $outPath = 'C:\vs_BuildTools.exe'
    Invoke-WebRequest -Uri $url -OutFile $outPath
    & $outPath --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet
}"
```

### 2. Required Software
- **Python 3.9+** (Check: `python --version`)
- **Docker Desktop** (Check: `docker --version`)
- **Git** (Check: `git --version`)

## Installation Steps

### Step 1: Clone or Extract Project
```bash
cd "path/to/ChatWithDatabaseV1"
```

### Step 2: Run Setup Script (Automatic)
```bash
# Run the automated setup
.\setup_env.bat
```

This will:
- Create `.env` files
- Start Docker containers
- Create Python virtual environment
- Install all dependencies
- Start the backend and frontend

### Step 3: Manual Setup (If needed)
```bash
# Create backend virtual environment
cd backend
python -m venv venv
call venv\Scripts\activate.bat

# Install dependencies
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Go back to root
cd ..
```

### Step 4: Start Services

**Backend:**
```bash
cd backend
call venv\Scripts\activate.bat
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

**Docker Services (PostgreSQL & Redis):**
```bash
docker compose up -d
```

## Troubleshooting

### "Python not found"
- Check Python installation: `python --version`
- Add Python to PATH if needed
- Restart terminal after installation

### "Docker not running"
- Open Docker Desktop application
- Wait for initialization (2-3 minutes)
- Try: `docker ps`

### "Module not found" errors
- Delete `backend/venv` folder
- Delete `backend/__pycache__` folder
- Restart and run: `pip install -r requirements.txt`

### "Port already in use"
- Backend (8000): `netstat -ano | findstr :8000`
- Frontend (3000): `netstat -ano | findstr :3000`
- Kill with: `taskkill /PID <PID> /F`

### "pgvector extension not found"
- This is handled automatically by the special `ankane/pgvector` Docker image
- If error persists, restart Docker: `docker compose restart db`

## Verification

After setup, verify everything works:

1. **Backend Health Check:**
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status": "healthy"}
   ```

2. **API Documentation:**
   - Visit: `http://localhost:8000/docs`

3. **Frontend:**
   - Visit: `http://localhost:3000`

## Environment Variables

Key variables in `backend/.env`:
- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Redis connection
- `NVIDIA_API_KEY`: For embeddings (set to dummy for testing)
- `JWT_SECRET_KEY`: For authentication

## Next Steps

1. Configure your NVIDIA API key in `backend/.env`
2. Upload test documents through the UI
3. Start chatting with your data!
