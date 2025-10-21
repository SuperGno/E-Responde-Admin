import { useState, useEffect } from 'react'
import { getDatabase, ref, get, onValue } from 'firebase/database'
import { app } from '../firebase'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import './Heatmap.css'

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
    
    // Create heatmap layer
    const heatmapLayer = L.heatLayer(data, {
      radius: radius,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: 'blue',
        0.2: 'cyan',
        0.4: 'lime',
        0.6: 'yellow',
        0.8: 'orange',
        1.0: 'red'
      }
    }).addTo(map)
    
    return () => {
      map.removeLayer(heatmapLayer)
    }
  }, [data, intensity, radius, map])
  
  return null
}

// ConcentricCircles component for distance reference
function ConcentricCircles({ center, radius }) {
  const map = useMap()
  
  useEffect(() => {
    if (!center) return
    
    const circles = []
    const distances = [0.25, 0.5, 1, 2] // km
    
    distances.forEach((distance, index) => {
      const circle = L.circle(center, {
        radius: distance * 1000, // Convert km to meters
        color: '#ff6b35',
        weight: 2,
        opacity: 0.8,
        fill: false,
        dashArray: '5, 5'
      }).addTo(map)
      
      // Add distance label
      const label = L.marker(center, {
        icon: L.divIcon({
          html: `<div style="
            background: rgba(255, 107, 53, 0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-align: center;
            border: 1px solid white;
          ">${distance} km</div>`,
          className: 'distance-label',
          iconSize: [50, 20],
          iconAnchor: [25, 10]
        })
      }).addTo(map)
      
      circles.push(circle, label)
    })
    
    return () => {
      circles.forEach(circle => map.removeLayer(circle))
    }
  }, [center, map])
  
  return null
}

