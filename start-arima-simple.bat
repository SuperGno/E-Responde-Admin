@echo off
echo Starting ARIMA Forecasting API...
echo.

cd /d "%~dp0..\arima_forecasting_api\app"

echo Starting Flask API server...
echo API will be available at: http://127.0.0.1:5000
echo.
echo Press Ctrl+C to stop the server
echo.

python -c "from api import app; app.run(debug=True, host='127.0.0.1', port=5000)"

pause
