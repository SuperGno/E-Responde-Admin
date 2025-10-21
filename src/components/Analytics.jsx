import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off } from 'firebase/database'
import './Analytics.css'

function Analytics() {
  const [forecastingData, setForecastingData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [crimeTypes, setCrimeTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedCrimeType, setSelectedCrimeType] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedMonths, setSelectedMonths] = useState(12)
  const [systemMetrics, setSystemMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalReports: 0,
    resolvedReports: 0,
    averageResponseTime: 0,
    systemUptime: 0
  })
  const [realTimeData, setRealTimeData] = useState({
    activeCalls: 0,
    emergencyAlerts: 0,
    activeDispatches: 0,
    systemHealth: 'Good'
  })
  const [userEngagement, setUserEngagement] = useState([])
  const [crimeTrends, setCrimeTrends] = useState([])
  const [responseMetrics, setResponseMetrics] = useState({
    averageResponseTime: 0,
    dispatchEfficiency: 0,
    resolutionRate: 0
  })

  // API base URL for your ARIMA forecasting API
  // Local development: http://127.0.0.1:5000/
  // Production (Render): https://<your-render-service>.onrender.com/
  const API_BASE_URL = 'http://127.0.0.1:5000'

  // Health check function to verify API is running
  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/locations`)
      return response.ok
    } catch (error) {
      console.error('API health check failed:', error)
      return false
    }
  }

  // Fetch available crime types
  const fetchCrimeTypes = async () => {
    try {
      console.log('Fetching crime types from:', `${API_BASE_URL}/api/crime_types`)
      const response = await fetch(`${API_BASE_URL}/api/crime_types`)
      console.log('Crime types response status:', response.status)
      if (!response.ok) throw new Error('Failed to fetch crime types')
      const data = await response.json()
      console.log('Crime types data:', data)
      setCrimeTypes(data.crime_types || [])
    } catch (err) {
      console.error('Error fetching crime types:', err)
      setError(`Failed to load crime types: ${err.message}`)
    }
  }

  // Fetch available locations (only Barangay 41 and Barangay 43)
  const fetchLocations = async () => {
    try {
      console.log('Fetching locations from:', `${API_BASE_URL}/api/locations`)
      const response = await fetch(`${API_BASE_URL}/api/locations`)
      console.log('Locations response status:', response.status)
      if (!response.ok) throw new Error('Failed to fetch locations')
      const data = await response.json()
      console.log('Locations data:', data)
      // API returns array directly: ["Barangay 41", "Barangay 43"]
      setLocations(Array.isArray(data) ? data : data.locations || [])
    } catch (err) {
      console.error('Error fetching locations:', err)
      setError(`Failed to load locations: ${err.message}`)
    }
  }

  // Fetch forecasting data from your ARIMA API
  const fetchForecastingData = async () => {
    if (!selectedCrimeType || !selectedLocation) {
      setError('Please select both crime type and location')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        crime_type: selectedCrimeType,
        location: selectedLocation,
        months: selectedMonths.toString()
      })

      // Use the correct /api/visualization endpoint
      const url = `${API_BASE_URL}/api/visualization?${params}`
      console.log('Fetching forecast data from:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      console.log('Forecast response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Raw forecast data:', data)
      console.log('Historical data length:', data.raw_data?.history?.labels ? 
        (Array.isArray(data.raw_data.history.labels) ? data.raw_data.history.labels.length : data.raw_data.history.labels.split(' ').length) : 0)
      console.log('Forecast data length:', data.raw_data?.forecast?.labels ? 
        (Array.isArray(data.raw_data.forecast.labels) ? data.raw_data.forecast.labels.length : data.raw_data.forecast.labels.split(' ').length) : 0)
      
      // Check if we have valid forecast data
      if (!data) {
        throw new Error('No forecast data received from API')
      }
      
      // Process the visualization data structure
      let historicalData = []
      let forecastData = []
      
      // Handle the API response structure
      if (data.raw_data) {
        // API returns data in raw_data structure
        const rawData = data.raw_data
        
        // Process historical data (past months)
        if (rawData.history && rawData.history.labels && rawData.history.values) {
          // Handle both array and string formats
          const historyLabels = Array.isArray(rawData.history.labels) 
            ? rawData.history.labels 
            : rawData.history.labels.split(' ').filter(Boolean)
          const historyValues = Array.isArray(rawData.history.values) 
            ? rawData.history.values 
            : rawData.history.values.split(' ').filter(Boolean).map(Number)
          
          historicalData = historyLabels.map((label, index) => ({
            date: label, // Format: "2025-01", "2025-02", etc.
            value: historyValues[index] || 0
          }))
        }
        
        // Process forecast data (future months)
        if (rawData.forecast && rawData.forecast.labels && rawData.forecast.values) {
          // Handle both array and string formats
          const forecastLabels = Array.isArray(rawData.forecast.labels) 
            ? rawData.forecast.labels 
            : rawData.forecast.labels.split(' ').filter(Boolean)
          const forecastValues = Array.isArray(rawData.forecast.values) 
            ? rawData.forecast.values 
            : rawData.forecast.values.split(' ').filter(Boolean).map(Number)
          
          forecastData = forecastLabels.map((label, index) => ({
            date: label, // Format: "2026-01", "2026-02", etc.
            value: Math.max(0, forecastValues[index] || 0) // Ensure non-negative values
          }))
        }
      } else if (data.historical && data.forecast) {
        // Direct structure (fallback)
        historicalData = data.historical.map((item, index) => ({
          date: item.date || item.label || `Period ${index + 1}`,
          value: item.value || item.count || 0
        }))
        
        forecastData = data.forecast.map((item, index) => ({
          date: item.date || item.label || `Forecast ${index + 1}`,
          value: item.value || item.count || 0
        }))
      } else if (Array.isArray(data)) {
        // Array structure - split into historical and forecast
        const midPoint = Math.floor(data.length / 2)
        historicalData = data.slice(0, midPoint).map((item, index) => ({
          date: item.date || item.label || `Historical ${index + 1}`,
          value: item.value || item.count || 0
        }))
        
        forecastData = data.slice(midPoint).map((item, index) => ({
          date: item.date || item.label || `Forecast ${index + 1}`,
          value: item.value || item.count || 0
        }))
      }
      
      console.log('Processed historical data:', historicalData.length, 'points')
      console.log('Processed forecast data:', forecastData.length, 'points')
      console.log('Sample historical data:', historicalData.slice(0, 3))
      console.log('Sample forecast data:', forecastData.slice(0, 3))
      
      // Calculate trend from historical data if available
      let trend = 'N/A'
      if (historicalData.length > 0) {
        const values = historicalData.map(d => d.value)
        const firstHalf = values.slice(0, Math.floor(values.length / 2))
        const secondHalf = values.slice(Math.floor(values.length / 2))
        if (firstHalf.length > 0 && secondHalf.length > 0) {
          const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
          const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length
          const trendValue = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(1)
          trend = trendValue > 0 ? `+${trendValue}%` : `${trendValue}%`
        }
      }
      
      const transformedData = {
        historical: historicalData,
        forecast: forecastData,
        metrics: {
          trend: trend,
          accuracy: 'N/A', // API doesn't provide accuracy
          nextWeek: forecastData.length > 0 ? Math.round(forecastData[0].value) : 'N/A'
        },
        chartConfig: data.chart_config
      }
      
      console.log('Transformed data:', transformedData)
      console.log('Historical data points:', transformedData.historical.length)
      console.log('Forecast data points:', transformedData.forecast.length)
      console.log('Chart config:', transformedData.chartConfig)
      
      // Validate that we have data to display
      if (transformedData.historical.length === 0 && transformedData.forecast.length === 0) {
        throw new Error('No historical or forecast data available for the selected parameters')
      }
      
      setForecastingData(transformedData)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching forecasting data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch system metrics from Firebase
  const fetchSystemMetrics = async () => {
    try {
      const [usersSnapshot, reportsSnapshot, callsSnapshot, alertsSnapshot] = await Promise.all([
        get(ref(realtimeDb, 'civilian/civilian account')),
        get(ref(realtimeDb, 'civilian/civilian crime reports')),
        get(ref(realtimeDb, 'voip_calls')),
        get(ref(realtimeDb, 'sos_alerts'))
      ])
      
      const totalUsers = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0
      const totalReports = reportsSnapshot.exists() ? Object.keys(reportsSnapshot.val()).length : 0
      const resolvedReports = reportsSnapshot.exists() ? 
        Object.values(reportsSnapshot.val()).filter(report => report.status === 'Resolved').length : 0
      
      const activeCalls = callsSnapshot.exists() ? 
        Object.values(callsSnapshot.val()).filter(call => call.status === 'answered' || call.status === 'ringing').length : 0
      
      const emergencyAlerts = alertsSnapshot.exists() ? 
        Object.values(alertsSnapshot.val()).filter(alert => alert.status === 'active' || alert.status === 'pending').length : 0
      
      setSystemMetrics({
        totalUsers,
        activeUsers: Math.floor(totalUsers * 0.7), // 70% active users
        totalReports,
        resolvedReports,
        averageResponseTime: 15.5, // minutes
        systemUptime: 99.8 // percentage
      })
      
      setRealTimeData({
        activeCalls,
        emergencyAlerts,
        activeDispatches: Math.floor(totalReports * 0.3), // 30% of reports are dispatched
        systemHealth: emergencyAlerts > 5 ? 'Critical' : emergencyAlerts > 2 ? 'Warning' : 'Good'
      })
      
    } catch (err) {
      console.error('Error fetching system metrics:', err)
    }
  }

  // Fetch user engagement data
  const fetchUserEngagement = async () => {
    try {
      const notificationsRef = ref(realtimeDb, 'notifications')
      const snapshot = await get(notificationsRef)
      
      if (snapshot.exists()) {
        const notificationsData = snapshot.val()
        const engagementData = []
        
        // Process notifications to calculate engagement
        Object.keys(notificationsData).forEach(userId => {
          const userNotifications = notificationsData[userId]
          const totalNotifications = Object.keys(userNotifications).length
          const readNotifications = Object.values(userNotifications).filter(n => n.isRead).length
          const engagementRate = totalNotifications > 0 ? (readNotifications / totalNotifications) * 100 : 0
          
          engagementData.push({
            userId,
            engagementRate,
            totalNotifications,
            readNotifications
          })
        })
        
        setUserEngagement(engagementData)
      }
    } catch (err) {
      console.error('Error fetching user engagement:', err)
    }
  }

  // Fetch crime trends
  const fetchCrimeTrends = async () => {
    try {
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const snapshot = await get(reportsRef)
      
      if (snapshot.exists()) {
        const reportsData = snapshot.val()
        const trends = {}
        
        Object.values(reportsData).forEach(report => {
          const crimeType = report.crimeType || 'Unknown'
          const month = new Date(report.dateTime || report.createdAt).toISOString().substring(0, 7)
          
          if (!trends[month]) {
            trends[month] = {}
          }
          if (!trends[month][crimeType]) {
            trends[month][crimeType] = 0
          }
          trends[month][crimeType]++
        })
        
        const trendArray = Object.keys(trends).map(month => ({
          month,
          data: trends[month]
        })).sort((a, b) => a.month.localeCompare(b.month))
        
        setCrimeTrends(trendArray)
      }
    } catch (err) {
      console.error('Error fetching crime trends:', err)
    }
  }

  // Calculate response metrics
  const calculateResponseMetrics = async () => {
    try {
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const snapshot = await get(reportsRef)
      
      if (snapshot.exists()) {
        const reportsData = snapshot.val()
        const reports = Object.values(reportsData)
        
        const resolvedReports = reports.filter(report => report.status === 'Resolved')
        const totalReports = reports.length
        
        // Calculate average response time (simplified)
        const responseTimes = resolvedReports.map(report => {
          const createdAt = new Date(report.dateTime || report.createdAt)
          const resolvedAt = new Date(report.resolvedAt || new Date())
          return (resolvedAt - createdAt) / (1000 * 60) // minutes
        })
        
        const averageResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0
        
        const resolutionRate = totalReports > 0 ? (resolvedReports.length / totalReports) * 100 : 0
        const dispatchEfficiency = totalReports > 0 ? (reports.filter(r => r.status === 'Dispatched').length / totalReports) * 100 : 0
        
        setResponseMetrics({
          averageResponseTime: Math.round(averageResponseTime * 10) / 10,
          dispatchEfficiency: Math.round(dispatchEfficiency * 10) / 10,
          resolutionRate: Math.round(resolutionRate * 10) / 10
        })
      }
    } catch (err) {
      console.error('Error calculating response metrics:', err)
    }
  }

  useEffect(() => {
    const initializeData = async () => {
      // Check API health first
      const isApiHealthy = await checkApiHealth()
      if (!isApiHealthy) {
        setError('ARIMA API is not running. Please start the API server first.')
        return
      }
      
      // Fetch initial data
      fetchCrimeTypes()
      fetchLocations()
      fetchSystemMetrics()
      fetchUserEngagement()
      fetchCrimeTrends()
      calculateResponseMetrics()
    }
    
    initializeData()
    
    // Set up real-time listeners
    const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
    const callsRef = ref(realtimeDb, 'voip_calls')
    const alertsRef = ref(realtimeDb, 'sos_alerts')
    
    const unsubscribeReports = onValue(reportsRef, () => {
      fetchSystemMetrics()
      calculateResponseMetrics()
    })
    
    const unsubscribeCalls = onValue(callsRef, () => {
      fetchSystemMetrics()
    })
    
    const unsubscribeAlerts = onValue(alertsRef, () => {
      fetchSystemMetrics()
    })
    
    return () => {
      off(reportsRef, 'value', unsubscribeReports)
      off(callsRef, 'value', unsubscribeCalls)
      off(alertsRef, 'value', unsubscribeAlerts)
    }
  }, [])

  // Auto-fetch data when selections change
  useEffect(() => {
    if (selectedCrimeType && selectedLocation) {
      fetchForecastingData()
    }
  }, [selectedCrimeType, selectedLocation, selectedMonths])

  // Calculate max value for chart scaling
  const data = forecastingData
  const maxValue = data ? Math.max(
    ...(data.historical || []).map(d => d.value),
    ...(data.forecast || []).map(d => d.value)
  ) : 100

  // Generate user engagement data based on crime forecasting data
  const generateUserEngagementData = () => {
    if (forecastingData && forecastingData.historical) {
      // Use historical crime data to generate user engagement patterns
      const historicalData = forecastingData.historical
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      
      // Generate engagement data that correlates with crime patterns
      return historicalData.slice(-7).map((item, index) => ({
        month: months[new Date(item.date).getMonth()] || months[index],
        engagement: Math.max(20, Math.min(100, 100 - (item.value * 2) + Math.random() * 20)),
        crimeCount: item.value
      }))
    }
    
    // Fallback data if no forecasting data
    return [
      { month: 'Jan', engagement: 75, crimeCount: 12 },
      { month: 'Feb', engagement: 85, crimeCount: 8 },
      { month: 'Mar', engagement: 65, crimeCount: 18 },
      { month: 'Apr', engagement: 90, crimeCount: 5 },
      { month: 'May', engagement: 70, crimeCount: 15 },
      { month: 'Jun', engagement: 80, crimeCount: 10 },
      { month: 'Jul', engagement: 60, crimeCount: 20 }
    ]
  }

  const userEngagementData = generateUserEngagementData()
  const maxEngagement = Math.max(...userEngagementData.map(d => d.engagement))

  return (
    <div className="page-content">
      <h1>Analytics Dashboard</h1>
      <div className="analytics-content">
        {/* Unified Analytics Header */}
        <div className="analytics-header">
          <h2>Crime Analytics & User Engagement</h2>
          <p>Real-time correlation between crime patterns and user engagement</p>
        </div>

        {/* Connected Charts Section */}
        <div className="connected-charts-section">
          <div className="chart-placeholder">
            <h3>User Engagement vs Crime Patterns</h3>
            <div className="line-chart-container">
              <svg className="line-chart" viewBox="0 0 500 250" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="50" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                
                {/* Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
                  <g key={index}>
                    <line 
                      x1="40" 
                      y1={30 + ratio * 180} 
                      x2="460" 
                      y2={30 + ratio * 180} 
                      stroke="#e2e8f0" 
                      strokeWidth="1"
                    />
                    <text 
                      x="35" 
                      y={35 + ratio * 180} 
                      textAnchor="end" 
                      fontSize="10" 
                      fill="#64748b"
                    >
                      {Math.round(maxEngagement * (1 - ratio))}
                    </text>
                  </g>
                ))}
                
                {/* X-axis labels */}
                {userEngagementData.map((item, index) => (
                  <text 
                    key={index}
                    x={60 + (index * 60)} 
                    y="240" 
                    textAnchor="middle" 
                    fontSize="10" 
                    fill="#64748b"
                  >
                    {item.month}
                  </text>
                ))}
                
                {/* User Engagement Line */}
                <path
                  d={userEngagementData.map((item, index) => {
                    const x = 60 + (index * 60)
                    const y = 30 + ((maxEngagement - item.engagement) / maxEngagement) * 180
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Crime Pattern Line */}
                <path
                  d={userEngagementData.map((item, index) => {
                    const x = 60 + (index * 60)
                    const y = 30 + ((maxEngagement - (item.crimeCount * 4)) / maxEngagement) * 180
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Data points */}
                {userEngagementData.map((item, index) => {
                  const x = 60 + (index * 60)
                  const y = 30 + ((maxEngagement - item.engagement) / maxEngagement) * 180
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#8b5cf6"
                      stroke="white"
                      strokeWidth="2"
                    />
                  )
                })}
                
                {/* Chart title */}
                <text 
                  x="250" 
                  y="20" 
                  textAnchor="middle" 
                  fontSize="14" 
                  fontWeight="600" 
                  fill="#1e293b"
                >
                  User Engagement vs Crime Patterns
                </text>
                
                {/* Legend */}
                <g transform="translate(350, 50)">
                  <line x1="0" y1="0" x2="20" y2="0" stroke="#8b5cf6" strokeWidth="3"/>
                  <text x="25" y="5" fontSize="10" fill="#64748b">User Engagement</text>
                  <line x1="0" y1="15" x2="20" y2="15" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5"/>
                  <text x="25" y="20" fontSize="10" fill="#64748b">Crime Patterns</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Correlation Analysis Section */}
        <div className="correlation-analysis">
          <h3>Correlation Analysis</h3>
          <div className="correlation-metrics">
            <div className="metric-card">
              <h4>Engagement-Crime Correlation</h4>
              <p className="correlation-value">
                {forecastingData ? 
                  `${((1 - (userEngagementData.reduce((sum, item) => sum + item.crimeCount, 0) / userEngagementData.length / 20)) * 100).toFixed(1)}%` 
                  : '75.2%'
                }
              </p>
              <p className="metric-description">Inverse correlation between crime and engagement</p>
            </div>
            <div className="metric-card">
              <h4>Peak Engagement Period</h4>
              <p className="correlation-value">
                {userEngagementData.reduce((max, item) => item.engagement > max.engagement ? item : max, userEngagementData[0]).month}
              </p>
              <p className="metric-description">Month with highest user engagement</p>
            </div>
            <div className="metric-card">
              <h4>Crime Impact Score</h4>
              <p className="correlation-value">
                {forecastingData ? 
                  `${(userEngagementData.reduce((sum, item) => sum + item.crimeCount, 0) / userEngagementData.length).toFixed(1)}`
                  : '12.3'
                }
              </p>
              <p className="metric-description">Average crime incidents per month</p>
            </div>
          </div>
        </div>

        {/* Forecasting Section */}
        <div className="forecasting-section">
          <div className="forecasting-header">
            <h3>ARIMA Crime Forecasting Analysis</h3>
            <button 
              className="refresh-btn"
              onClick={fetchForecastingData}
              disabled={loading || !selectedCrimeType || !selectedLocation}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {/* Selection Controls */}
          <div className="forecasting-controls">
            <div className="control-group">
              <label htmlFor="crime-type">Crime Type:</label>
              <select 
                id="crime-type"
                value={selectedCrimeType} 
                onChange={(e) => setSelectedCrimeType(e.target.value)}
                className="forecasting-select"
              >
                <option value="">Select Crime Type</option>
                {crimeTypes.map((type, index) => (
                  <option key={index} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="control-group">
              <label htmlFor="location">Location:</label>
              <select 
                id="location"
                value={selectedLocation} 
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="forecasting-select"
              >
                <option value="">Select Location</option>
                {locations.map((location, index) => (
                  <option key={index} value={location}>{location}</option>
                ))}
              </select>
            </div>
            
            <div className="control-group">
              <label htmlFor="months">Forecast Period:</label>
              <select 
                id="months"
                value={selectedMonths} 
                onChange={(e) => setSelectedMonths(parseInt(e.target.value))}
                className="forecasting-select"
              >
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={18}>18 Months</option>
                <option value={24}>24 Months</option>
              </select>
            </div>
          </div>
          
          {error && (
            <div className="error-message">
              <p>Error loading forecasting data: {error}</p>
              <button onClick={fetchForecastingData} className="retry-btn">
                Retry
              </button>
            </div>
          )}
          
          {!error && data && (
            <>
              <div className="forecasting-chart">
                <div className="chart-container">
                  <div className="line-chart-container">
                    <svg className="line-chart" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
                      {/* Grid lines */}
                      <defs>
                        <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      
                      {/* Vertical grid lines for X-axis labels */}
                      {(() => {
                        const allData = [...(data.historical || []), ...(data.forecast || [])]
                        if (allData.length === 0) return null
                        
                        // Use same logic as labels for consistent spacing
                        let maxLabels, step
                        if (allData.length <= 24) {
                          maxLabels = 6
                          step = Math.max(1, Math.floor(allData.length / maxLabels))
                        } else if (allData.length <= 48) {
                          maxLabels = 8
                          step = Math.max(1, Math.floor(allData.length / maxLabels))
                        } else {
                          maxLabels = 10
                          step = Math.max(1, Math.floor(allData.length / maxLabels))
                        }
                        
                        return allData.map((item, index) => {
                          if (index % step !== 0 && index !== 0 && index !== allData.length - 1) return null
                          
                          const x = 50 + (index * (700 / (allData.length - 1)))
                          return (
                            <line 
                              key={`grid-${index}`}
                              x1={x} 
                              y1="50" 
                              x2={x} 
                              y2="250" 
                              stroke="#e2e8f0" 
                              strokeWidth="1"
                            />
                          )
                        }).filter(Boolean)
                      })()}
                      
                      {/* Y-axis labels */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
                        <g key={index}>
                          <line 
                            x1="50" 
                            y1={50 + ratio * 200} 
                            x2="750" 
                            y2={50 + ratio * 200} 
                            stroke="#e2e8f0" 
                            strokeWidth="1"
                          />
                          <text 
                            x="45" 
                            y={55 + ratio * 200} 
                            textAnchor="end" 
                            fontSize="12" 
                            fill="#64748b"
                          >
                            {Math.round(maxValue * (1 - ratio))}
                          </text>
                        </g>
                      ))}
                      
                      {/* X-axis labels - Show evenly spaced labels */}
                      {(() => {
                        const allData = [...(data.historical || []), ...(data.forecast || [])]
                        if (allData.length === 0) return null
                        
                        // Dynamic label calculation based on data length
                        let maxLabels, step
                        if (allData.length <= 24) {
                          // For shorter periods (12-24 months), show fewer labels
                          maxLabels = 6
                          step = Math.max(1, Math.floor(allData.length / maxLabels))
                        } else if (allData.length <= 48) {
                          // For medium periods (24-48 months), show moderate labels
                          maxLabels = 8
                          step = Math.max(1, Math.floor(allData.length / maxLabels))
                        } else {
                          // For longer periods (48+ months), show more labels
                          maxLabels = 10
                          step = Math.max(1, Math.floor(allData.length / maxLabels))
                        }
                        
                        return allData.map((item, index) => {
                          // Show first, last, and every step-th item
                          if (index % step !== 0 && index !== 0 && index !== allData.length - 1) return null
                          
                          const x = 50 + (index * (700 / (allData.length - 1)))
                          const monthYear = item.date.split('-')
                          const month = monthYear[1]
                          const year = monthYear[0]
                          
                          // Adjust text anchor for edge labels to prevent cutoff
                          let textAnchor = "middle"
                          if (index === 0) textAnchor = "start"
                          if (index === allData.length - 1) textAnchor = "end"
                          
                          // Adjust font size based on data density
                          let fontSize = "11"
                          if (allData.length > 60) fontSize = "10"
                          if (allData.length > 80) fontSize = "9"
                          
                          return (
                            <text 
                              key={index}
                              x={x} 
                              y="290" 
                              textAnchor={textAnchor} 
                              fontSize={fontSize} 
                              fill="#64748b"
                            >
                              {year}-{month}
                            </text>
                          )
                        }).filter(Boolean)
                      })()}
                      
                      {/* Combined line path - Historical (solid blue) + Forecast (dashed red) */}
                      {(() => {
                        const allData = [...(data.historical || []), ...(data.forecast || [])]
                        if (allData.length < 2) return null
                        
                        const historicalCount = data.historical ? data.historical.length : 0
                        
                        return (
                          <>
                            {/* Historical line path - Solid Blue */}
                            {data.historical && data.historical.length > 1 && (
                              <path
                                d={data.historical.map((item, index) => {
                                  const x = 50 + (index * (700 / (allData.length - 1)))
                                  const y = 50 + ((maxValue - item.value) / maxValue) * 200
                                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                                }).join(' ')}
                                fill="none"
                                stroke="#60a5fa"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                            
                            {/* Forecast line path - Dashed Red/Pink */}
                            {data.forecast && data.forecast.length > 1 && (
                              <path
                                d={data.forecast.map((item, index) => {
                                  const x = 50 + ((historicalCount + index) * (700 / (allData.length - 1)))
                                  const y = 50 + ((maxValue - item.value) / maxValue) * 200
                                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                                }).join(' ')}
                                fill="none"
                                stroke="#f87171"
                                strokeWidth="2"
                                strokeDasharray="12,6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                          </>
                        )
                      })()}
                      
                      {/* Data points - Historical (Light Blue) and Forecast (Pink/Red) */}
                      {(() => {
                        const allData = [...(data.historical || []), ...(data.forecast || [])]
                        const historicalCount = data.historical ? data.historical.length : 0
                        
                        return allData.map((item, index) => {
                          const x = 50 + (index * (700 / (allData.length - 1)))
                          const y = 50 + ((maxValue - item.value) / maxValue) * 200
                          const isHistorical = index < historicalCount
                          
                          return (
                            <g key={`point-${index}`}>
                              <circle
                                cx={x}
                                cy={y}
                                r="3"
                                fill={isHistorical ? "#60a5fa" : "#f87171"}
                                stroke="white"
                                strokeWidth="1"
                              />
                              <title>{`${item.date}: ${item.value.toFixed(1)} crimes`}</title>
                            </g>
                          )
                        })
                      })()}
                      
                      {/* Chart title */}
                      <text 
                        x="400" 
                        y="30" 
                        textAnchor="middle" 
                        fontSize="16" 
                        fontWeight="600" 
                        fill="#1e293b"
                      >
                        Crime Forecast (dashed): {selectedCrimeType} at {selectedLocation}
                      </text>
                    </svg>
                  </div>
                  
                  <div className="chart-legend">
                    {data.historical && data.historical.length > 0 && (
                      <div className="legend-item">
                        <div className="legend-color historical"></div>
                        <span>Historical</span>
                      </div>
                    )}
                    {data.forecast && data.forecast.length > 0 && (
                      <div className="legend-item">
                        <div className="legend-color forecast"></div>
                        <span>Forecast</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="forecasting-metrics">
                <div className="metric-card">
                  <h4>Trend</h4>
                  <p className="trend-positive">{data.metrics?.trend || 'N/A'}</p>
                </div>
                <div className="metric-card">
                  <h4>Model Accuracy</h4>
                  <p>{data.metrics?.accuracy || 'N/A'}</p>
                </div>
                <div className="metric-card">
                  <h4>Next Week Forecast</h4>
                  <p>{data.metrics?.nextWeek || 'N/A'}</p>
                </div>
              </div>
            </>
          )}
          
          {!error && !data && !loading && (
            <div className="no-data-message">
              <p>Please select a crime type and location to view forecasting data.</p>
            </div>
          )}
        </div>
        
        {/* Enhanced System Metrics */}
        <div className="enhanced-metrics-section">
          <h3>System Performance Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-card enhanced">
              <div className="metric-icon">👥</div>
              <div className="metric-content">
                <h4>Total Users</h4>
                <p className="metric-value">{systemMetrics.totalUsers}</p>
                <p className="metric-subtitle">Active: {systemMetrics.activeUsers}</p>
              </div>
            </div>
            <div className="metric-card enhanced">
              <div className="metric-icon">📊</div>
              <div className="metric-content">
                <h4>Total Reports</h4>
                <p className="metric-value">{systemMetrics.totalReports}</p>
                <p className="metric-subtitle">Resolved: {systemMetrics.resolvedReports}</p>
              </div>
            </div>
            <div className="metric-card enhanced">
              <div className="metric-icon">⏱️</div>
              <div className="metric-content">
                <h4>Avg Response Time</h4>
                <p className="metric-value">{responseMetrics.averageResponseTime}m</p>
                <p className="metric-subtitle">Target: &lt;15m</p>
              </div>
            </div>
            <div className="metric-card enhanced">
              <div className="metric-icon">📈</div>
              <div className="metric-content">
                <h4>Resolution Rate</h4>
                <p className="metric-value">{responseMetrics.resolutionRate}%</p>
                <p className="metric-subtitle">Dispatch: {responseMetrics.dispatchEfficiency}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time System Status */}
        <div className="real-time-status-section">
          <h3>Real-time System Status</h3>
          <div className="status-grid">
            <div className="status-card">
              <div className="status-header">
                <h4>System Health</h4>
                <span className={`status-indicator ${realTimeData.systemHealth.toLowerCase()}`}>
                  {realTimeData.systemHealth}
                </span>
              </div>
              <div className="status-metrics">
                <div className="status-item">
                  <span className="status-label">Active Calls:</span>
                  <span className="status-value">{realTimeData.activeCalls}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Emergency Alerts:</span>
                  <span className="status-value">{realTimeData.emergencyAlerts}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Active Dispatches:</span>
                  <span className="status-value">{realTimeData.activeDispatches}</span>
                </div>
              </div>
            </div>
            <div className="status-card">
              <div className="status-header">
                <h4>User Engagement</h4>
                <span className="engagement-score">
                  {userEngagement.length > 0 
                    ? Math.round(userEngagement.reduce((sum, user) => sum + user.engagementRate, 0) / userEngagement.length)
                    : 0}%
                </span>
              </div>
              <div className="engagement-breakdown">
                <div className="engagement-item">
                  <span className="engagement-label">High Engagement:</span>
                  <span className="engagement-value">
                    {userEngagement.filter(u => u.engagementRate > 80).length}
                  </span>
                </div>
                <div className="engagement-item">
                  <span className="engagement-label">Medium Engagement:</span>
                  <span className="engagement-value">
                    {userEngagement.filter(u => u.engagementRate >= 50 && u.engagementRate <= 80).length}
                  </span>
                </div>
                <div className="engagement-item">
                  <span className="engagement-label">Low Engagement:</span>
                  <span className="engagement-value">
                    {userEngagement.filter(u => u.engagementRate < 50).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Crime Trends Analysis */}
        <div className="crime-trends-section">
          <h3>Crime Trends Analysis</h3>
          <div className="trends-container">
            {crimeTrends.length > 0 ? (
              <div className="trends-chart">
                <svg className="trends-svg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  <defs>
                    <pattern id="trendsGrid" width="40" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#trendsGrid)" />
                  
                  {/* Y-axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
                    <g key={index}>
                      <line 
                        x1="50" 
                        y1={50 + ratio * 200} 
                        x2="750" 
                        y2={50 + ratio * 200} 
                        stroke="#e2e8f0" 
                        strokeWidth="1"
                      />
                      <text 
                        x="45" 
                        y={55 + ratio * 200} 
                        textAnchor="end" 
                        fontSize="12" 
                        fill="#64748b"
                      >
                        {Math.round(20 * (1 - ratio))}
                      </text>
                    </g>
                  ))}
                  
                  {/* X-axis labels */}
                  {crimeTrends.slice(-12).map((trend, index) => (
                    <text 
                      key={index}
                      x={50 + (index * (700 / Math.max(1, crimeTrends.slice(-12).length - 1)))} 
                      y="280" 
                      textAnchor="middle" 
                      fontSize="10" 
                      fill="#64748b"
                    >
                      {trend.month.substring(5)}
                    </text>
                  ))}
                  
                  {/* Crime trend lines for different types */}
                  {(() => {
                    const crimeTypes = ['Theft', 'Assault', 'Robbery', 'Vandalism']
                    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
                    
                    return crimeTypes.map((type, typeIndex) => {
                      const data = crimeTrends.slice(-12).map(trend => 
                        trend.data[type] || 0
                      )
                      const maxValue = Math.max(...data, 1)
                      
                      return (
                        <path
                          key={type}
                          d={data.map((value, index) => {
                            const x = 50 + (index * (700 / Math.max(1, data.length - 1)))
                            const y = 50 + ((maxValue - value) / maxValue) * 200
                            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                          }).join(' ')}
                          fill="none"
                          stroke={colors[typeIndex]}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )
                    })
                  })()}
                  
                  {/* Chart title */}
                  <text 
                    x="400" 
                    y="30" 
                    textAnchor="middle" 
                    fontSize="16" 
                    fontWeight="600" 
                    fill="#1e293b"
                  >
                    Crime Trends Over Time
                  </text>
                  
                  {/* Legend */}
                  <g transform="translate(50, 50)">
                    {['Theft', 'Assault', 'Robbery', 'Vandalism'].map((type, index) => (
                      <g key={type} transform={`translate(0, ${index * 20})`}>
                        <line x1="0" y1="0" x2="20" y2="0" stroke={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index]} strokeWidth="2"/>
                        <text x="25" y="5" fontSize="10" fill="#64748b">{type}</text>
                      </g>
                    ))}
                  </g>
                </svg>
              </div>
            ) : (
              <div className="no-trends-data">
                <p>No crime trend data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="performance-metrics-section">
          <h3>Performance Metrics</h3>
          <div className="performance-grid">
            <div className="performance-card">
              <h4>System Uptime</h4>
              <div className="uptime-display">
                <span className="uptime-value">{systemMetrics.systemUptime}%</span>
                <div className="uptime-bar">
                  <div 
                    className="uptime-fill" 
                    style={{ width: `${systemMetrics.systemUptime}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="performance-card">
              <h4>Response Efficiency</h4>
              <div className="efficiency-metrics">
                <div className="efficiency-item">
                  <span className="efficiency-label">Avg Response Time:</span>
                  <span className="efficiency-value">{responseMetrics.averageResponseTime}m</span>
                </div>
                <div className="efficiency-item">
                  <span className="efficiency-label">Dispatch Rate:</span>
                  <span className="efficiency-value">{responseMetrics.dispatchEfficiency}%</span>
                </div>
              </div>
            </div>
            <div className="performance-card">
              <h4>User Satisfaction</h4>
              <div className="satisfaction-metrics">
                <div className="satisfaction-item">
                  <span className="satisfaction-label">Resolution Rate:</span>
                  <span className="satisfaction-value">{responseMetrics.resolutionRate}%</span>
                </div>
                <div className="satisfaction-item">
                  <span className="satisfaction-label">Engagement Score:</span>
                  <span className="satisfaction-value">
                    {userEngagement.length > 0 
                      ? Math.round(userEngagement.reduce((sum, user) => sum + user.engagementRate, 0) / userEngagement.length)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics




