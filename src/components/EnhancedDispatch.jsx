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
  const [showActiveOfficersModal, setShowActiveOfficersModal] = useState(false)
  const [activeDispatches, setActiveDispatches] = useState([])
  const [undispatching, setUndispatching] = useState(false)

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
      
      // Fetch reports, patrol units, and SOS alerts in parallel
      const [reportsSnapshot, unitsSnapshot, sosSnapshot] = await Promise.all([
        get(ref(realtimeDb, 'civilian/civilian crime reports')),
        get(ref(realtimeDb, 'police/police account')),
        get(ref(realtimeDb, 'civilian/sos alerts'))
      ])
      
      // Process reports and clean up old/invalid data
      const reportsList = []
      const reportsToDelete = []
      
      if (reportsSnapshot.exists()) {
        const reportsData = reportsSnapshot.val()
        const currentDate = new Date()
        const oct20 = new Date(currentDate.getFullYear(), 9, 20) // October 20
        const oct22 = new Date(currentDate.getFullYear(), 9, 22) // October 22
        
        Object.keys(reportsData).forEach(reportId => {
          const report = reportsData[reportId]
          const reportDate = new Date(report.createdAt || report.dateTime)
          
          // Check if report is outside the date range (not between Oct 20-22)
          const isOutsideDateRange = reportDate < oct20 || reportDate > oct22
          
          // Check if report has no location data
          const hasNoLocation = !report.location || 
            (!report.location.address && !report.location.latitude && !report.location.longitude)
          
          // Mark for deletion if outside date range or no location
          if (isOutsideDateRange || hasNoLocation) {
            reportsToDelete.push(reportId)
            return
          }
          
          reportsList.push({
            id: reportId,
            ...report,
            createdAt: reportDate,
            dispatchedAt: report.dispatchInfo?.dispatchedAt ? new Date(report.dispatchInfo.dispatchedAt) : null
          })
        })
      }
      
      // Delete old/invalid reports
      if (reportsToDelete.length > 0) {
        console.log(`Cleaning up ${reportsToDelete.length} old/invalid reports...`)
        const deletePromises = reportsToDelete.map(reportId => {
          const reportRef = ref(realtimeDb, `civilian/civilian crime reports/${reportId}`)
          return update(reportRef, null) // Set to null to delete
        })
        await Promise.all(deletePromises)
        console.log(`Successfully deleted ${reportsToDelete.length} old/invalid reports`)
      }
      
      // Clean up SOS alerts
      const sosToDelete = []
      if (sosSnapshot.exists()) {
        const sosData = sosSnapshot.val()
        const currentDate = new Date()
        const oct20 = new Date(currentDate.getFullYear(), 9, 20) // October 20
        const oct22 = new Date(currentDate.getFullYear(), 9, 22) // October 22
        
        Object.keys(sosData).forEach(sosId => {
          const sos = sosData[sosId]
          const sosDate = new Date(sos.createdAt || sos.dateTime)
          
          // Check if SOS is outside the date range (not between Oct 20-22)
          const isOutsideDateRange = sosDate < oct20 || sosDate > oct22
          
          // Check if SOS has no location data
          const hasNoLocation = !sos.location || 
            (!sos.location.address && !sos.location.latitude && !sos.location.longitude)
          
          // Mark for deletion if outside date range or no location
          if (isOutsideDateRange || hasNoLocation) {
            sosToDelete.push(sosId)
          }
        })
      }
      
      // Delete old/invalid SOS alerts
      if (sosToDelete.length > 0) {
        console.log(`Cleaning up ${sosToDelete.length} old/invalid SOS alerts...`)
        const deleteSosPromises = sosToDelete.map(sosId => {
          const sosRef = ref(realtimeDb, `civilian/sos alerts/${sosId}`)
          return update(sosRef, null) // Set to null to delete
        })
        await Promise.all(deleteSosPromises)
        console.log(`Successfully deleted ${sosToDelete.length} old/invalid SOS alerts`)
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
    const activeDispatchesList = reportsList.filter(report => 
      report.status?.toLowerCase() === 'dispatched' || 
      report.status?.toLowerCase() === 'in progress'
    )
    const activeDispatchesCount = activeDispatchesList.length
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
    
    // Update active dispatches with officer information
    const activeDispatchesWithOfficers = activeDispatchesList.map(report => {
      const assignedOfficer = unitsList.find(unit => unit.id === report.dispatchInfo?.unit)
      return {
        ...report,
        assignedOfficer: assignedOfficer ? {
          id: assignedOfficer.id,
          name: `${assignedOfficer.policeRank} ${assignedOfficer.firstName} ${assignedOfficer.lastName}`,
          email: assignedOfficer.email,
          contactNumber: assignedOfficer.contactNumber,
          status: assignedOfficer.status,
          location: assignedOfficer.latitude && assignedOfficer.longitude ? {
            latitude: assignedOfficer.latitude,
            longitude: assignedOfficer.longitude
          } : null
        } : null
      }
    })
    
    setActiveDispatches(activeDispatchesWithOfficers)
    setRealTimeStats({
      totalReports,
      activeDispatches: activeDispatchesCount,
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

  const getStatusClass = (status) => {
    const normalizedStatus = status?.toLowerCase();
    if (normalizedStatus === "resolved" || normalizedStatus === "case resolved") {
      return "status-resolved";
    } else if (normalizedStatus === "in progress") {
      return "status-in-progress";
    } else if (normalizedStatus === "received") {
      return "status-received";
    } else if (normalizedStatus === "dispatched") {
      return "status-dispatched";
    } else {
      return "status-pending";
    }
  }

  // Manual cleanup function for testing
  const handleCleanupData = async () => {
    const confirmCleanup = window.confirm(
      'This will delete all reports and SOS alerts outside Oct 20-22 date range and those without location data. Continue?'
    )
    
    if (!confirmCleanup) return
    
    try {
      setLoading(true)
      await fetchData() // This will trigger the cleanup
      alert('Data cleanup completed successfully!')
    } catch (error) {
      console.error('Error during cleanup:', error)
      alert('Error during cleanup. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Undispatch function to make officer available again
  const handleUndispatch = async (dispatch) => {
    console.log('Undispatch triggered for:', dispatch)
    
    if (!dispatch.assignedOfficer) {
      alert('No officer information available for this dispatch')
      return
    }

    if (undispatching) {
      alert('Undispatch is already in progress. Please wait...')
      return
    }

    const confirmUndispatch = window.confirm(
      `Are you sure you want to undispatch ${dispatch.assignedOfficer.name}? This will make them available for other assignments.`
    )

    if (!confirmUndispatch) return

    setUndispatching(true)
    console.log('Starting undispatch process...')

    try {
      console.log('Updating officer status...')
      // Update officer status back to Available
      const officerRef = ref(realtimeDb, `police/police account/${dispatch.assignedOfficer.id}`)
      await update(officerRef, {
        status: 'Available',
        currentAssignment: null
      })
      console.log('Officer status updated successfully')

      console.log('Updating report status...')
      // Update report status back to Pending
      const reportRef = ref(realtimeDb, `civilian/civilian crime reports/${dispatch.id}`)
      await update(reportRef, {
        status: 'Pending',
        dispatchInfo: null
      })
      console.log('Report status updated successfully')

      // Create notification for the officer about undispatch
      const notificationId = `undispatch_${dispatch.id}_${Date.now()}`
      const notificationRef = ref(realtimeDb, `police/notifications/${dispatch.assignedOfficer.id}/${notificationId}`)
      
      const notificationData = {
        id: notificationId,
        type: 'undispatch_notification',
        title: 'Dispatch Cancelled',
        message: `Your assignment to ${dispatch.crimeType || 'emergency'} report has been cancelled. You are now available for new assignments.`,
        reportId: dispatch.id,
        reportDetails: {
          crimeType: dispatch.crimeType || 'Emergency',
          location: dispatch.location?.address || 'Location not available',
          reporterName: dispatch.reporterName || 'Anonymous',
          description: dispatch.description || 'No description provided'
        },
        createdAt: new Date().toISOString(),
        isRead: false,
        isActive: true
      }

      await update(notificationRef, notificationData)

      // Also create a general notification
      const generalNotificationRef = ref(realtimeDb, `police/notifications/general/${notificationId}`)
      const generalNotificationData = {
        ...notificationData,
        assignedOfficer: {
          id: dispatch.assignedOfficer.id,
          name: dispatch.assignedOfficer.name,
          email: dispatch.assignedOfficer.email
        }
      }

      await update(generalNotificationRef, generalNotificationData)

      alert(`Officer ${dispatch.assignedOfficer.name} has been successfully undispatched and is now available for new assignments.`)

      // Refresh data to update the UI
      await fetchData()

    } catch (error) {
      console.error('Error undispatching officer:', error)
      alert('Failed to undispatch officer. Please try again.')
    } finally {
      setUndispatching(false)
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
      <section className="mb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black mb-2" style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            color: '#1e293b', 
            letterSpacing: '-0.025em',
            textTransform: 'uppercase'
          }}>Dispatch Management</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{realTimeStats.totalReports}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Total Reports</div>
          </div>
          
          <div className="card cursor-pointer transition-all duration-200 hover:bg-gray-50" onClick={() => setShowActiveOfficersModal(true)}>
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{realTimeStats.activeDispatches}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Active Dispatches</div>
          </div>
          
          <div className="card">
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{realTimeStats.availableUnits}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Available Units</div>
          </div>
          
          <div className="card">
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{realTimeStats.averageResponseTime}m</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Avg Response Time</div>
          </div>
        </div>
      </section>

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
         
         <button onClick={handleCleanupData} className="cleanup-btn">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <polyline points="3,6 5,6 21,6"></polyline>
             <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
             <line x1="10" y1="11" x2="10" y2="17"></line>
             <line x1="14" y1="11" x2="14" y2="17"></line>
           </svg>
           Cleanup Data
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
                    <span className={`status-badge ${getStatusClass(report.status)}`}>
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

      {/* Active Officers Modal */}
      {showActiveOfficersModal && (
        <div className="modal-overlay">
          <div className="modal-content active-officers-modal">
            <div className="modal-header">
              <h3>Active Officers in Dispatch</h3>
              <button className="modal-close" onClick={() => setShowActiveOfficersModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              {activeDispatches.length === 0 ? (
                <div className="no-active-officers">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  <h4>No Active Dispatches</h4>
                  <p>There are currently no officers actively dispatched to incidents.</p>
                </div>
              ) : (
                <div className="active-officers-list">
                  {activeDispatches.map((dispatch) => (
                    <div key={dispatch.id} className="active-officer-card">
                      <div className="officer-info">
                        <div className="officer-header">
                          <h4>{dispatch.assignedOfficer?.name || 'Unknown Officer'}</h4>
                          <span className={`status-badge ${getStatusClass(dispatch.status)}`}>
                            {dispatch.status}
                          </span>
                        </div>
                        
                        <div className="officer-details">
                          <div className="detail-row">
                            <strong>Report ID:</strong> {dispatch.id}
                          </div>
                          <div className="detail-row">
                            <strong>Crime Type:</strong> {dispatch.crimeType || 'Unknown'}
                          </div>
                          <div className="detail-row">
                            <strong>Location:</strong> {dispatch.location?.address || 'No location'}
                          </div>
                          <div className="detail-row">
                            <strong>Reporter:</strong> {dispatch.reporterName || 'Anonymous'}
                          </div>
                          {dispatch.assignedOfficer && (
                            <>
                              <div className="detail-row">
                                <strong>Officer Contact:</strong> {dispatch.assignedOfficer.contactNumber || 'Not available'}
                              </div>
                              <div className="detail-row">
                                <strong>Officer Email:</strong> {dispatch.assignedOfficer.email || 'Not available'}
                              </div>
                              <div className="detail-row">
                                <strong>Dispatch Time:</strong> {dispatch.dispatchInfo?.dispatchedAt ? 
                                  new Date(dispatch.dispatchInfo.dispatchedAt).toLocaleString() : 'Unknown'
                                }
                              </div>
                              {dispatch.dispatchInfo?.priority && (
                                <div className="detail-row">
                                  <strong>Priority:</strong> 
                                  <span className={`priority-badge priority-${dispatch.dispatchInfo.priority.toLowerCase()}`}>
                                    {dispatch.dispatchInfo.priority}
                                  </span>
                                </div>
                              )}
                              {dispatch.dispatchInfo?.estimatedTime && (
                                <div className="detail-row">
                                  <strong>Estimated Response Time:</strong> {dispatch.dispatchInfo.estimatedTime}
                                </div>
                              )}
                              {dispatch.dispatchInfo?.notes && (
                                <div className="detail-row">
                                  <strong>Dispatch Notes:</strong> {dispatch.dispatchInfo.notes}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div className="officer-actions">
                          <button 
                            className="undispatch-btn"
                            onClick={() => handleUndispatch(dispatch)}
                            disabled={undispatching}
                          >
                            {undispatching ? (
                              <>
                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <path d="M12 2a10 10 0 0 1 10 10"></path>
                                </svg>
                                Undispatching...
                              </>
                            ) : (
                              <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 12l2 2 4-4"></path>
                                  <circle cx="12" cy="12" r="10"></circle>
                                </svg>
                                Undispatch Officer
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowActiveOfficersModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedDispatch
