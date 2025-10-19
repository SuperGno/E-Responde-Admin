# Quick Start Guide - ARIMA API Integration

## 🚀 To Get Your Analytics Working Right Now:

### Step 1: Start the ARIMA API
Open a new terminal/command prompt and run:

```bash
cd "D:\New E-responde\arima_forecasting_api\app"
python run_api.py
```

You should see output like:
```
Starting Tondo Crime Forecast API on http://localhost:5000
Press CTRL+C to stop the server
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://[::1]:5000
```

### Step 2: Test the API
Open another terminal and test:
```bash
curl http://127.0.0.1:5000/api/locations
```

Or open in browser: http://127.0.0.1:5000/api/locations

### Step 3: Refresh Your Analytics Page
1. Go back to your E-Responde Analytics page
2. Refresh the page (F5)
3. The dropdowns should now populate with:
   - **Crime Types**: Assault, Breaking and Entering, Domestic Violence, etc.
   - **Locations**: Barangay 41, Barangay 43

### Step 4: Generate Forecasts
1. Select a crime type from the dropdown
2. Select a location (Barangay 41 or Barangay 43)
3. Choose forecast period (6, 12, 18, or 24 months)
4. The chart will automatically update with historical data and forecasts

## 🎯 What You'll See:

- **Historical Data**: Solid blue line showing past crime trends
- **Forecast Data**: Dashed red line showing predicted future trends
- **Interactive Charts**: Hover over data points for details
- **Metrics**: Trend analysis, model accuracy, next period forecast

## 🔧 Troubleshooting:

### If API won't start:
```bash
cd "D:\New E-responde\arima_forecasting_api\app"
pip install -r requirements_updated.txt
python run_api.py
```

### If dropdowns are still empty:
1. Check browser console (F12) for errors
2. Verify API is running on http://127.0.0.1:5000
3. Try opening http://127.0.0.1:5000/api/locations in browser

### If charts don't show:
1. Make sure you've selected both crime type AND location
2. Check that the API is responding (test the endpoints)
3. Refresh the page after starting the API

## 📊 Available Data:

**Crime Types (10):**
- Assault
- Breaking and Entering  
- Domestic Violence
- Drug Related
- Fraud
- Harassment
- Others
- Theft
- Vandalism
- Vehicle Theft

**Locations (2):**
- Barangay 41
- Barangay 43

**Forecast Periods:**
- 6 months
- 12 months (default)
- 18 months
- 24 months

## 🎉 You're All Set!

Once the API is running, your Analytics section will show beautiful interactive crime forecasting charts with historical trends and future predictions!
