@echo off
title ARIMA API Server
color 0A

echo.
echo ================================================
echo    STARTING ARIMA CRIME FORECASTING API
echo ================================================
echo.

cd /d "%~dp0"

echo [INFO] Starting API server...
echo [INFO] This will open a new window with the server
echo.

start "ARIMA API Server" python run-arima-api.py

echo [INFO] API server is starting...
echo [INFO] Wait 5 seconds, then refresh your Analytics page
echo.

timeout /t 5 /nobreak >nul

echo [INFO] Server should be running now!
echo [INFO] Go to your Analytics page and refresh (F5)
echo [INFO] The dropdowns should now populate with data
echo.

pause
