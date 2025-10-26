import React, { useState, useEffect } from 'react'
import { getDatabase, ref, get, onValue, off } from 'firebase/database'
import { app } from '../firebase'
import LineChart from './LineChart'
import { 
  performLocalForecasting, 
  getAvailableCrimeTypes, 
  getAvailableLocations,
  fetchAvailableFilters
} from '../services/localModelService'
import { 
  processReportWithGeotagging, 
  filterReportsByBarangay,
  getBarangayStatistics,
  getCoordinateStatistics 
} from '../services/geotaggingService'
import './AnalyticsDashboard.css'

const AnalyticsDashboard = () => {
  const [crimeData, setCrimeData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCrimeType, setSelectedCrimeType] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedTimeRange, setSelectedTimeRange] = useState('6') // months
  const [availableCrimeTypes, setAvailableCrimeTypes] = useState([])
  const [availableLocations, setAvailableLocations] = useState([])
  const [chartData, setChartData] = useState({
    historical: [],
    forecast: [],
    confidenceUpper: [],
    confidenceLower: []
  })
  const [forecastingData, setForecastingData] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState(null)

  // Load available crime types and locations from Firebase
  const loadLocalData = async () => {
    try {
      console.log('Loading available filters from Firebase')
      const { barangays, crimeTypes } = await fetchAvailableFilters()
      
      // Filter to only show Barangay 41 and 43 if they exist in the data
      const targetBarangays = barangays.filter(barangay => 
        barangay === 'Barangay 41' || barangay === 'Barangay 43'
      )
      
      console.log('Available crime types:', crimeTypes)
      console.log('Available barangays:', targetBarangays)
      
      setAvailableCrimeTypes(crimeTypes)
      setAvailableLocations(targetBarangays.length > 0 ? targetBarangays : ['Barangay 41', 'Barangay 43'])
    } catch (err) {
      console.error('Error loading local data:', err)
      setError(`Failed to load local data: ${err.message}`)
    }
  }

  // Fetch forecasting data using local models
  const fetchForecastingData = async () => {
    if (!selectedCrimeType || !selectedLocation) {
      setForecastError('Please select both crime type and location')
      return
    }

    setForecastLoading(true)
    setForecastError(null)
    
    try {
      console.log('Performing local model forecasting for:', selectedCrimeType, selectedLocation)
      
      const data = await performLocalForecasting(selectedCrimeType, selectedLocation, parseInt(selectedTimeRange))
      console.log('Local model forecast data:', data)
      
      if (!data.success) {
        throw new Error(data.error || 'Forecasting failed')
      }
      
      setForecastingData(data)
      
      // Update chart data
      const newChartData = {
        historical: data.historical || [],
        forecast: data.forecast || [],
        confidenceUpper: data.confidenceUpper || [],
        confidenceLower: data.confidenceLower || []
      }
      
      setChartData(newChartData)
      
      console.log('📊 Chart data updated:', {
        historical: newChartData.historical?.length || 0,
        forecast: newChartData.forecast?.length || 0,
        historicalSample: newChartData.historical?.slice(0, 3),
        forecastSample: newChartData.forecast?.slice(0, 3),
        statistics: data.statistics
      })
    } catch (err) {
      setForecastError(err.message)
      console.error('Error fetching forecasting data:', err)
    } finally {
      setForecastLoading(false)
    }
  }

  // Fetch data from Firebase Realtime Database
  const fetchCrimeData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔥 Starting Firebase data fetch...')
      
      const db = getDatabase(app)
      console.log('📡 Firebase database instance created')
      
      const reportsRef = ref(db, 'civilian/civilian crime reports')
      console.log('📍 Database path: civilian/civilian crime reports')
      
      console.log('⏳ Fetching data from Firebase...')
      const snapshot = await get(reportsRef)
      
      console.log('📊 Snapshot received:', {
        exists: snapshot.exists(),
        hasChildren: snapshot.hasChildren(),
        size: snapshot.size,
        key: snapshot.key
      })
      
      if (!snapshot.exists()) {
        console.error('❌ No data found at path: civilian/civilian crime reports')
        throw new Error('No crime reports found in database')
      }
      
      const allReports = snapshot.val()
      console.log('📋 Raw data structure:', {
        type: typeof allReports,
        isArray: Array.isArray(allReports),
        isObject: allReports && typeof allReports === 'object',
        keys: allReports ? Object.keys(allReports).slice(0, 5) : 'No keys'
      })
      
      const reportsArray = Object.entries(allReports).map(([key, data]) => ({
        id: key,
        ...data,
        // Ensure location data is properly formatted
        location: data.location || {
          latitude: data.latitude || data.lat,
          longitude: data.longitude || data.lng,
          address: data.address || data.location_address || 'Unknown location'
        }
      }))
      
      console.log(`✅ Successfully loaded ${reportsArray.length} crime reports`)
      
      setCrimeData(reportsArray)
      
      // Extract unique crime types and barangays from database
      const crimeTypes = [...new Set(reportsArray.map(r => r.crimeType || r.type || r.crime_type).filter(Boolean))]
      const barangays = [...new Set(reportsArray.map(r => r.barangay).filter(Boolean))]
      
      // Filter to only show Barangay 41 and 43 if they exist in the data
      const targetBarangays = barangays.filter(barangay => 
        barangay === 'Barangay 41' || barangay === 'Barangay 43'
      )
      
      setAvailableCrimeTypes(crimeTypes)
      setAvailableLocations(targetBarangays.length > 0 ? targetBarangays : ['Barangay 41', 'Barangay 43'])
      
      console.log('📈 Available crime types:', crimeTypes)
      console.log('📍 Available barangays:', targetBarangays)
      
      // Debug: Show sample reports with their crime types and barangays
      console.log('🔍 Sample reports for debugging:')
      reportsArray.slice(0, 5).forEach((report, index) => {
        console.log(`Report ${index + 1}:`, {
          id: report.id,
          crimeType: report.crimeType || report.type || report.crime_type,
          barangay: report.barangay,
          date: report.date
        })
      })
      
    } catch (err) {
      console.error('❌ Error fetching crime data:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      })
      
      // Check if it's a Firebase connection issue
      if (err.code === 'PERMISSION_DENIED') {
        setError('Permission denied: Check Firebase security rules')
      } else if (err.code === 'UNAVAILABLE') {
        setError('Firebase service unavailable: Check your internet connection')
      } else if (err.message.includes('No crime reports found')) {
        setError('No crime reports found in database. Check if data exists at path: civilian/civilian crime reports')
      } else {
        setError(`Failed to load crime data: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Process data for chart visualization with geotagging
  const processDataForChart = (data, crimeType, location, timeRange) => {
    if (!data || data.length === 0) return { historical: [], forecast: [] }

    // Process all reports with geotagging
    const processedReports = data.map(report => processReportWithGeotagging(report, data))
    
    // Filter data by crime type and barangay location
    const filtered = processedReports.filter(report => {
      const reportType = String(report.crimeType || report.type || report.crime_type || '')
      const reportBarangay = report.geotagging?.barangay
      
      return reportType === crimeType && reportBarangay === location && report.date
    })

    // Sort by date
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date))

    // Group by month
    const monthlyData = {}
    filtered.forEach(report => {
      const date = new Date(report.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0
      }
      monthlyData[monthKey]++
    })

    // Convert to chart format
    const sortedMonths = Object.keys(monthlyData).sort()
    const historical = sortedMonths.map(month => ({
      date: month,
      value: monthlyData[month]
    }))

    // Generate simple forecast using trend analysis
    const forecast = generateForecast(historical, parseInt(timeRange))
    
    return {
      historical,
      forecast: forecast.data,
      confidenceUpper: forecast.confidenceUpper,
      confidenceLower: forecast.confidenceLower
    }
  }

  // Simple forecast generation
  const generateForecast = (historicalData, months = 6) => {
    if (historicalData.length < 2) {
      const lastValue = historicalData.length > 0 ? historicalData[historicalData.length - 1].value : 0
      return {
        data: Array(months).fill({ date: '', value: lastValue }),
        confidenceUpper: Array(months).fill({ date: '', value: lastValue * 1.2 }),
        confidenceLower: Array(months).fill({ date: '', value: Math.max(0, lastValue * 0.8) })
      }
    }

    // Calculate trend
    const values = historicalData.map(d => d.value)
    const n = values.length
    const x = Array.from({length: n}, (_, i) => i)
    const y = values
    
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    // Calculate standard deviation for confidence intervals
    const avg = sumY / n
    const variance = y.reduce((sum, yi) => sum + Math.pow(yi - avg, 2), 0) / n
    const stdDev = Math.sqrt(variance)
    
    // Generate forecast
    const forecast = []
    const confidenceUpper = []
    const confidenceLower = []
    
    for (let i = 0; i < months; i++) {
      const xValue = n + i
      const predicted = Math.max(0, Math.round(slope * xValue + intercept))
      const confidence = 1.96 * stdDev
      
      const forecastDate = new Date()
      forecastDate.setMonth(forecastDate.getMonth() + i + 1)
      const dateStr = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`
      
      forecast.push({ date: dateStr, value: predicted })
      confidenceUpper.push({ date: dateStr, value: Math.max(0, Math.round(predicted + confidence)) })
      confidenceLower.push({ date: dateStr, value: Math.max(0, Math.round(predicted - confidence)) })
    }
    
    return { data: forecast, confidenceUpper, confidenceLower }
  }

  // Update chart data when filters change - REMOVED because we're using fetchForecastingData instead
  // useEffect(() => {
  //   if (selectedCrimeType && selectedLocation && crimeData.length > 0) {
  //     const processedData = processDataForChart(crimeData, selectedCrimeType, selectedLocation, selectedTimeRange)
  //     setChartData(processedData)
  //   }
  // }, [selectedCrimeType, selectedLocation, selectedTimeRange, crimeData])

  // Set up real-time listener
  useEffect(() => {
    const db = getDatabase(app)
    const reportsRef = ref(db, 'civilian/civilian crime reports')
    
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      if (snapshot.exists()) {
        const allReports = snapshot.val()
        const reportsArray = Object.entries(allReports).map(([key, data]) => ({
          id: key,
          ...data,
          location: data.location || {
            latitude: data.latitude || data.lat,
            longitude: data.longitude || data.lng,
            address: data.address || data.location_address || 'Unknown location'
          }
        }))
        
        setCrimeData(reportsArray)
        
        // Update available options
        const crimeTypes = [...new Set(reportsArray.map(r => r.crimeType || r.type || r.crime_type).filter(Boolean))]
        const barangays = [...new Set(reportsArray.map(r => r.barangay).filter(Boolean))]
        
        // Filter to only show Barangay 41 and 43 if they exist in the data
        const targetBarangays = barangays.filter(barangay => 
          barangay === 'Barangay 41' || barangay === 'Barangay 43'
        )
        
        setAvailableCrimeTypes(crimeTypes)
        setAvailableLocations(targetBarangays.length > 0 ? targetBarangays : ['Barangay 41', 'Barangay 43'])
      }
    })

    return () => {
      off(reportsRef, 'value', unsubscribe)
    }
  }, [])

  // Test Firebase connection
  const testFirebaseConnection = async () => {
    try {
      console.log('🧪 Testing Firebase connection...')
      const db = getDatabase(app)
      const testRef = ref(db, '.info/connected')
      const snapshot = await get(testRef)
      console.log('✅ Firebase connection test successful:', snapshot.val())
      return true
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error)
      return false
    }
  }

  // Test Firebase data path
  const testFirebaseDataPath = async () => {
    try {
      console.log('🧪 Testing Firebase data path...')
      const db = getDatabase(app)
      const testRef = ref(db, 'civilian/civilian crime reports')
      const snapshot = await get(testRef)
      
      console.log('📊 Data path test results:', {
        exists: snapshot.exists(),
        hasChildren: snapshot.hasChildren(),
        size: snapshot.size,
        key: snapshot.key
      })
      
      if (snapshot.exists()) {
        const data = snapshot.val()
        console.log('📋 Data structure:', {
          type: typeof data,
          isArray: Array.isArray(data),
          isObject: data && typeof data === 'object',
          keys: data ? Object.keys(data).slice(0, 5) : 'No keys',
          sampleData: data ? Object.values(data).slice(0, 2) : 'No data'
        })
      }
      
      return snapshot.exists()
    } catch (error) {
      console.error('❌ Firebase data path test failed:', error)
      return false
    }
  }

  // Initial data fetch
  useEffect(() => {
    console.log('🚀 AnalyticsDashboard mounted, starting data load...')
    testFirebaseConnection()
    testFirebaseDataPath()
    loadLocalData()
    fetchCrimeData()
  }, [])

  // Auto-fetch forecasting data when selections change
  useEffect(() => {
    if (selectedCrimeType && selectedLocation) {
      console.log(`🎯 Attempting to fetch forecasting data for: ${selectedCrimeType} in ${selectedLocation}`)
      fetchForecastingData()
    }
  }, [selectedCrimeType, selectedLocation, selectedTimeRange])


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading analytics data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <div className="mt-4">
              <button
                onClick={fetchCrimeData}
                className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Crime Analytics Dashboard</h2>
        <p className="text-gray-600">Real-time crime data analysis and forecasting</p>
      </div>

      <div className="dashboard-controls">
        <div className="control-group">
          <label className="control-label">Crime Type</label>
          <select
            value={selectedCrimeType}
            onChange={(e) => setSelectedCrimeType(e.target.value)}
            className="control-select"
          >
            <option value="">Select Crime Type</option>
            {availableCrimeTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Location</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="control-select"
          >
            <option value="">Select Location</option>
            {availableLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Forecast Period</label>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="control-select"
          >
            <option value="3">3 Months</option>
            <option value="6">6 Months</option>
            <option value="12">12 Months</option>
            <option value="24">24 Months</option>
          </select>
        </div>

        <div className="control-group">
          <button 
            className="refresh-btn"
            onClick={fetchForecastingData}
            disabled={forecastLoading || !selectedCrimeType || !selectedLocation}
          >
            {forecastLoading ? 'Loading...' : 'Refresh Forecast'}
          </button>
          
        </div>
      </div>

      {forecastError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Error loading forecasting data</h3>
              <div className="mt-2 text-sm text-red-700">{forecastError}</div>
              <div className="mt-4">
                <button
                  onClick={fetchForecastingData}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {selectedCrimeType && selectedLocation && (
        <div className="chart-container">
          <LineChart
            historicalData={chartData.historical}
            forecastData={chartData.forecast}
            title={`${selectedCrimeType} Analysis in ${selectedLocation}`}
            showConfidenceInterval={true}
            confidenceUpper={chartData.confidenceUpper}
            confidenceLower={chartData.confidenceLower}
          />
        </div>
      )}


      {(!selectedCrimeType || !selectedLocation) && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="empty-title">Select Crime Type and Location</h3>
          <p className="empty-description">
            Choose a crime type and location from the dropdowns above to view the analytics chart.
          </p>
        </div>
      )}
    </div>
  )
}

export default AnalyticsDashboard
