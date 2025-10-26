import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off } from 'firebase/database'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import './Analytics.css'
import './Heatmap.css'
import AnalyticsDashboard from './AnalyticsDashboard'

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
    
    return () => {
      off(reportsRef, 'value', unsubscribeReports)
      off(callsRef, 'value', unsubscribeCalls)
      off(alertsRef, 'value', unsubscribeAlerts)
    }
  }, [])



  // Reset heatmap page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCrimeTypeHeatmap, timeRange])



  const userEngagementData = [
    { month: 'Jan', engagement: 75, crimeCount: 12 },
    { month: 'Feb', engagement: 85, crimeCount: 8 },
    { month: 'Mar', engagement: 65, crimeCount: 18 },
    { month: 'Apr', engagement: 90, crimeCount: 5 },
    { month: 'May', engagement: 70, crimeCount: 15 },
    { month: 'Jun', engagement: 80, crimeCount: 10 },
    { month: 'Jul', engagement: 60, crimeCount: 20 }
  ]
  const maxEngagement = Math.max(...userEngagementData.map(d => d.engagement))

  // Create heatmap data and filtered data
  const heatmapData = createHeatmapData()
  const filteredHeatmapData = getFilteredReports().reduce((clusters, report) => {
    try {
      let lat, lng
      
      if (report.location) {
        lat = parseFloat(report.location.latitude || report.location.lat)
        lng = parseFloat(report.location.longitude || report.location.lng)
      } else {
        lat = parseFloat(report.latitude || report.lat)
        lng = parseFloat(report.longitude || report.lng)
      }
      
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return clusters
      
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const existingCluster = clusters.find(c => c.key === key)
      
      if (existingCluster) {
        existingCluster.count++
        existingCluster.reports.push(report)
      } else {
        clusters.push({
          key,
          lat,
          lng,
          count: 1,
          reports: [report]
        })
      }
    } catch (error) {
      console.warn('Error processing report for filtered data:', report.id, error)
    }
    
    return clusters
  }, [])

  return (
    <div className="page-content">
      <div className="analytics-content">
        {/* Unified Analytics Header */}
        <div className="analytics-header">
          <h2>Crime Trend Analytics</h2>
        </div>

        {/* Analytics Dashboard with Line Chart */}
        <div className="mb-8">
          <AnalyticsDashboard />
        </div>

         {/* Interactive Crime Heatmap */}
         <div className="heatmap-section">
           <div className="heatmap-header">
             <h3>Crime Heatmap</h3>
             
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
      </div>
    </div>
  )
}

export default Analytics