function Heatmap() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCrimeType, setSelectedCrimeType] = useState('')
  const [timeRange, setTimeRange] = useState('30')
  const [intensity, setIntensity] = useState(5)
  const [radius, setRadius] = useState(50)
  const [showConcentricCircles, setShowConcentricCircles] = useState(false)
  const [referencePoint, setReferencePoint] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [reportsPerPage] = useState(6)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Real-time data listener
  useEffect(() => {
    const db = getDatabase(app)
    const reportsRef = ref(db, 'civilian/civilian crime reports')
    
    console.log('Setting up real-time listener for heatmap...')
    
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      try {
        setLoading(true)
        setError('')
        
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
          setLastUpdate(new Date())
          console.log(`Real-time update: Loaded ${reportsArray.length} reports`)
        } else {
          setReports([])
          setError('No crime reports found. Reports will appear here when submitted from the mobile app.')
        }
      } catch (err) {
        console.error('Error processing real-time data:', err)
        setError(`Failed to process crime reports: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }, (error) => {
      console.error('Real-time listener error:', error)
      setError(`Database connection error: ${error.message}`)
      setLoading(false)
    })

    return () => {
      console.log('Cleaning up real-time listener')
      unsubscribe()
    }
  }, [])

  // Filter reports based on selected criteria
  const getFilteredReports = () => {
    let filtered = reports.filter(report => 
      report.location?.latitude && report.location?.longitude
    )

    // Filter by crime type
    if (selectedCrimeType) {
      filtered = filtered.filter(report => 
        report.crimeType?.toLowerCase().includes(selectedCrimeType.toLowerCase())
      )
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

  // Get marker color based on crime count
  const getMarkerColor = (count) => {
    if (count >= 10) return '#dc2626' // Red
    if (count >= 5) return '#ea580c'  // Orange
    if (count >= 3) return '#d97706'  // Amber
    if (count >= 2) return '#ca8a04'  // Yellow
    return '#16a34a' // Green
  }

  // Get marker size based on crime count and radius setting
  const getMarkerSize = (count) => {
    const baseSize = Math.max(8, Math.min(25, count * 2))
    return Math.max(5, Math.min(30, baseSize * (radius / 50)))
  }

  // Get marker opacity based on intensity setting
  const getMarkerOpacity = () => {
    return Math.max(0.3, Math.min(0.9, intensity / 10))
  }

  // Pagination logic for reports
  const getPaginatedReports = () => {
    const filteredReports = getFilteredReports()
    const startIndex = (currentPage - 1) * reportsPerPage
    const endIndex = startIndex + reportsPerPage
    return filteredReports.slice(startIndex, endIndex)
  }

  const totalPages = Math.ceil(getFilteredReports().length / reportsPerPage)

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCrimeType, timeRange])

  if (loading) {
    return (
      <div className="heatmap-container">
        <div className="loading">
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🗺️</div>
          <div>Loading heatmap data...</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>
            Connecting to mobile app data...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="heatmap-container">
        <div className="error">
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚠️</div>
          <div>Error: {error}</div>
          <div style={{ fontSize: '0.9rem', marginTop: '1rem', opacity: 0.8 }}>
            <strong>Troubleshooting:</strong>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <li>Ensure the mobile app is connected to the same Firebase project</li>
              <li>Check that crime reports are being submitted from the mobile app</li>
              <li>Verify Firebase database rules allow read access</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h1>Crime Heatmap</h1>
        <p>Visual representation of crime incidents across the area</p>
        
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
            <strong style={{ color: '#1e293b', fontSize: '1rem' }}>📊 Real-time Data Status</strong>
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
          {reports.length === 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <strong style={{ color: '#92400e' }}>💡 Real-time Connection:</strong> 
              <p style={{ margin: '0.5rem 0', color: '#92400e' }}>
                No reports found. The heatmap will automatically update when new crime reports are submitted from the mobile app.
              </p>
            </div>
          )}
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
                data={createHeatmapData()} 
                intensity={intensity} 
                radius={radius} 
              />
              
              {/* Concentric Circles for distance reference */}
              {showConcentricCircles && referencePoint && (
                <ConcentricCircles center={referencePoint} radius={radius} />
              )}
              
              {/* Reference point marker */}
              {referencePoint && (
                <Marker position={referencePoint}>
                  <Popup>
                    <div className="reference-popup">
                      <h4>Reference Point</h4>
                      <p><strong>Location:</strong> {referencePoint[0].toFixed(4)}, {referencePoint[1].toFixed(4)}</p>
                      <p>Distance circles show 0.25km, 0.5km, 1km, and 2km radius</p>
                    </div>
                  </Popup>
                </Marker>
              )}
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
            </div>
          </div>
        </div>

        <div className="heatmap-controls">
          <div className="control-section">
            <h3>Filter Options</h3>
            <div className="filter-group">
              <label>Crime Type:</label>
              <select 
                value={selectedCrimeType} 
                onChange={(e) => setSelectedCrimeType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="theft">Theft</option>
                <option value="breaking">Breaking and Entering</option>
                <option value="assault">Assault</option>
                <option value="vandalism">Vandalism</option>
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
              <label>
                <input 
                  type="checkbox" 
                  checked={showConcentricCircles}
                  onChange={(e) => setShowConcentricCircles(e.target.checked)}
                  style={{ marginRight: '0.5rem' }}
                />
                Show Distance Circles
              </label>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Display concentric circles for distance reference
              </small>
            </div>
            {showConcentricCircles && (
              <div className="setting-group">
                <label>Set Reference Point</label>
                <button 
                  onClick={() => setReferencePoint([14.60873355945734, 120.96718066988043])}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Center on Moriones-Tondo Police Station
                </button>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  Click to set reference point for distance circles
                </small>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="reports-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Recent Reports with Location</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              Page {currentPage} of {totalPages} ({getFilteredReports().length} total)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentPage === 1 ? '#f3f4f6' : '#3b82f6',
                  color: currentPage === 1 ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentPage === totalPages ? '#f3f4f6' : '#3b82f6',
                  color: currentPage === totalPages ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        <div className="reports-grid">
          {getPaginatedReports().map((report) => (
            <div key={report.id} className="report-item">
              <div className="report-info">
                <h4>{report.crimeType || 'Unknown'}</h4>
                <p>{report.location?.address || 'No address'}</p>
                <span className="report-date">
                  {new Date(report.dateTime || report.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="report-coords">
                <small>
                  {report.location?.latitude?.toFixed(4)}, {report.location?.longitude?.toFixed(4)}
                </small>
              </div>
            </div>
          ))}
        </div>
        {getFilteredReports().length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: '#6b7280',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <p>No reports found with the current filters.</p>
            <small>Try adjusting the crime type or time range filters.</small>
          </div>
        )}
      </div>
    </div>
  )
}

export default Heatmap
