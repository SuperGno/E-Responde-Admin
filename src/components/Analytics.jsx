import { useState, useEffect } from 'react'

function Analytics() {
  const [forecastingData, setForecastingData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [crimeTypes, setCrimeTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedCrimeType, setSelectedCrimeType] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedMonths, setSelectedMonths] = useState(12)

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
    }
    
    initializeData()
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

  return (
    <div className="page-content">
      <h1>Analytics</h1>
      <div className="analytics-content">
        <div className="chart-placeholder">
          <h3>User Engagement Chart</h3>
          <div className="chart">
            <div className="bar" style={{ height: '60%' }}></div>
            <div className="bar" style={{ height: '80%' }}></div>
            <div className="bar" style={{ height: '45%' }}></div>
            <div className="bar" style={{ height: '90%' }}></div>
            <div className="bar" style={{ height: '70%' }}></div>
            <div className="bar" style={{ height: '85%' }}></div>
            <div className="bar" style={{ height: '55%' }}></div>
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
        
        <div className="metrics">
          <div className="metric-card">
            <h4>Page Views</h4>
            <p>12,345</p>
          </div>
          <div className="metric-card">
            <h4>Bounce Rate</h4>
            <p>23.4%</p>
          </div>
          <div className="metric-card">
            <h4>Session Duration</h4>
            <p>4m 32s</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics




