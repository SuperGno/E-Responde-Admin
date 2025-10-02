import { useState, useEffect } from 'react'
import { getDatabase, ref, get } from 'firebase/database'
import { app } from '../firebase'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './Heatmap.css'

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function Heatmap() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCrimeType, setSelectedCrimeType] = useState('')
  const [timeRange, setTimeRange] = useState('30')
  const [intensity, setIntensity] = useState(5)
  const [radius, setRadius] = useState(50)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        const db = getDatabase(app)
        const reportsRef = ref(db, 'civilian/civilian crime reports')
        const snapshot = await get(reportsRef)

        if (snapshot.exists()) {
          const reportsData = snapshot.val()
          const reportsArray = Object.entries(reportsData).map(([key, data]) => ({
            id: key,
            ...data
          }))
          setReports(reportsArray)
        } else {
          setReports([])
        }
      } catch (err) {
        console.error('Error fetching reports:', err)
        setError('Failed to load crime reports')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
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

  // Create crime density clusters
  const createCrimeClusters = () => {
    const filteredReports = getFilteredReports()
    const clusters = new Map()
    const clusterRadius = 0.01 * (radius / 50) // Adjust clustering based on radius setting

    filteredReports.forEach(report => {
      const lat = parseFloat(report.location.latitude)
      const lng = parseFloat(report.location.longitude)
      
      // Find existing cluster or create new one
      let foundCluster = null
      for (const [key, cluster] of clusters) {
        const distance = Math.sqrt(
          Math.pow(lat - cluster.lat, 2) + Math.pow(lng - cluster.lng, 2)
        )
        if (distance < clusterRadius) {
          foundCluster = cluster
          break
        }
      }

      if (foundCluster) {
        foundCluster.count++
        foundCluster.reports.push(report)
      } else {
        clusters.set(`${lat},${lng}`, {
          lat,
          lng,
          count: 1,
          reports: [report]
        })
      }
    })

    return Array.from(clusters.values())
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

  if (loading) {
    return (
      <div className="heatmap-container">
        <div className="loading">Loading heatmap data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="heatmap-container">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h1>Crime Heatmap</h1>
        <p>Visual representation of crime incidents across the area</p>
      </div>

      <div className="heatmap-content">
        <div className="map-container">
          <div className="map-wrapper">
            <MapContainer
              center={[14.6042, 120.9822]} // Manila, Philippines
              zoom={11}
              style={{ height: '400px', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {createCrimeClusters().map((cluster, index) => (
                <CircleMarker
                  key={index}
                  center={[cluster.lat, cluster.lng]}
                  radius={getMarkerSize(cluster.count)}
                  pathOptions={{
                    color: getMarkerColor(cluster.count),
                    fillColor: getMarkerColor(cluster.count),
                    fillOpacity: getMarkerOpacity(),
                    weight: 2
                  }}
                >
                  <Popup>
                    <div className="crime-popup">
                      <h4>Crime Cluster</h4>
                      <p><strong>Crime Count:</strong> {cluster.count}</p>
                      <p><strong>Location:</strong> {cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}</p>
                      <div className="crime-types">
                        <strong>Crime Types:</strong>
                        <ul>
                          {cluster.reports.map((report, i) => (
                            <li key={i}>{report.crimeType || 'Unknown'}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
            <div className="map-legend">
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '600', color: '#000000' }}>Crime Density</h4>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#16a34a' }}></div>
                <span className="legend-label">1 crime</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#ca8a04' }}></div>
                <span className="legend-label">2 crimes</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#d97706' }}></div>
                <span className="legend-label">3 crimes</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#ea580c' }}></div>
                <span className="legend-label">5+ crimes</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#dc2626' }}></div>
                <span className="legend-label">10+ crimes</span>
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
              <small style={{ color: '#718096', fontSize: '0.75rem' }}>
                Controls marker opacity
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
              <small style={{ color: '#718096', fontSize: '0.75rem' }}>
                Controls marker size & clustering
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="reports-list">
        <h3>Recent Reports with Location</h3>
        <div className="reports-grid">
          {getFilteredReports()
            .slice(0, 6)
            .map((report) => (
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
      </div>
    </div>
  )
}

export default Heatmap
