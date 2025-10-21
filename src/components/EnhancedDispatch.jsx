import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off, update, query, orderByChild, equalTo } from 'firebase/database'
import './EnhancedDispatch.css'

function EnhancedDispatch() {
  const [reports, setReports] = useState([])
  const [patrolUnits, setPatrolUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchData, setDispatchData] = useState({
    unit: '',
    priority: 'medium',
    notes: '',
    estimatedTime: ''
  })
  const [isDispatching, setIsDispatching] = useState(false)
  const [realTimeStats, setRealTimeStats] = useState({
    totalReports: 0,
    activeDispatches: 0,
    availableUnits: 0,
    averageResponseTime: 0
  })
  const [liveTracking, setLiveTracking] = useState({})
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')

  useEffect(() => {
    fetchData()
    setupRealTimeListeners()
    
    return () => {
      // Cleanup listeners
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const unitsRef = ref(realtimeDb, 'police/police account')
      off(reportsRef, 'value')
      off(unitsRef, 'value')
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Fetch reports and patrol units in parallel
      const [reportsSnapshot, unitsSnapshot] = await Promise.all([
        get(ref(realtimeDb, 'civilian/civilian crime reports')),
        get(ref(realtimeDb, 'police/police account'))
      ])
      
      // Process reports
      const reportsList = []
      if (reportsSnapshot.exists()) {
        const reportsData = reportsSnapshot.val()
        Object.keys(reportsData).forEach(reportId => {
          const report = reportsData[reportId]
          reportsList.push({
            id: reportId,
            ...report,
            createdAt: new Date(report.createdAt || report.dateTime),
            dispatchedAt: report.dispatchInfo?.dispatchedAt ? new Date(report.dispatchInfo.dispatchedAt) : null
          })
        })
      }
      
      // Process patrol units
      const unitsList = []
      if (unitsSnapshot.exists()) {
        const unitsData = unitsSnapshot.val()
        Object.keys(unitsData).forEach(unitId => {
          const unit = unitsData[unitId]
          if (unit.email && unit.firstName) {
            const currentLocation = unit.currentLocation || {}
            unitsList.push({
              id: unitId,
              ...unit,
              latitude: currentLocation.latitude || unit.latitude || 14.5995,
              longitude: currentLocation.longitude || unit.longitude || 120.9842,
              lastLocationUpdate: currentLocation.lastUpdated || null,
              status: unit.isActive !== false ? 'Available' : 'Unavailable'
            })
          }
        })
      }
      
      // Sort reports by creation date (newest first)
      reportsList.sort((a, b) => b.createdAt - a.createdAt)
      setReports(reportsList)
      setPatrolUnits(unitsList)
      
      // Calculate real-time stats
      calculateRealTimeStats(reportsList, unitsList)
      
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load dispatch data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const setupRealTimeListeners = () => {
    // Listen for reports changes
    const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
    onValue(reportsRef, (snapshot) => {
      if (snapshot.exists()) {
        const reportsData = snapshot.val()
        const reportsList = []
        
        Object.keys(reportsData).forEach(reportId => {
          const report = reportsData[reportId]
          reportsList.push({
            id: reportId,
            ...report,
            createdAt: new Date(report.createdAt || report.dateTime),
            dispatchedAt: report.dispatchInfo?.dispatchedAt ? new Date(report.dispatchInfo.dispatchedAt) : null
          })
        })
        
        reportsList.sort((a, b) => b.createdAt - a.createdAt)
        setReports(reportsList)
        calculateRealTimeStats(reportsList, patrolUnits)
      }
    })
    
    // Listen for patrol units changes
    const unitsRef = ref(realtimeDb, 'police/police account')
    onValue(unitsRef, (snapshot) => {
      if (snapshot.exists()) {
        const unitsData = snapshot.val()
        const unitsList = []
        
        Object.keys(unitsData).forEach(unitId => {
          const unit = unitsData[unitId]
          if (unit.email && unit.firstName) {
            const currentLocation = unit.currentLocation || {}
            unitsList.push({
              id: unitId,
              ...unit,
              latitude: currentLocation.latitude || unit.latitude || 14.5995,
              longitude: currentLocation.longitude || unit.longitude || 120.9842,
              lastLocationUpdate: currentLocation.lastUpdated || null,
              status: unit.isActive !== false ? 'Available' : 'Unavailable'
            })
          }
        })
        
        setPatrolUnits(unitsList)
        calculateRealTimeStats(reports, unitsList)
      }
    })
  }

  const calculateRealTimeStats = (reportsList, unitsList) => {
    const totalReports = reportsList.length
    const activeDispatches = reportsList.filter(report => 
      report.status?.toLowerCase() === 'dispatched' || 
      report.status?.toLowerCase() === 'in progress'
    ).length
    const availableUnits = unitsList.filter(unit => 
      unit.status === 'Available'
    ).length
    
    // Calculate average response time
    const dispatchedReports = reportsList.filter(report => 
      report.dispatchInfo?.dispatchedAt
    )
    
    let totalResponseTime = 0
    dispatchedReports.forEach(report => {
      if (report.dispatchInfo?.dispatchedAt && report.createdAt) {
        const responseTime = (report.dispatchInfo.dispatchedAt - report.createdAt) / 1000 / 60 // in minutes
        totalResponseTime += responseTime
      }
    })
    
    const averageResponseTime = dispatchedReports.length > 0 
      ? totalResponseTime / dispatchedReports.length 
      : 0
    
    setRealTimeStats({
      totalReports,
      activeDispatches,
      availableUnits,
      averageResponseTime: Math.round(averageResponseTime)
    })
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const distance = R * c
    return distance
  }

  const sortPatrolUnitsByDistance = (units, crimeLat, crimeLon) => {
    if (!crimeLat || !crimeLon) return units

    return units.map(unit => {
      const unitLat = parseFloat(unit.latitude || 0)
      const unitLon = parseFloat(unit.longitude || 0)
      
      if (unitLat && unitLon && unitLat !== 0 && unitLon !== 0) {
        const distance = calculateDistance(crimeLat, crimeLon, unitLat, unitLon)
        return { ...unit, distance: distance }
      } else {
        return { ...unit, distance: 999999 }
      }
    }).sort((a, b) => {
      if (a.status === 'Available' && b.status !== 'Available') return -1
      if (b.status === 'Available' && a.status !== 'Available') return 1
      return a.distance - b.distance
    })
  }

  const handleDispatchReport = (report) => {
    setSelectedReport(report)
    setShowDispatchModal(true)
    
    // Sort patrol units by distance to crime location
    if (report.location?.latitude && report.location?.longitude) {
      const crimeLat = parseFloat(report.location.latitude)
      const crimeLon = parseFloat(report.location.longitude)
      const sortedUnits = sortPatrolUnitsByDistance(patrolUnits, crimeLat, crimeLon)
      setPatrolUnits(sortedUnits)
    }
    
    setDispatchData({
      unit: '',
      priority: 'medium',
      notes: '',
      estimatedTime: ''
    })
  }

  const handleCloseModal = () => {
    setShowDispatchModal(false)
    setSelectedReport(null)
    setDispatchData({
      unit: '',
      priority: 'medium',
      notes: '',
      estimatedTime: ''
    })
  }

  const handleDispatchSubmit = async () => {
    if (!selectedReport || !dispatchData.unit) {
      alert('Please fill in all required fields')
      return
    }

    if (isDispatching) {
      alert('Dispatch is already in progress. Please wait...')
      return
    }

    setIsDispatching(true)

    try {
      const selectedUnit = patrolUnits.find(unit => unit.id === dispatchData.unit)
      if (!selectedUnit) {
        alert('Selected police unit not found. Please refresh and try again.')
        return
      }

      const dispatchInfo = {
        unit: dispatchData.unit,
        unitName: `${selectedUnit.policeRank} ${selectedUnit.firstName} ${selectedUnit.lastName}`,
        unitEmail: selectedUnit.email,
        priority: dispatchData.priority,
        notes: dispatchData.notes,
        estimatedTime: dispatchData.estimatedTime,
        dispatchedAt: new Date().toISOString(),
        dispatchedBy: 'admin@e-responde.com'
      }

      // Update the crime report
      const reportRef = ref(realtimeDb, `civilian/civilian crime reports/${selectedReport.id}`)
      await update(reportRef, {
        status: 'Dispatched',
        dispatchInfo: dispatchInfo
      })
      
      // Create notification for the dispatched police officer
      const notificationId = `dispatch_${selectedReport.id}_${Date.now()}`
      const notificationRef = ref(realtimeDb, `police/notifications/${selectedUnit.id}/${notificationId}`)
      
      const notificationData = {
        id: notificationId,
        type: 'dispatch_assignment',
        title: 'New Dispatch Assignment',
        message: `You have been assigned to respond to a ${selectedReport.crimeType || 'emergency'} report.`,
        reportId: selectedReport.id,
        reportDetails: {
          crimeType: selectedReport.crimeType || 'Emergency',
          location: selectedReport.location?.address || 'Location not available',
          reporterName: selectedReport.reporterName || 'Anonymous',
          description: selectedReport.description || 'No description provided',
          priority: dispatchData.priority,
          estimatedTime: dispatchData.estimatedTime,
          notes: dispatchData.notes
        },
        dispatchInfo: dispatchInfo,
        createdAt: new Date().toISOString(),
        isRead: false,
        isActive: true
      }

      await update(notificationRef, notificationData)

      // Update local state
      setReports(prev => prev.filter(report => report.id !== selectedReport.id))
      handleCloseModal()
      
      alert(`Report dispatched successfully! ${selectedUnit.policeRank} ${selectedUnit.firstName} ${selectedUnit.lastName} has been notified.`)
    } catch (err) {
      console.error('Error dispatching report:', err)
      alert('Failed to dispatch report. Please try again.')
    } finally {
      setIsDispatching(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#dc2626'
      case 'medium': return '#d97706'
      case 'low': return '#16a34a'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return '#f59e0b'
      case 'received': return '#3b82f6'
      case 'in progress': return '#8b5cf6'
      case 'dispatched': return '#10b981'
      case 'resolved': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const filteredReports = reports.filter(report => {
    const statusMatch = filterStatus === 'all' || report.status?.toLowerCase() === filterStatus
    const priorityMatch = filterPriority === 'all' || report.priority?.toLowerCase() === filterPriority
    return statusMatch && priorityMatch
  })

  if (loading) {
    return (
      <div className="enhanced-dispatch-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading enhanced dispatch system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="enhanced-dispatch-container">
      <div className="dispatch-header">
        <h1>Enhanced Dispatch Center</h1>
        <p>Real-time emergency response management with live tracking</p>
      </div>

      {/* Real-time Statistics */}
      <div className="real-time-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Reports</h3>
            <p className="stat-number">{realTimeStats.totalReports}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <h3>Active Dispatches</h3>
            <p className="stat-number">{realTimeStats.activeDispatches}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">👮</div>
          <div className="stat-content">
            <h3>Available Units</h3>
            <p className="stat-number">{realTimeStats.availableUnits}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <h3>Avg Response</h3>
            <p className="stat-number">{realTimeStats.averageResponseTime}m</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Status Filter:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="in progress">In Progress</option>
            <option value="dispatched">Dispatched</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Priority Filter:</label>
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Priority</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
        
        <button onClick={fetchData} className="refresh-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23,4 23,10 17,10"></polyline>
            <polyline points="1,20 1,14 7,14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      {/* Reports Grid */}
      <div className="reports-section">
        <h2>Emergency Reports</h2>
        {filteredReports.length === 0 ? (
          <div className="no-reports">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            <h3>No Reports Found</h3>
            <p>No emergency reports match your current filters.</p>
          </div>
        ) : (
          <div className="reports-grid">
            {filteredReports.map((report) => (
              <div key={report.id} className="report-card">
                <div className="report-header">
                  <div className="report-type">
                    <span className="type-badge">{report.crimeType || 'Unknown'}</span>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: getStatusColor(report.status) }}
                    >
                      {report.status}
                    </span>
                    {report.priority && (
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(report.priority) }}
                      >
                        {report.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="report-time">
                    {formatDate(report.createdAt)}
                  </div>
                </div>
                
                <div className="report-details">
                  <div className="detail-item">
                    <strong>Location:</strong> {report.location?.address || 'No location'}
                  </div>
                  <div className="detail-item">
                    <strong>Reporter:</strong> {report.reporterName || 'Anonymous'}
                  </div>
                  <div className="detail-item">
                    <strong>Description:</strong> 
                    <p className="description-text">
                      {report.description || 'No description provided'}
                    </p>
                  </div>
                  
                  {report.dispatchInfo && (
                    <div className="dispatch-info">
                      <strong>Dispatched to:</strong> {report.dispatchInfo.unitName}
                      <br />
                      <strong>Dispatched at:</strong> {formatDate(report.dispatchInfo.dispatchedAt)}
                      <br />
                      <strong>Priority:</strong> {report.dispatchInfo.priority}
                    </div>
                  )}
                </div>

                <div className="report-actions">
                  {!report.dispatchInfo && (
                    <button 
                      className="dispatch-btn"
                      onClick={() => handleDispatchReport(report)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                      </svg>
                      Dispatch Unit
                    </button>
                  )}
                  
                  {report.dispatchInfo && (
                    <button className="view-dispatch-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      View Dispatch
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content dispatch-modal">
            <div className="modal-header">
              <h3>Dispatch Response Unit</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="report-summary">
                <h4>Report Details</h4>
                <p><strong>Type:</strong> {selectedReport.crimeType}</p>
                <p><strong>Location:</strong> {selectedReport.location?.address}</p>
                <p><strong>Reporter:</strong> {selectedReport.reporterName}</p>
                <p><strong>Priority:</strong> {selectedReport.priority || 'Medium'}</p>
              </div>

              {/* Proximity Recommendations */}
              {patrolUnits.length > 0 && patrolUnits[0].distance !== undefined && patrolUnits[0].distance < 999999 && (
                <div className="proximity-recommendations">
                  <h4>Recommended Patrol Units (Sorted by Distance)</h4>
                  <div className="recommendations-list">
                    {patrolUnits.slice(0, 3).map((unit, index) => (
                      <div key={unit.id} className="recommendation-item">
                        <strong>{index + 1}.</strong> {unit.policeRank} {unit.firstName} {unit.lastName} 
                        <span className={`status-indicator ${unit.status === 'Available' ? 'available' : 'unavailable'}`}>
                          ({unit.status})
                        </span>
                        {' '}- {unit.distance.toFixed(1)} km away
                        {index === 0 && <span className="nearest-badge"> - NEAREST</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="dispatch-form">
                <div className="form-group">
                  <label>Response Unit *</label>
                  {patrolUnits.length > 0 && patrolUnits[0].distance !== undefined && (
                    <small className="form-help">
                      Units sorted by proximity to crime location
                    </small>
                  )}
                  <select
                    value={dispatchData.unit}
                    onChange={(e) => setDispatchData({...dispatchData, unit: e.target.value})}
                    required
                  >
                    <option value="">Select a patrol unit...</option>
                    {patrolUnits.map((unit, index) => {
                      const isNearest = index === 0 && unit.distance !== undefined && unit.distance < 999999
                      const isAvailable = unit.status === 'Available'
                      const distanceText = unit.distance !== undefined && unit.distance < 999999 
                        ? ` (${unit.distance.toFixed(1)} km away)` 
                        : ' (Location unknown)'
                      
                      return (
                        <option key={unit.id} value={unit.id}>
                          {isNearest ? '[NEAREST] ' : ''}{unit.policeRank} {unit.firstName} {unit.lastName} - {unit.status}
                          {distanceText}
                          {isNearest ? ' - NEAREST' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority Level</label>
                  <select
                    value={dispatchData.priority}
                    onChange={(e) => setDispatchData({...dispatchData, priority: e.target.value})}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Estimated Response Time</label>
                  <input
                    type="text"
                    value={dispatchData.estimatedTime}
                    onChange={(e) => setDispatchData({...dispatchData, estimatedTime: e.target.value})}
                    placeholder="e.g., 15 minutes, 30 minutes"
                  />
                </div>

                <div className="form-group">
                  <label>Dispatch Notes</label>
                  <textarea
                    value={dispatchData.notes}
                    onChange={(e) => setDispatchData({...dispatchData, notes: e.target.value})}
                    placeholder="Additional instructions or information for the response unit..."
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal}>
                Cancel
              </button>
              <button 
                className="dispatch-btn"
                onClick={handleDispatchSubmit}
                disabled={isDispatching}
              >
                {isDispatching ? 'Dispatching...' : 'Dispatch Unit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedDispatch
