@echo off
setlocal
cd /d "%~dp0"

echo [1/5] Checking Python...
where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found. Install Python 3.10+ and add it to PATH.
    exit /b 1
)

echo [2/5] Creating virtual environment...
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 exit /b 1
)

echo [3/5] Installing Python packages...
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
if errorlevel 1 exit /b 1
python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo [4/5] Installing Node packages...
where npm >nul 2>nul
if errorlevel 1 (
    echo npm was not found. Install Node.js LTS and try again.
    exit /b 1
)
npm install
if errorlevel 1 exit /b 1

echo [5/5] Verifying production build...
npm run build
if errorlevel 1 exit /b 1

echo.
echo Install complete.
echo Run start_dashboard.bat or npm run dev, then open http://localhost:5173
