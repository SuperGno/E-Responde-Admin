import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off } from 'firebase/database'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import './Analytics.css'
import './Heatmap.css'

// Add CSS animation for loading spinner
const spinAnimation = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`

// Inject the CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = spinAnimation
  document.head.appendChild(style)
}

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// HeatmapLayer component
function HeatmapLayer({ data, intensity, radius }) {
  const map = useMap()
  
  useEffect(() => {
    if (!data || data.length === 0) return
    
    // Create heatmap layer with increased opacity
    const heatmapLayer = L.heatLayer(data, {
      radius: radius,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: 'rgba(0, 0, 255, 0.3)',      // Blue with opacity
        0.2: 'rgba(0, 255, 255, 0.4)',    // Cyan with opacity
        0.4: 'rgba(0, 255, 0, 0.5)',       // Lime with opacity
        0.6: 'rgba(255, 255, 0, 0.6)',    // Yellow with opacity
        0.8: 'rgba(255, 165, 0, 0.7)',    // Orange with opacity
        1.0: 'rgba(255, 0, 0, 0.8)'       // Red with opacity
      }
    }).addTo(map)
    
    return () => {
      map.removeLayer(heatmapLayer)
    }
  }, [data, intensity, radius, map])
  
  return null
}

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
  
  // Heatmap state variables
  const [reports, setReports] = useState([])
  const [selectedCrimeTypeHeatmap, setSelectedCrimeTypeHeatmap] = useState('')
  const [timeRange, setTimeRange] = useState('30')
  const [intensity, setIntensity] = useState(5)
  const [radius, setRadius] = useState(50)
  const [showConcentricCircles, setShowConcentricCircles] = useState(false)
  const [referencePoint, setReferencePoint] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [reportsPerPage] = useState(6)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [availableCrimeTypes, setAvailableCrimeTypes] = useState([])
  const [showPoliceStations, setShowPoliceStations] = useState(true)
  
  // Real-time chart state variables
  const [realtimeChartData, setRealtimeChartData] = useState([])
  const [selectedChartType, setSelectedChartType] = useState('line')
  const [selectedTimeWindow, setSelectedTimeWindow] = useState('24h')
  const [selectedDataSource, setSelectedDataSource] = useState('reports')
  const [selectedCrimeTypeFilter, setSelectedCrimeTypeFilter] = useState('')
  const [chartStats, setChartStats] = useState({
    currentValue: 0,
    peakToday: 0,
    average: 0,
    trend: '+0%'
  })
  
  // Combined chart data (historical + forecast)
  const [combinedChartData, setCombinedChartData] = useState([])
  const [showForecastLine, setShowForecastLine] = useState(true)
  
  // Crime forecasting state variables
  const [forecastData, setForecastData] = useState([])
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState(null)
  const [forecastPeriod, setForecastPeriod] = useState('2weeks')
  const [forecastCrimeType, setForecastCrimeType] = useState('')
  const [forecastInsights, setForecastInsights] = useState({
    predictedCrimeCount: 0,
    riskLevel: 'Low',
    peakHours: [],
    peakDays: [],
    recommendations: []
  })

  // API base URL for your ARIMA forecasting API
  // Local development: http://127.0.0.1:5000/
  // Production (Render): https://<your-render-service>.onrender.com/
  const API_BASE_URL = 'http://127.0.0.1:5000'
  
  // ML API base URL for machine learning predictions
  const ML_API_BASE_URL = 'http://127.0.0.1:5001'

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

  // Heatmap data processing functions
  const getFilteredReports = () => {
    let filtered = reports.filter(report => 
      report.location?.latitude && report.location?.longitude
    )

    // Filter by crime type with improved matching
    if (selectedCrimeTypeHeatmap) {
      filtered = filtered.filter(report => {
        const reportCrimeType = report.crimeType || ''
        const selectedType = selectedCrimeTypeHeatmap.toLowerCase()
        
        // Exact match first
        if (reportCrimeType.toLowerCase() === selectedType) {
          return true
        }
        
        // Partial match for variations
        if (reportCrimeType.toLowerCase().includes(selectedType)) {
          return true
        }
        
        // Handle specific cases
        if (selectedType === 'breaking and entering' && 
            (reportCrimeType.toLowerCase().includes('breaking') || 
             reportCrimeType.toLowerCase().includes('burglary'))) {
          return true
        }
        
        if (selectedType === 'vehicle theft' && 
            (reportCrimeType.toLowerCase().includes('vehicle') || 
             reportCrimeType.toLowerCase().includes('car'))) {
          return true
        }
        
        if (selectedType === 'drug-related' && 
            reportCrimeType.toLowerCase().includes('drug')) {
          return true
        }
        
        if (selectedType === 'domestic violence' && 
            (reportCrimeType.toLowerCase().includes('domestic') || 
             reportCrimeType.toLowerCase().includes('violence'))) {
          return true
        }
        
        return false
      })
    }

    // Filter by time range
    if (timeRange !== 'all') {
      const days = parseInt(timeRange)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.dateTime || report.createdAt)
        return reportDate >= cutoffDate
      })
    }

    return filtered
  }

  // Create heatmap data points with proper intensity scaling
  const createHeatmapData = () => {
    const filteredReports = getFilteredReports()
    const heatmapPoints = []
    
    console.log(`Creating heatmap data from ${filteredReports.length} filtered reports`)
    
    // Group reports by location and create weighted points
    const locationGroups = new Map()
    
    filteredReports.forEach(report => {
      try {
        // Handle different location data formats from mobile app
        let lat, lng
        
        if (report.location) {
          lat = parseFloat(report.location.latitude || report.location.lat)
          lng = parseFloat(report.location.longitude || report.location.lng)
        } else {
          // Fallback to direct properties
          lat = parseFloat(report.latitude || report.lat)
          lng = parseFloat(report.longitude || report.lng)
        }
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
          console.warn('Invalid coordinates for report:', report.id, { lat, lng })
          return
        }
        
        // Check if coordinates are within reasonable bounds (Philippines)
        if (lat < 4 || lat > 22 || lng < 116 || lng > 127) {
          console.warn('Coordinates outside Philippines bounds:', { lat, lng })
          return
        }
        
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
        
        if (locationGroups.has(key)) {
          locationGroups.get(key).count++
          locationGroups.get(key).reports.push(report)
        } else {
          locationGroups.set(key, {
            lat,
            lng,
            count: 1,
            reports: [report]
          })
        }
      } catch (error) {
        console.warn('Error processing report for heatmap:', report.id, error)
      }
    })
    
    console.log(`Grouped into ${locationGroups.size} location clusters`)
    
    // Convert to heatmap format with intensity based on crime count and user intensity setting
    locationGroups.forEach(group => {
      // Base intensity from crime count (0-1)
      const baseIntensity = Math.min(1.0, group.count / 10)
      // Apply user intensity multiplier (1-10 scale to 0.1-1.0 multiplier)
      const userIntensityMultiplier = intensity / 10
      // Final intensity
      const finalIntensity = Math.min(1.0, baseIntensity * userIntensityMultiplier)
      
      heatmapPoints.push([group.lat, group.lng, finalIntensity])
    })
    
    console.log(`Created ${heatmapPoints.length} heatmap points with intensity multiplier: ${intensity}/10`)
    return heatmapPoints
  }

  // Debug function to test heatmap data
  const debugHeatmapData = () => {
    console.log('=== HEATMAP DEBUG INFO ===')
    console.log('Total reports:', reports.length)
    console.log('Reports with location:', reports.filter(r => r.location?.latitude && r.location?.longitude).length)
    console.log('Filtered reports:', getFilteredReports().length)
    console.log('Heatmap points:', createHeatmapData().length)
    console.log('Selected crime type:', selectedCrimeTypeHeatmap)
    console.log('Time range:', timeRange)
    console.log('Intensity:', intensity)
    console.log('Radius:', radius)
    
    // Show crime type distribution
    const crimeTypeCounts = {}
    reports.forEach(report => {
      const crimeType = report.crimeType || 'Unknown'
      crimeTypeCounts[crimeType] = (crimeTypeCounts[crimeType] || 0) + 1
    })
    console.log('Crime type distribution:', crimeTypeCounts)
    
    // Show filtered crime types
    if (selectedCrimeTypeHeatmap) {
      const filteredReports = getFilteredReports()
      const filteredCrimeTypes = filteredReports.map(r => r.crimeType || 'Unknown')
      console.log('Filtered crime types:', filteredCrimeTypes)
    }
    
    console.log('========================')
  }

  // Generate test data for heatmap if no real data exists
  const generateTestHeatmapData = () => {
    const testPoints = [
      [14.6042, 120.9822, 0.8], // Manila
      [14.5995, 120.9842, 0.6], // Tondo
      [14.6087, 120.9671, 0.9], // Binondo
      [14.6122, 120.9888, 0.4], // Quiapo
      [14.5895, 120.9755, 0.7], // Malate
    ]
    console.log('Generated test heatmap data:', testPoints.length, 'points')
    return testPoints
  }

  // Police station data for the area
  const policeStations = [
    {
      id: 'station-main',
      name: 'Tondo Police Station',
      position: [14.6100, 120.9800], // Approximate coordinates for 987-G Dagupan St, Tondo, Manila
      address: '987-G Dagupan St, Tondo, Manila, 1012 Metro Manila',
      officers: 50,
      status: 'Active',
      isMainStation: true
    }
  ]


  // Extract unique crime types from reports
  const extractCrimeTypes = (reportsArray) => {
    const crimeTypes = new Set()
    reportsArray.forEach(report => {
      if (report.crimeType && report.crimeType.trim()) {
        crimeTypes.add(report.crimeType.trim())
      }
    })
    return Array.from(crimeTypes).sort()
  }

  // Process real-time data for chart visualization
  const processRealtimeData = (data, timeWindow, crimeTypeFilter) => {
    const now = new Date()
    const timeWindowMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }
    
    const cutoffTime = new Date(now.getTime() - timeWindowMs[timeWindow])
    
    // Filter data based on time window and crime type
    let filteredData = data.filter(item => {
      const itemTime = new Date(item.dateTime || item.createdAt || item.timestamp)
      const timeMatch = itemTime >= cutoffTime
      
      let crimeTypeMatch = true
      if (crimeTypeFilter && item.crimeType) {
        crimeTypeMatch = item.crimeType.toLowerCase() === crimeTypeFilter.toLowerCase()
      }
      
      return timeMatch && crimeTypeMatch
    })
    
    // Group data by time intervals (hourly for 24h, daily for 7d)
    const intervalMs = timeWindow === '7d' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
    const groupedData = {}
    
    filteredData.forEach(item => {
      const itemTime = new Date(item.dateTime || item.createdAt || item.timestamp)
      const intervalKey = Math.floor(itemTime.getTime() / intervalMs) * intervalMs
      
      if (!groupedData[intervalKey]) {
        groupedData[intervalKey] = 0
      }
      groupedData[intervalKey]++
    })
    
    // Convert to chart format
    const chartData = Object.entries(groupedData)
      .map(([timestamp, count]) => ({
        time: new Date(parseInt(timestamp)),
        value: count,
        label: new Date(parseInt(timestamp)).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }))
      .sort((a, b) => a.time - b.time)
    
    return chartData
  }

  // Calculate chart statistics
  const calculateChartStats = (chartData) => {
    if (chartData.length === 0) {
      return {
        currentValue: 0,
        peakToday: 0,
        average: 0,
        trend: '+0%'
      }
    }
    
    const values = chartData.map(d => d.value)
    const currentValue = values[values.length - 1] || 0
    const peakToday = Math.max(...values)
    const average = values.reduce((sum, val) => sum + val, 0) / values.length
    
    // Calculate trend (compare first half vs second half)
    const midPoint = Math.floor(values.length / 2)
    const firstHalf = values.slice(0, midPoint)
    const secondHalf = values.slice(midPoint)
    
    let trend = '+0%'
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length
      const trendValue = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1)
      trend = trendValue > 0 ? `+${trendValue}%` : `${trendValue}%`
    }
    
    return {
      currentValue: Math.round(currentValue),
      peakToday: Math.round(peakToday),
      average: Math.round(average * 10) / 10,
      trend
    }
  }

  // Fetch real-time chart data based on selected data source
  const fetchRealtimeChartData = async () => {
    try {
      let dataRef
      
      switch (selectedDataSource) {
        case 'reports':
          dataRef = ref(realtimeDb, 'civilian/civilian crime reports')
          break
        case 'calls':
          dataRef = ref(realtimeDb, 'voip_calls')
          break
        case 'alerts':
          dataRef = ref(realtimeDb, 'sos_alerts')
          break
        case 'users':
          dataRef = ref(realtimeDb, 'civilian/civilian account')
          break
        default:
          dataRef = ref(realtimeDb, 'civilian/civilian crime reports')
      }
      
      const snapshot = await get(dataRef)
      
      if (snapshot.exists()) {
        const rawData = snapshot.val()
        const dataArray = Object.entries(rawData).map(([key, data]) => {
          // Handle nested structure where data might be under reportId
          const reportData = data.reportId ? data[data.reportId] || data : data
          return {
            id: key,
            ...reportData,
            // Use dateTime for crime reports, createdAt for other data
            timestamp: reportData.dateTime || reportData.createdAt || reportData.timestamp || new Date().toISOString(),
            // Ensure crimeType is available for filtering
            crimeType: reportData.crimeType || 'Unknown'
          }
        })
        
        const processedData = processRealtimeData(dataArray, selectedTimeWindow, selectedCrimeTypeFilter)
        setRealtimeChartData(processedData)
        
        const stats = calculateChartStats(processedData)
        setChartStats(stats)
        
        console.log(`Real-time chart data updated: ${processedData.length} data points`)
        console.log('Chart stats:', stats)
      } else {
        setRealtimeChartData([])
        setChartStats({
          currentValue: 0,
          peakToday: 0,
          average: 0,
          trend: '+0%'
        })
      }
    } catch (err) {
      console.error('Error fetching real-time chart data:', err)
    }
  }

  // Combine historical and forecast data for the chart
  const combineHistoricalAndForecastData = () => {
    const now = new Date()
    const combinedData = []
    
    // Add historical data
    realtimeChartData.forEach((item, index) => {
      combinedData.push({
        ...item,
        isHistorical: true,
        type: 'historical'
      })
    })
    
    // Add forecast data if available
    if (forecastData.length > 0) {
      forecastData.forEach((forecastDay, index) => {
        // Create hourly forecast data for the day
        const forecastDate = new Date(forecastDay.date)
        
        // Generate hourly predictions for the forecast day
        Object.entries(forecastDay.hourlyBreakdown).forEach(([hour, count]) => {
          const forecastTime = new Date(forecastDate)
          forecastTime.setHours(parseInt(hour), 0, 0, 0)
          
          combinedData.push({
            time: forecastTime.toISOString(),
            value: count,
            label: forecastTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }),
            isHistorical: false,
            type: 'forecast',
            riskLevel: forecastDay.riskLevel,
            dayOfWeek: forecastDay.dayOfWeek
          })
        })
      })
    }
    
    // Sort by time
    combinedData.sort((a, b) => new Date(a.time) - new Date(b.time))
    setCombinedChartData(combinedData)
  }

  // Crime forecasting functions
  const generateCrimeForecast = (historicalData, period) => {
    if (historicalData.length === 0) return []
    
    const now = new Date()
    const forecastDays = period === '1week' ? 7 : period === '2weeks' ? 14 : 30
    const forecastData = []
    
    // Analyze historical patterns
    const hourlyPatterns = {}
    const dailyPatterns = {}
    const weeklyPatterns = {}
    
    historicalData.forEach(item => {
      const date = new Date(item.timestamp)
      const hour = date.getHours()
      const dayOfWeek = date.getDay()
      const weekOfMonth = Math.floor(date.getDate() / 7)
      
      hourlyPatterns[hour] = (hourlyPatterns[hour] || 0) + 1
      dailyPatterns[dayOfWeek] = (dailyPatterns[dayOfWeek] || 0) + 1
      weeklyPatterns[weekOfMonth] = (weeklyPatterns[weekOfMonth] || 0) + 1
    })
    
    // Calculate base rate
    const totalCrimes = historicalData.length
    const daysInHistory = Math.max(1, (new Date() - new Date(historicalData[0].timestamp)) / (1000 * 60 * 60 * 24))
    const baseRate = totalCrimes / daysInHistory
    
    // Generate forecast for each day
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000))
      const dayOfWeek = forecastDate.getDay()
      const weekOfMonth = Math.floor(forecastDate.getDate() / 7)
      
      // Calculate daily base prediction
      let dailyPrediction = baseRate
      
      // Apply day-of-week pattern
      const dayMultiplier = dailyPatterns[dayOfWeek] / (totalCrimes / 7) || 1
      dailyPrediction *= dayMultiplier
      
      // Apply weekly pattern
      const weekMultiplier = weeklyPatterns[weekOfMonth] / (totalCrimes / 4) || 1
      dailyPrediction *= weekMultiplier
      
      // Add some randomness for realism
      const randomFactor = 0.8 + (Math.random() * 0.4) // 0.8 to 1.2
      dailyPrediction *= randomFactor
      
      // Generate hourly breakdown
      const hourlyBreakdown = {}
      for (let hour = 0; hour < 24; hour++) {
        const hourMultiplier = (hourlyPatterns[hour] || 0) / (totalCrimes / 24) || 1
        hourlyBreakdown[hour] = Math.round((dailyPrediction / 24) * hourMultiplier)
      }
      
      forecastData.push({
        date: forecastDate.toISOString().split('T')[0],
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        predictedCrimes: Math.round(dailyPrediction),
        hourlyBreakdown,
        riskLevel: dailyPrediction > baseRate * 1.5 ? 'High' : dailyPrediction > baseRate * 1.2 ? 'Medium' : 'Low'
      })
    }
    
    return forecastData
  }

  const generateForecastInsights = (forecastData, historicalData) => {
    if (forecastData.length === 0) return {
      predictedCrimeCount: 0,
      riskLevel: 'Low',
      peakHours: [],
      peakDays: [],
      recommendations: []
    }
    
    const totalPredicted = forecastData.reduce((sum, day) => sum + day.predictedCrimes, 0)
    const averageDaily = totalPredicted / forecastData.length
    
    // Find peak hours across all days
    const hourlyTotals = {}
    forecastData.forEach(day => {
      Object.entries(day.hourlyBreakdown).forEach(([hour, count]) => {
        hourlyTotals[hour] = (hourlyTotals[hour] || 0) + count
      })
    })
    
    const peakHours = Object.entries(hourlyTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    
    // Find peak days
    const peakDays = forecastData
      .sort((a, b) => b.predictedCrimes - a.predictedCrimes)
      .slice(0, 3)
      .map(day => ({ date: day.date, dayOfWeek: day.dayOfWeek, crimes: day.predictedCrimes }))
    
    // Determine overall risk level
    const highRiskDays = forecastData.filter(day => day.riskLevel === 'High').length
    const riskLevel = highRiskDays > forecastData.length * 0.3 ? 'High' : 
                     highRiskDays > forecastData.length * 0.1 ? 'Medium' : 'Low'
    
    // Generate recommendations
    const recommendations = []
    if (riskLevel === 'High') {
      recommendations.push('Increase police patrols during peak hours')
      recommendations.push('Deploy additional resources in high-risk areas')
    }
    if (peakHours.some(h => h.hour >= 18 || h.hour <= 6)) {
      recommendations.push('Enhance night-time security measures')
    }
    if (peakDays.some(d => d.dayOfWeek === 'Friday' || d.dayOfWeek === 'Saturday')) {
      recommendations.push('Prepare for weekend crime surge')
    }
    if (totalPredicted > historicalData.length * 0.5) {
      recommendations.push('Consider community awareness campaigns')
    }
    
    return {
      predictedCrimeCount: totalPredicted,
      riskLevel,
      peakHours,
      peakDays,
      recommendations
    }
  }

  // ML-based crime prediction functions
  const trainMLModels = async () => {
    try {
      console.log('🤖 Training ML models...')
      
      // Fetch historical crime data
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const snapshot = await get(reportsRef)
      
      if (!snapshot.exists()) {
        throw new Error('No historical crime data available for ML training')
      }
      
      const rawData = snapshot.val()
      const historicalData = Object.entries(rawData).map(([key, data]) => {
        const reportData = data.reportId ? data[data.reportId] || data : data
        return {
          id: key,
          ...reportData,
          timestamp: reportData.dateTime || reportData.createdAt || reportData.timestamp || new Date().toISOString(),
          crimeType: reportData.crimeType || 'Unknown',
          value: 1 // Each report counts as 1 crime
        }
      }).filter(item => {
        // Only include data from last 6 months for ML training
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        return new Date(item.timestamp) >= sixMonthsAgo
      })
      
      if (historicalData.length < 50) {
        throw new Error('Insufficient historical data for ML training (minimum 50 records required)')
      }
      
      // Send data to ML API for training
      const response = await fetch(`${ML_API_BASE_URL}/api/train-models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firebase_data: historicalData
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ ML models trained successfully:', result.results)
        return result.results
      } else {
        throw new Error(result.error || 'ML training failed')
      }
      
    } catch (err) {
      console.error('❌ Error training ML models:', err)
      throw err
    }
  }

  const fetchMLPredictions = async (crimeType, days) => {
    try {
      console.log(`🔮 Fetching ML predictions for ${crimeType} (${days} days)`)
      
      const response = await fetch(`${ML_API_BASE_URL}/api/predict-crimes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crime_type: crimeType,
          prediction_days: days
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ ML predictions received for ${crimeType}:`, result.predictions.length, 'days')
        return result.predictions
      } else {
        throw new Error(result.error || 'ML prediction failed')
      }
      
    } catch (err) {
      console.error(`❌ Error fetching ML predictions for ${crimeType}:`, err)
      throw err
    }
  }

  const fetchCrimeForecast = async () => {
    setForecastLoading(true)
    setForecastError(null)
    
    try {
      // First, try to get ML predictions
      try {
        console.log('🤖 Attempting ML-based predictions...')
        
        // Check if ML models are trained
        const statusResponse = await fetch(`${ML_API_BASE_URL}/api/model-status`)
        const statusResult = await statusResponse.json()
        
        if (statusResult.success && statusResult.total_models > 0) {
          console.log('✅ ML models available, using ML predictions')
          
          // Get ML predictions
          const mlPredictions = await fetchMLPredictions(
            forecastCrimeType || 'All', 
            forecastPeriod === '1week' ? 7 : 
            forecastPeriod === '2weeks' ? 14 : 30
          )
          
          // Convert ML predictions to forecast format
          const forecast = mlPredictions.map(pred => ({
            date: pred.date,
            dayOfWeek: pred.day_of_week,
            predictedCrimes: Math.round(pred.predicted_crimes),
            hourlyBreakdown: {}, // Will be filled by hourly prediction
            riskLevel: pred.risk_level
          }))
          
          setForecastData(forecast)
          
          // Generate insights from ML predictions
          const insights = generateForecastInsights(forecast, [])
          setForecastInsights(insights)
          
          console.log('✅ ML forecast generated:', forecast.length, 'days')
          return
        }
      } catch (mlError) {
        console.warn('⚠️ ML prediction failed, falling back to statistical model:', mlError.message)
      }
      
      // Fallback to statistical model
      console.log('📊 Using statistical model as fallback...')
      
      // Fetch historical crime data
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const snapshot = await get(reportsRef)
      
      if (!snapshot.exists()) {
        throw new Error('No historical crime data available for forecasting')
      }
      
      const rawData = snapshot.val()
      const historicalData = Object.entries(rawData).map(([key, data]) => {
        const reportData = data.reportId ? data[data.reportId] || data : data
        return {
          id: key,
          ...reportData,
          timestamp: reportData.dateTime || reportData.createdAt || reportData.timestamp || new Date().toISOString(),
          crimeType: reportData.crimeType || 'Unknown'
        }
      }).filter(item => {
        // Filter by crime type if selected
        if (forecastCrimeType && item.crimeType !== forecastCrimeType) {
          return false
        }
        // Only include data from last 3 months for better forecasting
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        return new Date(item.timestamp) >= threeMonthsAgo
      })
      
      if (historicalData.length < 10) {
        throw new Error('Insufficient historical data for accurate forecasting (minimum 10 records required)')
      }
      
      // Generate forecast
      const forecast = generateCrimeForecast(historicalData, forecastPeriod)
      setForecastData(forecast)
      
      // Generate insights
      const insights = generateForecastInsights(forecast, historicalData)
      setForecastInsights(insights)
      
      console.log('📊 Statistical forecast generated:', forecast.length, 'days')
      
    } catch (err) {
      setForecastError(err.message)
      console.error('Error generating crime forecast:', err)
    } finally {
      setForecastLoading(false)
    }
  }

  // Fetch heatmap data from Firebase
  const fetchHeatmapData = async () => {
    try {
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const snapshot = await get(reportsRef)
      
      if (snapshot.exists()) {
        const reportsData = snapshot.val()
        const reportsArray = Object.entries(reportsData).map(([key, data]) => ({
          id: key,
          ...data,
          // Ensure location data is properly formatted
          location: data.location || {
            latitude: data.latitude || data.lat,
            longitude: data.longitude || data.lng,
            address: data.address || data.location_address || 'Unknown location'
          }
        }))
        
        setReports(reportsArray)
        setAvailableCrimeTypes(extractCrimeTypes(reportsArray))
        setLastUpdate(new Date())
        console.log(`Loaded ${reportsArray.length} reports for heatmap`)
        console.log('Available crime types:', extractCrimeTypes(reportsArray))
      } else {
        setReports([])
        setAvailableCrimeTypes([])
        console.log('No crime reports found for heatmap')
      }
    } catch (err) {
      console.error('Error fetching heatmap data:', err)
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
      
      // Fetch heatmap data
      fetchHeatmapData()
    }
    
    initializeData()
    
    // Set up real-time listeners
    const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
    const callsRef = ref(realtimeDb, 'voip_calls')
    const alertsRef = ref(realtimeDb, 'sos_alerts')
    
    const unsubscribeReports = onValue(reportsRef, (snapshot) => {
      fetchSystemMetrics()
      calculateResponseMetrics()
      
       // Update heatmap data in real-time
       if (snapshot.exists()) {
         const reportsData = snapshot.val()
         const reportsArray = Object.entries(reportsData).map(([key, data]) => ({
           id: key,
           ...data,
           // Ensure location data is properly formatted
           location: data.location || {
             latitude: data.latitude || data.lat,
             longitude: data.longitude || data.lng,
             address: data.address || data.location_address || 'Unknown location'
           }
         }))
         
         setReports(reportsArray)
         setAvailableCrimeTypes(extractCrimeTypes(reportsArray))
         setLastUpdate(new Date())
         console.log(`Real-time heatmap update: ${reportsArray.length} reports`)
         console.log('Updated crime types:', extractCrimeTypes(reportsArray))
       }
    })
    
    const unsubscribeCalls = onValue(callsRef, () => {
      fetchSystemMetrics()
    })
    
    const unsubscribeAlerts = onValue(alertsRef, () => {
      fetchSystemMetrics()
    })
    
    // Real-time listener for chart data
    const unsubscribeChartData = onValue(reportsRef, () => {
      fetchRealtimeChartData()
    })
    
    return () => {
      off(reportsRef, 'value', unsubscribeReports)
      off(callsRef, 'value', unsubscribeCalls)
      off(alertsRef, 'value', unsubscribeAlerts)
      off(reportsRef, 'value', unsubscribeChartData)
    }
  }, [])

  // Auto-fetch data when selections change
  useEffect(() => {
    if (selectedCrimeType && selectedLocation) {
      fetchForecastingData()
    }
  }, [selectedCrimeType, selectedLocation, selectedMonths])

  // Auto-fetch real-time chart data when filters change
  useEffect(() => {
    fetchRealtimeChartData()
  }, [selectedTimeWindow, selectedDataSource, selectedCrimeTypeFilter])

  // Update combined data when historical or forecast data changes
  useEffect(() => {
    combineHistoricalAndForecastData()
  }, [realtimeChartData, forecastData])

  // Reset heatmap page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCrimeTypeHeatmap, timeRange])

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
      <div className="analytics-content">
        {/* Unified Analytics Header */}
        <div className="analytics-header">
          <h2>Crime Trend Analytics</h2>
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: '#f0f9ff', 
            borderRadius: '8px', 
            border: '1px solid #0ea5e9',
            fontSize: '0.9rem',
            color: '#0c4a6e'
          }}>
            <strong>📊 Available Sections:</strong> ARIMA Forecasting → Real-time Chart → Crime Heatmap → <strong>🔮 Crime Forecasting & Prediction</strong>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              💡 <strong>Scroll down</strong> to see the Crime Forecasting section with AI-powered predictions!
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


         {/* Interactive Crime Heatmap */}
         <div className="heatmap-section">
           <div className="heatmap-header">
            
            {/* Loading state for heatmap */}
            {loading && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#f0f9ff', 
                borderRadius: '8px', 
                border: '1px solid #0ea5e9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  border: '2px solid #0ea5e9', 
                  borderTop: '2px solid transparent', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                <span style={{ color: '#0c4a6e', fontWeight: '600' }}>Loading heatmap data...</span>
              </div>
            )}
            
            {/* Error state for heatmap */}
            {error && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#fef2f2', 
                borderRadius: '8px', 
                border: '1px solid #ef4444',
                color: '#dc2626'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {/* Real-time Data Status */}
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1.5rem', 
              background: '#f8fafc', 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ color: '#1e293b', fontSize: '1rem' }}>📊 Real-time Crime Data</strong>
                {lastUpdate && (
                  <small style={{ color: '#6b7280' }}>
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </small>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#1e293b' }}>Total Reports:</strong> {reports.length}
                </div>
                <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#1e293b' }}>Filtered Reports:</strong> {getFilteredReports().length}
                </div>
                <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#1e293b' }}>Heatmap Points:</strong> {createHeatmapData().length}
                </div>
                <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#1e293b' }}>With Location:</strong> {reports.filter(r => r.location?.latitude && r.location?.longitude).length}
                </div>
              </div>
            </div>
          </div>

          <div className="heatmap-content">
            <div className="map-container">
              <div className="map-wrapper">
                <MapContainer
                  center={[14.6042, 120.9822]} // Manila, Philippines
                  zoom={11}
                  style={{ height: '500px', width: '100%' }}
                  className="dark-map"
                >
                  <TileLayer
                    attribution='Leaflet | © OpenStreetMap contributors'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                    maxZoom={20}
                  />
                  
                  {/* Heatmap Layer */}
                  <HeatmapLayer 
                    data={createHeatmapData().length > 0 ? createHeatmapData() : generateTestHeatmapData()} 
                    intensity={intensity} 
                    radius={radius} 
                  />
                  
                  {/* Police Station Markers */}
                  {showPoliceStations && policeStations.map((station) => (
                    <Marker
                      key={station.id}
                      position={station.position}
                      icon={L.divIcon({
                        className: 'police-station-marker',
                        html: `
                          <div style="
                            position: relative;
                            width: 24px;
                            height: 32px;
                          ">
                            <div style="
                              position: absolute;
                              top: 0;
                              left: 50%;
                              transform: translateX(-50%);
                              width: 20px;
                              height: 20px;
                              background: #dc2626;
                              border: 2px solid #ffffff;
                              border-radius: 50%;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            ">
                              <div style="
                                width: 8px;
                                height: 8px;
                                background: #ffffff;
                                border-radius: 50%;
                              "></div>
                            </div>
                            <div style="
                              position: absolute;
                              top: 18px;
                              left: 50%;
                              transform: translateX(-50%);
                              width: 0;
                              height: 0;
                              border-left: 6px solid transparent;
                              border-right: 6px solid transparent;
                              border-top: 12px solid #dc2626;
                              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                            "></div>
                          </div>
                        `,
                        iconSize: [24, 32],
                        iconAnchor: [12, 32]
                      })}
                    >
                      <Popup>
                        <div style={{ padding: '8px', minWidth: '200px' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: '#dc2626', fontSize: '14px' }}>
                            {station.name}
                          </h4>
                          <p style={{ margin: '4px 0', fontSize: '12px', color: '#374151' }}>
                            {station.address}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
                <div className="map-legend">
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>Crime Density</h4>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#0000ff' }}></div>
                    <span className="legend-label">Low</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#00ffff' }}></div>
                    <span className="legend-label">Medium-Low</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#00ff00' }}></div>
                    <span className="legend-label">Medium</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#ffff00' }}></div>
                    <span className="legend-label">Medium-High</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#ff8000' }}></div>
                    <span className="legend-label">High</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#ff0000' }}></div>
                    <span className="legend-label">Very High</span>
                  </div>
                  
                  
                  {showPoliceStations && (
                    <div className="legend-item">
                      <div className="legend-color" style={{ 
                        background: '#dc2626', 
                        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                        width: '12px',
                        height: '12px'
                      }}></div>
                      <span className="legend-label">Police Station</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="heatmap-controls">
              <div className="control-section">
                <h3>Filter Options</h3>
                 <div className="filter-group">
                   <label>Crime Type:</label>
                   <select 
                     value={selectedCrimeTypeHeatmap} 
                     onChange={(e) => setSelectedCrimeTypeHeatmap(e.target.value)}
                   >
                     <option value="">All Types</option>
                     <option value="Theft">Theft</option>
                     <option value="Assault">Assault</option>
                     <option value="Vandalism">Vandalism</option>
                     <option value="Fraud">Fraud</option>
                     <option value="Harassment">Harassment</option>
                     <option value="Breaking and Entering">Breaking and Entering</option>
                     <option value="Vehicle Theft">Vehicle Theft</option>
                     <option value="Drug-related">Drug-related</option>
                     <option value="Domestic Violence">Domestic Violence</option>
                     <option value="Other">Other</option>
                   </select>
                 </div>
                <div className="filter-group">
                  <label>Time Range:</label>
                  <select 
                    value={timeRange} 
                    onChange={(e) => setTimeRange(e.target.value)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>

              <div className="control-section">
                <h3>Heatmap Settings</h3>
                <div className="setting-group">
                  <label>Intensity: {intensity}/10</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={intensity}
                    onChange={(e) => setIntensity(parseInt(e.target.value))}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    Controls heatmap intensity
                  </small>
                </div>
                 <div className="setting-group">
                   <label>Radius: {radius}px</label>
                   <input 
                     type="range" 
                     min="10" 
                     max="100" 
                     value={radius}
                     onChange={(e) => setRadius(parseInt(e.target.value))}
                   />
                   <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                     Controls heatmap radius & blur
                   </small>
                 </div>
                 <div className="setting-group">
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <input 
                       type="checkbox" 
                       checked={showPoliceStations}
                       onChange={(e) => setShowPoliceStations(e.target.checked)}
                       style={{ margin: 0 }}
                     />
                     Show Police Stations
                   </label>
                   <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                     Display police station location on map
                   </small>
                 </div>
               </div>

             </div>
          </div>
        </div>

        {/* Real-time Data Line Chart Section */}
        <div className="realtime-chart-section">
          <div className="realtime-chart-header">
            <h3>Real-time Data Analysis</h3>
            <p>Live data visualization from Firebase Realtime Database</p>
          </div>
          
          <div className="realtime-chart-content">
            <div className="chart-controls">
              <div className="control-group">
                <label htmlFor="chart-type">Chart Type:</label>
                <select 
                  id="chart-type" 
                  className="chart-select"
                  value={selectedChartType}
                  onChange={(e) => setSelectedChartType(e.target.value)}
                >
                  <option value="line">Line Chart</option>
                  <option value="bar">Bar Chart</option>
                  <option value="area">Area Chart</option>
                </select>
              </div>
              
              <div className="control-group">
                <label htmlFor="time-window">Time Window:</label>
                <select 
                  id="time-window" 
                  className="chart-select"
                  value={selectedTimeWindow}
                  onChange={(e) => setSelectedTimeWindow(e.target.value)}
                >
                  <option value="1h">Last Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                </select>
              </div>
              
              <div className="control-group">
                <label htmlFor="data-source">Data Source:</label>
                <select 
                  id="data-source" 
                  className="chart-select"
                  value={selectedDataSource}
                  onChange={(e) => setSelectedDataSource(e.target.value)}
                >
                  <option value="reports">Crime Reports</option>
                  <option value="calls">VoIP Calls</option>
                  <option value="alerts">SOS Alerts</option>
                  <option value="users">User Activity</option>
                </select>
              </div>
              
              <div className="control-group">
                <label htmlFor="crime-type-filter">Crime Type Filter:</label>
                <select 
                  id="crime-type-filter" 
                  className="chart-select"
                  value={selectedCrimeTypeFilter}
                  onChange={(e) => setSelectedCrimeTypeFilter(e.target.value)}
                >
                  <option value="">All Crime Types</option>
                  <option value="Assault">Assault</option>
                  <option value="Theft">Theft</option>
                  <option value="Vandalism">Vandalism</option>
                  <option value="Fraud">Fraud</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Breaking and Entering">Breaking and Entering</option>
                  <option value="Vehicle Theft">Vehicle Theft</option>
                  <option value="Drug-related">Drug-related</option>
                  <option value="Domestic Violence">Domestic Violence</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="chart-container">
              <div className="chart-wrapper">
                <svg className="realtime-chart" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  <defs>
                    <pattern id="realtimeGrid" width="40" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#realtimeGrid)" />
                  
                  {/* Y-axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
                    <g key={index}>
                      <line 
                        x1="50" 
                        y1={50 + ratio * 300} 
                        x2="750" 
                        y2={50 + ratio * 300} 
                        stroke="#e2e8f0" 
                        strokeWidth="1"
                      />
                      <text 
                        x="45" 
                        y={55 + ratio * 300} 
                        textAnchor="end" 
                        fontSize="12" 
                        fill="#64748b"
                      >
                        {Math.round(100 * (1 - ratio))}
                      </text>
                    </g>
                  ))}
                  
                  {/* X-axis labels - Show dates and days */}
                  {combinedChartData.length > 0 ? (
                    combinedChartData.map((item, index) => {
                      const x = 50 + (index * (700 / Math.max(1, combinedChartData.length - 1)))
                      const date = new Date(item.time)
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                      const dayNumber = date.getDate()
                      
                      // Show every nth label to avoid overcrowding
                      const showLabel = index % Math.max(1, Math.floor(combinedChartData.length / 8)) === 0 || 
                                       index === combinedChartData.length - 1
                      
                      if (!showLabel) return null
                      
                      return (
                        <text 
                          key={index}
                          x={x} 
                          y="380" 
                          textAnchor="middle" 
                          fontSize="10" 
                          fill="#64748b"
                        >
                          {`${dayName} ${dayNumber}`}
                        </text>
                      )
                    })
                  ) : (
                    // Fallback labels when no data
                    Array.from({ length: 7 }, (_, i) => {
                      const date = new Date()
                      date.setDate(date.getDate() - 6 + i)
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                      const dayNumber = date.getDate()
                      
                      return (
                        <text 
                          key={i}
                          x={50 + (i * (700 / 6))} 
                          y="380" 
                          textAnchor="middle" 
                          fontSize="10" 
                          fill="#64748b"
                        >
                          {`${dayName} ${dayNumber}`}
                        </text>
                      )
                    })
                  )}
                  
                  {/* Historical data line (solid blue) */}
                  {combinedChartData.filter(item => item.isHistorical).length > 1 && (
                    <path
                      d={combinedChartData.filter(item => item.isHistorical).map((item, index) => {
                        const allData = combinedChartData
                        const itemIndex = allData.findIndex(d => d === item)
                        const x = 50 + (itemIndex * (700 / Math.max(1, allData.length - 1)))
                        const maxValue = Math.max(...allData.map(d => d.value), 1)
                        const y = 50 + ((maxValue - item.value) / maxValue) * 300
                        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  
                  {/* Forecast data line (dashed purple) */}
                  {combinedChartData.filter(item => !item.isHistorical).length > 1 && (
                    <path
                      d={combinedChartData.filter(item => !item.isHistorical).map((item, index) => {
                        const allData = combinedChartData
                        const itemIndex = allData.findIndex(d => d === item)
                        const x = 50 + (itemIndex * (700 / Math.max(1, allData.length - 1)))
                        const maxValue = Math.max(...allData.map(d => d.value), 1)
                        const y = 50 + ((maxValue - item.value) / maxValue) * 300
                        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="8,4"
                    />
                  )}
                  
                  {/* Data points - Historical (blue) and Forecast (purple with risk indicators) */}
                  {combinedChartData.map((item, index) => {
                    const x = 50 + (index * (700 / Math.max(1, combinedChartData.length - 1)))
                    const maxValue = Math.max(...combinedChartData.map(d => d.value), 1)
                    const y = 50 + ((maxValue - item.value) / maxValue) * 300
                    
                    let pointColor = item.isHistorical ? "#3b82f6" : "#8b5cf6"
                    let pointSize = 4
                    
                    // Risk-based coloring for forecast points
                    if (!item.isHistorical && item.riskLevel) {
                      if (item.riskLevel === 'High') {
                        pointColor = "#ef4444"
                        pointSize = 6
                      } else if (item.riskLevel === 'Medium') {
                        pointColor = "#f59e0b"
                        pointSize = 5
                      } else {
                        pointColor = "#10b981"
                        pointSize = 4
                      }
                    }
                    
                    return (
                      <g key={index}>
                        <circle
                          cx={x}
                          cy={y}
                          r={pointSize}
                          fill={pointColor}
                          stroke="white"
                          strokeWidth="2"
                        />
                        <title>
                          {item.isHistorical ? 'Historical' : 'Forecast'} - {new Date(item.time).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}: {item.value} incidents
                          {!item.isHistorical && item.riskLevel ? ` (${item.riskLevel} Risk)` : ''}
                        </title>
                      </g>
                    )
                  })}
                  
                  {/* Chart title */}
                  <text 
                    x="400" 
                    y="30" 
                    textAnchor="middle" 
                    fontSize="16" 
                    fontWeight="600" 
                    fill="#1e293b"
                  >
                    Real-time Data Trends
                  </text>
                </svg>
              </div>
              
              <div className="chart-stats">
                <div className="stat-card">
                  <h4>Current Value</h4>
                  <p className="stat-value">{chartStats.currentValue}</p>
                </div>
                <div className="stat-card">
                  <h4>Peak Today</h4>
                  <p className="stat-value">{chartStats.peakToday}</p>
                </div>
                <div className="stat-card">
                  <h4>Average</h4>
                  <p className="stat-value">{chartStats.average}</p>
                </div>
                <div className="stat-card">
                  <h4>Trend</h4>
                  <p className={`stat-value ${chartStats.trend.startsWith('+') ? 'trend-up' : 'trend-down'}`}>
                    {chartStats.trend.startsWith('+') ? '↗' : '↘'} {chartStats.trend}
                  </p>
                </div>
              </div>
              
              {/* Chart Legend */}
              <div className="chart-legend" style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#f8fafc', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#374151' }}>Chart Legend</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '20px', 
                      height: '3px', 
                      background: '#3b82f6', 
                      borderRadius: '2px' 
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Historical Data</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '20px', 
                      height: '3px', 
                      background: '#8b5cf6', 
                      borderRadius: '2px',
                      backgroundImage: 'repeating-linear-gradient(90deg, #8b5cf6 0px, #8b5cf6 8px, transparent 8px, transparent 12px)'
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Forecast (Dashed)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      background: '#ef4444', 
                      borderRadius: '50%' 
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>High Risk</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      background: '#f59e0b', 
                      borderRadius: '50%' 
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Medium Risk</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      background: '#10b981', 
                      borderRadius: '50%' 
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Low Risk</span>
                  </div>
                </div>
                
                {/* Toggle for forecast line */}
                <div style={{ 
                  marginTop: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem' 
                }}>
                  <input 
                    type="checkbox" 
                    id="show-forecast"
                    checked={showForecastLine}
                    onChange={(e) => setShowForecastLine(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  <label htmlFor="show-forecast" style={{ 
                    fontSize: '0.8rem', 
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    Show Forecast Predictions
                  </label>
                </div>
              </div>
            </div>
            
            <div className="python-integration-info">
              <h4>Python Integration Ready</h4>
              <p>This section is prepared for Python backend integration to process real-time data from Firebase Realtime Database.</p>
              <div className="integration-details">
                <div className="detail-item">
                  <strong>Data Source:</strong> Firebase Realtime Database
                </div>
                <div className="detail-item">
                  <strong>Update Frequency:</strong> Real-time (onValue listeners)
                </div>
                <div className="detail-item">
                  <strong>Python Processing:</strong> Ready for backend data processing
                </div>
                <div className="detail-item">
                  <strong>Chart Library:</strong> Custom SVG implementation
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Crime Forecasting Section */}
        <div className="forecasting-section" style={{ 
          marginTop: '2rem', 
          padding: '2rem', 
          background: '#f8fafc', 
          borderRadius: '12px', 
          border: '2px solid #e2e8f0' 
        }}>
          <div className="forecasting-header">
            <h3 style={{ 
              color: '#1e293b', 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '0.5rem' 
            }}>
              🔮 Crime Forecasting & Prediction
            </h3>
            <p style={{ 
              color: '#64748b', 
              fontSize: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              AI-powered predictions based on your Firebase Realtime Database
            </p>
          </div>
          
          <div className="forecasting-controls">
            <div className="control-group">
              <label htmlFor="forecast-period">Forecast Period:</label>
              <select 
                id="forecast-period" 
                className="forecasting-select"
                value={forecastPeriod}
                onChange={(e) => setForecastPeriod(e.target.value)}
              >
                <option value="1week">Next 1 Week</option>
                <option value="2weeks">Next 2 Weeks</option>
                <option value="1month">Next 1 Month</option>
              </select>
            </div>
            
            <div className="control-group">
              <label htmlFor="forecast-crime-type">Crime Type Focus:</label>
              <select 
                id="forecast-crime-type" 
                className="forecasting-select"
                value={forecastCrimeType}
                onChange={(e) => setForecastCrimeType(e.target.value)}
              >
                <option value="">All Crime Types</option>
                <option value="Assault">Assault</option>
                <option value="Theft">Theft</option>
                <option value="Vandalism">Vandalism</option>
                <option value="Fraud">Fraud</option>
                <option value="Harassment">Harassment</option>
                <option value="Breaking and Entering">Breaking and Entering</option>
                <option value="Vehicle Theft">Vehicle Theft</option>
                <option value="Drug-related">Drug-related</option>
                <option value="Domestic Violence">Domestic Violence</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button 
                className="train-ml-btn"
                onClick={async () => {
                  try {
                    setForecastLoading(true)
                    const results = await trainMLModels()
                    alert(`✅ ML Models Trained Successfully!\n\nAccuracy Results:\n${Object.entries(results).map(([crime, data]) => 
                      `${crime}: ${data.accuracy || 'N/A'}% accuracy`
                    ).join('\n')}`)
                  } catch (err) {
                    alert(`❌ ML Training Failed: ${err.message}`)
                  } finally {
                    setForecastLoading(false)
                  }
                }}
                disabled={forecastLoading}
                style={{
                  background: forecastLoading ? '#94a3b8' : '#10b981',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: forecastLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                {forecastLoading ? '🤖 Training ML...' : '🤖 Train ML Models'}
              </button>
              
              <button 
                className="generate-forecast-btn"
                onClick={fetchCrimeForecast}
                disabled={forecastLoading}
                style={{
                  background: forecastLoading ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: forecastLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                {forecastLoading ? '🔮 Generating Forecast...' : '🔮 Generate Crime Forecast'}
              </button>
            </div>
          </div>
          
          {forecastError && (
            <div className="forecast-error">
              <p>❌ {forecastError}</p>
            </div>
          )}
          
          {forecastData.length > 0 && (
            <div className="forecast-results">
              {/* Forecast Insights */}
              <div className="forecast-insights">
                <h4>📊 Forecast Summary</h4>
                <div className="insights-grid">
                  <div className="insight-card">
                    <h5>Total Predicted Crimes</h5>
                    <p className="insight-value">{forecastInsights.predictedCrimeCount}</p>
                  </div>
                  <div className="insight-card">
                    <h5>Risk Level</h5>
                    <p className={`insight-value risk-${forecastInsights.riskLevel.toLowerCase()}`}>
                      {forecastInsights.riskLevel}
                    </p>
                  </div>
                  <div className="insight-card">
                    <h5>Peak Hours</h5>
                    <p className="insight-value">
                      {forecastInsights.peakHours.map(h => `${h.hour}:00`).join(', ')}
                    </p>
                  </div>
                  <div className="insight-card">
                    <h5>High-Risk Days</h5>
                    <p className="insight-value">
                      {forecastInsights.peakDays.slice(0, 2).map(d => d.dayOfWeek).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Forecast Chart */}
              <div className="forecast-chart">
                <h4>📈 Daily Crime Predictions</h4>
                <div className="chart-container">
                  <svg className="forecast-svg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    <defs>
                      <pattern id="forecastGrid" width="40" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#forecastGrid)" />
                    
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
                          {Math.round(Math.max(...forecastData.map(d => d.predictedCrimes)) * (1 - ratio))}
                        </text>
                      </g>
                    ))}
                    
                    {/* X-axis labels */}
                    {forecastData.slice(0, 7).map((day, index) => (
                      <text 
                        key={index}
                        x={50 + (index * (700 / Math.max(1, Math.min(7, forecastData.length) - 1)))} 
                        y="280" 
                        textAnchor="middle" 
                        fontSize="10" 
                        fill="#64748b"
                      >
                        {day.date.split('-')[2]}
                      </text>
                    ))}
                    
                    {/* Forecast line */}
                    {forecastData.length > 1 && (
                      <path
                        d={forecastData.map((day, index) => {
                          const x = 50 + (index * (700 / Math.max(1, forecastData.length - 1)))
                          const maxValue = Math.max(...forecastData.map(d => d.predictedCrimes), 1)
                          const y = 50 + ((maxValue - day.predictedCrimes) / maxValue) * 200
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                        }).join(' ')}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="8,4"
                      />
                    )}
                    
                    {/* Data points with risk indicators */}
                    {forecastData.map((day, index) => {
                      const x = 50 + (index * (700 / Math.max(1, forecastData.length - 1)))
                      const maxValue = Math.max(...forecastData.map(d => d.predictedCrimes), 1)
                      const y = 50 + ((maxValue - day.predictedCrimes) / maxValue) * 200
                      const riskColor = day.riskLevel === 'High' ? '#ef4444' : 
                                       day.riskLevel === 'Medium' ? '#f59e0b' : '#10b981'
                      
                      return (
                        <g key={index}>
                          <circle
                            cx={x}
                            cy={y}
                            r="5"
                            fill={riskColor}
                            stroke="white"
                            strokeWidth="2"
                          />
                          <title>{`${day.date} (${day.dayOfWeek}): ${day.predictedCrimes} crimes - ${day.riskLevel} Risk`}</title>
                        </g>
                      )
                    })}
                    
                    {/* Chart title */}
                    <text 
                      x="400" 
                      y="30" 
                      textAnchor="middle" 
                      fontSize="16" 
                      fontWeight="600" 
                      fill="#1e293b"
                    >
                      Crime Forecast: {forecastPeriod === '1week' ? 'Next 7 Days' : 
                                     forecastPeriod === '2weeks' ? 'Next 14 Days' : 'Next 30 Days'}
                    </text>
                  </svg>
                </div>
              </div>
              
              {/* Recommendations */}
              {forecastInsights.recommendations.length > 0 && (
                <div className="forecast-recommendations">
                  <h4>💡 Recommendations</h4>
                  <ul className="recommendations-list">
                    {forecastInsights.recommendations.map((rec, index) => (
                      <li key={index} className="recommendation-item">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Detailed Forecast Table */}
              <div className="forecast-table">
                <h4>📅 Detailed Forecast</h4>
                <div className="table-container">
                  <table className="forecast-table-content">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Predicted Crimes</th>
                        <th>Risk Level</th>
                        <th>Peak Hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastData.slice(0, 14).map((day, index) => {
                        const peakHour = Object.entries(day.hourlyBreakdown)
                          .sort(([,a], [,b]) => b - a)[0]
                        return (
                          <tr key={index} className={`risk-${day.riskLevel.toLowerCase()}`}>
                            <td>{day.date}</td>
                            <td>{day.dayOfWeek}</td>
                            <td>{day.predictedCrimes}</td>
                            <td>
                              <span className={`risk-badge risk-${day.riskLevel.toLowerCase()}`}>
                                {day.riskLevel}
                              </span>
                            </td>
                            <td>{peakHour ? `${peakHour[0]}:00` : 'N/A'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analytics




