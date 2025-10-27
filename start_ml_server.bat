@echo off
echo 🤖 Starting Crime Prediction ML Server...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

REM Install required packages
echo 📦 Installing ML dependencies...
pip install -r requirements_ml.txt

echo.
echo 🚀 Starting ML Server...
echo 📊 Server will be available at: http://localhost:5001
echo.
echo Available endpoints:
echo   POST /api/train-models - Train ML models
echo   POST /api/predict-crimes - Get predictions for specific crime type
echo   POST /api/predict-all-crimes - Get predictions for all crime types
echo   GET /api/model-status - Check model status
echo.

python crime_prediction_ml.py

pause

