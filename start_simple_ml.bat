@echo off
echo 🤖 Starting Simple Crime Prediction Server...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

REM Install only Flask (minimal dependencies)
echo 📦 Installing minimal dependencies...
pip install flask flask-cors

echo.
echo 🚀 Starting Simple ML Server...
echo 📊 Server will be available at: http://localhost:5001
echo.
echo Available endpoints:
echo   GET /api/health - Health check
echo   POST /api/train-models - Train models
echo   POST /api/predict-crimes - Get predictions
echo   GET /api/model-status - Check model status
echo.

python simple_ml_server.py

pause



