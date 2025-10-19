@echo off
title ARIMA API Server - Direct Start
color 0A

echo.
echo ================================================
echo    ARIMA CRIME FORECASTING API - DIRECT START
echo ================================================
echo.

cd /d "%~dp0"

echo [INFO] Starting ARIMA API server directly...
echo [INFO] This will open a new window with the server
echo.

start "ARIMA API Server" python start-api-direct.py

echo [INFO] API server is starting in a new window...
echo [INFO] Wait 10 seconds, then test the connection
echo.

timeout /t 10 /nobreak >nul

echo [INFO] Testing API connection...
echo [INFO] Opening test URL in browser...
echo.

start http://127.0.0.1:5000/api/locations

echo [INFO] If you see JSON data in the browser, the API is working!
echo [INFO] Now go back to your Analytics page and refresh (F5)
echo [INFO] The dropdowns should populate with crime types and locations
echo.

pause
