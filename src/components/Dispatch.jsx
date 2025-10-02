import { useState, useEffect } from 'react'
import { getDatabase, ref, get, update } from 'firebase/database'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
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
      return units; // Return unsorted if no crime location
    }

    return units.map(unit => {
      const unitLat = parseFloat(unit.Latitude || unit.latitude || 0);
      const unitLon = parseFloat(unit.Longitude || unit.longitude || 0);
      
      if (unitLat && unitLon) {
        const distance = calculateDistance(crimeLat, crimeLon, unitLat, unitLon);
        return { ...unit, distance: distance };
      } else {
        return { ...unit, distance: 999999 }; // Put units without location at the end
      }
    }).sort((a, b) => a.distance - b.distance);
  }

  // Fetch patrol units from Firestore
  const fetchPatrolUnits = async () => {
    try {
      console.log('Starting to fetch patrol units...')
      const db = getFirestore(app)
      const patrolUnitsRef = collection(db, 'patrol_units')
      console.log('Firestore reference created for patrol_units collection')
      
      const snapshot = await getDocs(patrolUnitsRef)
      console.log('Snapshot received:', snapshot)
      console.log('Number of documents:', snapshot.size)
      
      const units = []
      snapshot.forEach((doc) => {
        console.log('Processing document:', doc.id, doc.data())
        const data = doc.data()
        const unit = {
          id: doc.id,
          policeId: data.Police_ID || data.police_id || data.policeId || data.policeID || 'Unknown',
          status: data.Status || data.status || 'Unknown',
          ...data
        }
        units.push(unit)
        console.log('Added unit:', unit)
      })
      
      setPatrolUnits(units)
      console.log('Patrol units loaded successfully:', units)
      
      // If no units found, show a message
      if (units.length === 0) {
        console.warn('No patrol units found in Firestore collection "patrol_units"')
        console.log('Please check your Firestore collection and field names')
      }
    } catch (err) {
      console.error('Error fetching patrol units:', err)
      console.error('Error details:', err.message)
      console.error('Error code:', err.code)
      
      // Show error message instead of fallback
      console.log('Failed to load patrol units from Firestore. Please check console for errors.')
      setPatrolUnits([])
    }
  }

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

    try {
      const db = getDatabase(app)
      const reportRef = ref(db, `civilian/civilian crime reports/${selectedReport.id}`)
      
      const updates = {
        status: 'Dispatched',
        dispatchInfo: {
          unit: dispatchData.unit,
          priority: dispatchData.priority,
          notes: dispatchData.notes,
          estimatedTime: dispatchData.estimatedTime,
          dispatchedAt: new Date().toISOString(),
          dispatchedBy: 'admin@e-responde.com'
        }
      }

      await update(reportRef, updates)
      
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
      
      alert('Report dispatched successfully!')
    } catch (err) {
      console.error('Error dispatching report:', err)
      alert('Failed to dispatch report')
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
                <div className="form-group">
                  <label>Response Unit *</label>
                  {sortedPatrolUnits.length > 0 && sortedPatrolUnits[0].distance !== undefined && (
                    <small style={{ color: '#10b981', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'block' }}>
                      🎯 Units sorted by proximity to crime location
                    </small>
                  )}
                  <select
                    value={dispatchData.unit}
                    onChange={(e) => setDispatchData({...dispatchData, unit: e.target.value})}
                    required
                  >
                    <option value="">Select a patrol unit...</option>
                    {(sortedPatrolUnits.length > 0 ? sortedPatrolUnits : patrolUnits).map((unit, index) => (
                      <option key={unit.id} value={unit.policeId}>
                        {unit.policeId} - {unit.status}
                        {unit.distance !== undefined ? ` (${unit.distance.toFixed(1)} km away)` : ''}
                        {index === 0 && unit.distance !== undefined ? ' 🎯' : ''}
                      </option>
                    ))}
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
              >
                Dispatch Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dispatch
