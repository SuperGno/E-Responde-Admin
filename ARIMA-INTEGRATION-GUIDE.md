# ARIMA Forecasting Integration Guide

## Overview
This guide explains how to integrate and use the ARIMA crime forecasting API with the E-Responde Analytics section.

## 🚀 Quick Start

### 1. Start the ARIMA API Server
```bash
# Option 1: Use the batch file (Windows)
start-arima-api.bat

# Option 2: Manual start
cd arima_forecasting_api/app
pip install -r requirements.txt
python run_api.py
```

### 2. Test the API Connection
Open `test-api-connection.html` in your browser to verify the API is working correctly.

### 3. Access Analytics
Navigate to the Analytics section in your E-Responde admin panel to view crime forecasting charts.

## 📊 Available Data

### Crime Types (10 types)
- Assault
- Breaking and Entering
- Domestic Violence
- Drug Related
- Fraud
- Harassment
- Others
- Theft
- Vehicle Theft
- Vandalism

### Locations (2 areas)
- Barangay 41
- Barangay 43

### Forecast Periods
- 6 months
- 12 months (default)
- 18 months
- 24 months

## 🔧 API Endpoints

### Core Endpoints
- `GET /api/crime_types` - Get available crime types
- `GET /api/locations` - Get available locations
- `GET /api/forecast` - Generate forecast for specific crime type/location
- `GET /api/visualization` - Get data formatted for charts

### Example API Calls
```javascript
// Get crime types
fetch('http://127.0.0.1:5000/api/crime_types')

// Get forecast
fetch('http://127.0.0.1:5000/api/forecast?crime_type=Theft&location=Barangay 41&months=12')

// Get visualization data
fetch('http://127.0.0.1:5000/api/visualization?crime_type=Theft&location=Barangay 41&months=12')
```

## 📈 Analytics Features

### Interactive Charts
- **Historical Data**: Solid blue line showing past crime trends
- **Forecast Data**: Dashed red line showing predicted future trends
- **Dynamic Scaling**: Charts automatically adjust to data range
- **Responsive Design**: Works on desktop and mobile devices

### Controls
- **Crime Type Selector**: Choose from 10 available crime types
- **Location Selector**: Choose between Barangay 41 and 43
- **Forecast Period**: Select 6, 12, 18, or 24 months
- **Auto-refresh**: Charts update automatically when selections change

### Metrics Display
- **Trend Analysis**: Shows percentage change in crime rates
- **Model Accuracy**: Displays forecasting model performance
- **Next Period Forecast**: Shows predicted crime count for next period

## 🛠️ Technical Details

### Dependencies
- Flask 2.0.1
- Flask-CORS 3.0.10
- Pandas 1.3.3
- NumPy 1.21.2
- Firebase-Admin 6.6.0 (optional)

### Model Files
- 20 pre-trained ARIMA models (10 crime types × 2 locations)
- Models stored in `tondo_forecasts/models/`
- Forecast data cached in `tondo_forecasts/tondo_crime_forecasts.json`

### Data Sources
- Historical crime data: `tondo_crime_data_barangay_41_43_2019_2025.csv`
- Pre-computed forecasts: `tondo_forecasts/tondo_crime_forecasts.json`

## 🔍 Troubleshooting

### Common Issues

#### 1. API Not Starting
**Problem**: `python run_api.py` fails
**Solution**: 
- Ensure Python is installed
- Install dependencies: `pip install -r requirements.txt`
- Check if port 5000 is available

#### 2. CORS Errors
**Problem**: Browser blocks API requests
**Solution**: 
- API has CORS enabled for all origins
- If issues persist, check browser console for specific errors

#### 3. No Data Displayed
**Problem**: Charts show "No data available"
**Solution**:
- Verify API is running on http://127.0.0.1:5000
- Check browser network tab for failed requests
- Ensure crime type and location are selected

#### 4. Model Not Found Errors
**Problem**: "Model not found" error
**Solution**:
- Verify model files exist in `tondo_forecasts/models/`
- Check file naming convention matches API expectations

### Debug Steps
1. Open browser developer tools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab for failed API requests
4. Use `test-api-connection.html` to isolate issues

## 📱 Usage Instructions

### For Administrators
1. **Start the API**: Run `start-arima-api.bat` or start manually
2. **Access Analytics**: Navigate to Analytics section in admin panel
3. **Select Parameters**: Choose crime type, location, and forecast period
4. **View Results**: Analyze historical trends and future predictions
5. **Export Data**: Use browser tools to save chart images or data

### For Developers
1. **API Integration**: Use the provided endpoints in your applications
2. **Custom Visualizations**: Modify the chart rendering in `Analytics.jsx`
3. **Data Extensions**: Add new crime types or locations by training new models
4. **Performance**: Models are cached for faster response times

## 🔮 Future Enhancements

### Planned Features
- Real-time data updates
- Additional crime types and locations
- Machine learning model improvements
- Export functionality for reports
- Alert system for high-risk predictions

### Customization Options
- Modify forecast periods
- Add new visualization types
- Integrate with external data sources
- Implement user-specific dashboards

## 📞 Support

### Getting Help
1. Check this guide for common solutions
2. Use the test page to verify API functionality
3. Review browser console for error messages
4. Check API server logs for backend issues

### File Locations
- API Server: `arima_forecasting_api/app/`
- Analytics Component: `src/components/Analytics.jsx`
- Test Page: `test-api-connection.html`
- Start Script: `start-arima-api.bat`

---

**Last Updated**: December 2024
**Version**: 1.0
**Compatibility**: E-Responde Admin Panel v2.0+