import { useState, useEffect } from 'react'
import { getDatabase, ref, get, update } from 'firebase/database'
import { app } from '../firebase'
import './Dispatch.css'

function Dispatch() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [patrolUnits, setPatrolUnits] = useState([])
  const [sortedPatrolUnits, setSortedPatrolUnits] = useState([])
  const [dispatchData, setDispatchData] = useState({
    unit: '',
    priority: 'medium',
    notes: '',
    estimatedTime: ''
  })
  const [isDispatching, setIsDispatching] = useState(false)

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  // Sort patrol units by distance to crime location
  const sortPatrolUnitsByDistance = (units, crimeLat, crimeLon) => {
    if (!crimeLat || !crimeLon) {
      console.log('No crime location provided, returning unsorted units');
      return units; // Return unsorted if no crime location
    }

    console.log(`Sorting ${units.length} patrol units by distance to crime location: ${crimeLat}, ${crimeLon}`);

    return units.map(unit => {
      const unitLat = parseFloat(unit.latitude || 0);
      const unitLon = parseFloat(unit.longitude || 0);
      
      if (unitLat && unitLon && unitLat !== 0 && unitLon !== 0) {
        const distance = calculateDistance(crimeLat, crimeLon, unitLat, unitLon);
        console.log(`Unit ${unit.firstName} ${unit.lastName} is ${distance.toFixed(2)} km away`);
        return { ...unit, distance: distance };
      } else {
        console.log(`Unit ${unit.firstName} ${unit.lastName} has no valid location data`);
        return { ...unit, distance: 999999 }; // Put units without location at the end
      }
    }).sort((a, b) => {
      // Sort by distance, but prioritize available units
      if (a.status === 'Available' && b.status !== 'Available') return -1;
      if (b.status === 'Available' && a.status !== 'Available') return 1;
      return a.distance - b.distance;
    });
  }

  // Fetch police accounts from Realtime Database
  const fetchPatrolUnits = async () => {
    try {
      console.log('Starting to fetch police accounts from Realtime Database...')
      const db = getDatabase(app)
      const policeAccountsRef = ref(db, 'police/police account')
      console.log('Realtime Database reference created for police/police account')
      
      const snapshot = await get(policeAccountsRef)
      console.log('Snapshot received:', snapshot)
      console.log('Snapshot exists:', snapshot.exists())
      
      const units = []
      if (snapshot.exists()) {
        const policeData = snapshot.val()
        console.log('Police data:', policeData)
        
        Object.keys(policeData).forEach(accountId => {
          const accountData = policeData[accountId]
          console.log('Processing police account:', accountId, accountData)
          
          if (accountData.email && accountData.firstName) {
            // Extract location data from currentLocation object
            const currentLocation = accountData.currentLocation || {}
            const latitude = currentLocation.latitude || accountData.latitude || null
            const longitude = currentLocation.longitude || accountData.longitude || null
            
            // Debug location data
            console.log(`Location data for ${accountData.firstName}:`, {
              currentLocation: currentLocation,
              latitude: latitude,
              longitude: longitude,
              hasCurrentLocation: !!accountData.currentLocation,
              hasDirectLat: !!accountData.latitude,
              hasDirectLon: !!accountData.longitude
            })
            
            // Temporary: Add default location for testing if no location data exists
            let finalLatitude = latitude
            let finalLongitude = longitude
            
            if (!finalLatitude || !finalLongitude) {
              console.warn(`No location data found for ${accountData.firstName}. Adding default Manila location for testing.`)
              // Default to Manila coordinates for testing
              finalLatitude = 14.5995
              finalLongitude = 120.9842
            }
            
            const unit = {
              id: accountId,
              policeId: accountData.policeId || accountData.police_id || accountId,
              firstName: accountData.firstName,
              lastName: accountData.lastName || '',
              email: accountData.email,
              policeRank: accountData.policeRank || 'Officer',
              status: accountData.isActive !== false ? 'Available' : 'Unavailable',
              isActive: accountData.isActive !== false,
              contactNumber: accountData.contactNumber || '',
              latitude: finalLatitude,
              longitude: finalLongitude,
              lastLocationUpdate: currentLocation.lastUpdated || null,
              ...accountData
            }
            units.push(unit)
            console.log('Added police unit with location:', unit)
          }
        })
      }
      
      setPatrolUnits(units)
      console.log('Police accounts loaded successfully:', units)
      
      // If no units found, show a message
      if (units.length === 0) {
        console.warn('No police accounts found in Realtime Database at "police/police account"')
        console.log('Please check your Realtime Database structure and data')
      }
    } catch (err) {
      console.error('Error fetching police accounts:', err)
      console.error('Error details:', err.message)
      console.error('Error code:', err.code)
      
      // Show error message instead of fallback
      console.log('Failed to load police accounts from Realtime Database. Please check console for errors.')
      setPatrolUnits([])
    }
  }

  // Test Firebase connection
  const testFirebaseConnection = async () => {
    try {
      console.log('Testing Firebase connection...')
      console.log('Firebase app:', app)
      
      const db = getDatabase(app)
      console.log('Firebase database instance:', db)
      
      if (!db) {
        throw new Error('Database instance is null')
      }
      
      // Test read access to a simple path
      const testRef = ref(db, 'test')
      console.log('Test reference created:', testRef.toString())
      
      const snapshot = await get(testRef)
      console.log('Firebase connection test successful - snapshot:', snapshot.exists())
      return true
    } catch (err) {
      console.error('Firebase connection test failed:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        name: err.name
      })
      
      // Check if it's a configuration issue
      if (err.message.includes('Firebase: No Firebase App') || 
          err.message.includes('Firebase: Error (auth/invalid-api-key)') ||
          err.message.includes('Firebase: Error (auth/invalid-credential)')) {
        console.error('Firebase configuration error detected')
      }
      
      return false
    }
  }

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        
        // Test Firebase connection first
        const connectionOk = await testFirebaseConnection()
        if (!connectionOk) {
          setError('Firebase connection failed. Please check your configuration.')
          return
        }

        const db = getDatabase(app)
        const reportsRef = ref(db, 'civilian/civilian crime reports')
        const snapshot = await get(reportsRef)

        if (snapshot.exists()) {
          const reportsData = snapshot.val()
          const reportsArray = Object.entries(reportsData).map(([key, data]) => ({
            id: key,
            ...data
          }))
          // Filter for reports that need dispatch (pending, received, in progress)
          const dispatchableReports = reportsArray.filter(report => 
            report.status?.toLowerCase() === 'pending' ||
            report.status?.toLowerCase() === 'received' ||
            report.status?.toLowerCase() === 'in progress'
          )
          setReports(dispatchableReports)
        } else {
          setReports([])
        }
      } catch (err) {
        console.error('Error fetching reports:', err)
        setError('Failed to load dispatch reports')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
    fetchPatrolUnits()
  }, [])

  const handleDispatchReport = (report) => {
    setSelectedReport(report)
    setShowDispatchModal(true)
    
    // Sort patrol units by distance to crime location
    if (report.location?.latitude && report.location?.longitude) {
      const crimeLat = parseFloat(report.location.latitude);
      const crimeLon = parseFloat(report.location.longitude);
      const sortedUnits = sortPatrolUnitsByDistance(patrolUnits, crimeLat, crimeLon);
      setSortedPatrolUnits(sortedUnits);
      console.log('Patrol units sorted by distance:', sortedUnits);
    } else {
      setSortedPatrolUnits(patrolUnits);
      console.log('No crime location found, using unsorted patrol units');
    }
    
    // Reset form data
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
      console.log('Starting dispatch process...', {
        selectedReport: selectedReport,
        dispatchData: dispatchData,
        patrolUnitsCount: patrolUnits.length
      })

      const db = getDatabase(app)
      
      // Validate database connection
      if (!db) {
        throw new Error('Database connection failed')
      }

      const reportRef = ref(db, `civilian/civilian crime reports/${selectedReport.id}`)
      console.log('Report reference created:', reportRef.toString())
      
      // Find the selected police unit details
      const selectedUnit = patrolUnits.find(unit => unit.id === dispatchData.unit)
      if (!selectedUnit) {
        console.error('Selected police unit not found:', {
          dispatchDataUnit: dispatchData.unit,
          availableUnits: patrolUnits.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))
        })
        alert('Selected police unit not found. Please refresh and try again.')
        return
      }

      console.log('Selected police unit found:', selectedUnit)

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

      const updates = {
        status: 'Dispatched',
        dispatchInfo: dispatchInfo
      }

      console.log('Updating crime report with:', updates)

      // Update the crime report
      await update(reportRef, updates)
      console.log('Crime report updated successfully')
      
      // Create notification for the dispatched police officer
      const notificationId = `dispatch_${selectedReport.id}_${Date.now()}`
      const notificationRef = ref(db, `police/notifications/${selectedUnit.id}/${notificationId}`)
      
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

      console.log('Creating notification for police officer:', {
        notificationRef: notificationRef.toString(),
        notificationData: notificationData
      })

      await update(notificationRef, notificationData)
      console.log('Police notification created successfully')

      // Also create a general notification in the police notifications section
      const generalNotificationRef = ref(db, `police/notifications/general/${notificationId}`)
      const generalNotificationData = {
        ...notificationData,
        assignedOfficer: {
          id: selectedUnit.id,
          name: `${selectedUnit.policeRank} ${selectedUnit.firstName} ${selectedUnit.lastName}`,
          email: selectedUnit.email
        }
      }

      console.log('Creating general notification:', {
        generalNotificationRef: generalNotificationRef.toString(),
        generalNotificationData: generalNotificationData
      })

      await update(generalNotificationRef, generalNotificationData)
      console.log('General notification created successfully')

      // Update local state
      setReports(prev => prev.filter(report => report.id !== selectedReport.id))
      handleCloseModal()
      setSelectedReport(null)
      setDispatchData({
        unit: '',
        priority: 'medium',
        notes: '',
        estimatedTime: ''
      })
      
      // Log the notification creation for debugging
      console.log('Dispatch completed successfully:', {
        officerId: selectedUnit.id,
        officerName: `${selectedUnit.policeRank} ${selectedUnit.firstName} ${selectedUnit.lastName}`,
        notificationId: notificationId,
        reportId: selectedReport.id
      })

      alert(`Report dispatched successfully! ${selectedUnit.policeRank} ${selectedUnit.firstName} ${selectedUnit.lastName} has been notified.`)
    } catch (err) {
      console.error('Error dispatching report:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      })
      
      // Provide more specific error messages
      let errorMessage = 'Failed to dispatch report'
      if (err.code === 'PERMISSION_DENIED') {
        errorMessage = 'Permission denied. Please check your Firebase security rules.'
      } else if (err.code === 'UNAVAILABLE') {
        errorMessage = 'Database is currently unavailable. Please try again later.'
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your internet connection.'
      } else if (err.message) {
        errorMessage = `Dispatch failed: ${err.message}`
      }
      
      alert(errorMessage)
    } finally {
      setIsDispatching(false)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return '#dc2626'
      case 'medium': return '#d97706'
      case 'low': return '#16a34a'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#f59e0b'
      case 'received': return '#3b82f6'
      case 'in progress': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  if (loading) {
    return (
      <div className="dispatch-container">
        <div className="loading">Loading dispatch reports...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dispatch-container">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="dispatch-container">
      <div className="dispatch-header">
        <h1>Dispatch Center</h1>
        <p>Manage and dispatch emergency response units to crime reports</p>
      </div>

      <div className="dispatch-stats">
        <div className="stat-card">
          <div className="stat-icon pending">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12,6 12,12 16,14"></polyline>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">{reports.length}</span>
            <span className="stat-label">Pending Dispatch</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon high-priority">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">
              {reports.filter(r => r.priority === 'high').length}
            </span>
            <span className="stat-label">High Priority</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-number">
              {reports.filter(r => r.status?.toLowerCase() === 'in progress').length}
            </span>
            <span className="stat-label">In Progress</span>
          </div>
        </div>
      </div>

      <div className="dispatch-content">
        <div className="reports-section">
          <h2>Reports Awaiting Dispatch</h2>
          {reports.length === 0 ? (
            <div className="no-reports">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
              <p>No reports pending dispatch</p>
            </div>
          ) : (
            <div className="reports-grid">
              {reports.map((report) => (
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
                    </div>
                    <div className="report-time">
                      {new Date(report.dateTime || report.createdAt).toLocaleString()}
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
                  </div>

                  <div className="report-actions">
                    <button 
                      className="dispatch-btn"
                      onClick={() => handleDispatchReport(report)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                      </svg>
                      Dispatch Unit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="modal-overlay">
          <div className="modal-content dispatch-modal">
            <div className="modal-header">
              <h3>Dispatch Response Unit</h3>
              <button 
                className="close-btn"
                onClick={handleCloseModal}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="report-summary">
                <h4>Report Details</h4>
                <p><strong>Type:</strong> {selectedReport?.crimeType}</p>
                <p><strong>Location:</strong> {selectedReport?.location?.address}</p>
                <p><strong>Reporter:</strong> {selectedReport?.reporterName}</p>
              </div>

              <div className="dispatch-form">
                {/* Proximity Recommendations */}
                {sortedPatrolUnits.length > 0 && sortedPatrolUnits[0].distance !== undefined && sortedPatrolUnits[0].distance < 999999 && (
                  <div className="proximity-recommendations" style={{ 
                    background: '#f0f9ff', 
                    border: '1px solid #0ea5e9', 
                    borderRadius: '8px', 
                    padding: '1rem', 
                    marginBottom: '1rem' 
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      Recommended Patrol Units (Sorted by Distance)
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                      {sortedPatrolUnits.slice(0, 3).map((unit, index) => (
                        <div key={unit.id} style={{ marginBottom: '0.25rem' }}>
                          <strong>{index + 1}.</strong> {unit.policeRank} {unit.firstName} {unit.lastName} 
                          <span style={{ color: unit.status === 'Available' ? 'var(--success)' : 'var(--error)' }}>
                            {' '}({unit.status})
                          </span>
                          {' '}- {unit.distance.toFixed(1)} km away
                          {index === 0 && <span style={{ color: 'var(--error)', fontWeight: 'bold' }}> - NEAREST</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Response Unit *</label>
                  {sortedPatrolUnits.length > 0 && sortedPatrolUnits[0].distance !== undefined && (
                    <small style={{ color: 'var(--success)', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block' }}>
                      Units sorted by proximity to crime location
                    </small>
                  )}
                  <select
                    value={dispatchData.unit}
                    onChange={(e) => setDispatchData({...dispatchData, unit: e.target.value})}
                    required
                  >
                    <option value="">Select a patrol unit...</option>
                    {(sortedPatrolUnits.length > 0 ? sortedPatrolUnits : patrolUnits).map((unit, index) => {
                      const isNearest = index === 0 && unit.distance !== undefined && unit.distance < 999999;
                      const isAvailable = unit.status === 'Available';
                      const distanceText = unit.distance !== undefined && unit.distance < 999999 
                        ? ` (${unit.distance.toFixed(1)} km away)` 
                        : ' (Location unknown)';
                      
                      // Check if using default location
                      const isUsingDefaultLocation = unit.latitude === 14.5995 && unit.longitude === 120.9842;
                      
                      return (
                        <option key={unit.id} value={unit.id}>
                          {isNearest ? '[NEAREST] ' : ''}{unit.policeRank} {unit.firstName} {unit.lastName} - {unit.status}
                          {isUsingDefaultLocation ? ' (Default Manila location)' : distanceText}
                          {isNearest ? ' - NEAREST' : ''}
                        </option>
                      );
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

            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button 
                className="btn-dispatch"
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

export default Dispatch
