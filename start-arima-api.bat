@echo off
echo Starting ARIMA Forecasting API...
echo.
echo Make sure you have Python installed and the API files are in:
echo c:\Users\Gno\Desktop\aiko\arima_forcasting\app\
echo.
cd /d "c:\Users\Gno\Desktop\aiko\arima_forcasting\app"
echo Current directory: %CD%
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting API server on http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
python run_api.py
pause

