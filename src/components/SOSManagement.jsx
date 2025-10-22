import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off, update, query, orderByChild, equalTo } from 'firebase/database'
import './SOSManagement.css'

function SOSManagement() {
  const [sosAlerts, setSosAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeAlerts, setActiveAlerts] = useState([])
  const [sosStats, setSosStats] = useState({
    totalAlerts: 0,
    activeAlerts: 0,
    resolvedAlerts: 0,
    averageResponseTime: 0,
    todayAlerts: 0
  })
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [showAlertDetails, setShowAlertDetails] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('all')

  useEffect(() => {
    fetchSOSAlerts()
    setupRealTimeListeners()
    
    return () => {
      // Cleanup listeners
      const alertsRef = ref(realtimeDb, 'sos_alerts')
      off(alertsRef, 'value')
    }
  }, [])

  const fetchSOSAlerts = async () => {
    try {
      setLoading(true)
      setError('')
      console.log('Fetching SOS alerts from Firebase...')
      
      // Fetch SOS alerts from multiple sources
      const alertsRef = ref(realtimeDb, 'sos_alerts')
      const notificationsRef = ref(realtimeDb, 'notifications')
      const civilianRef = ref(realtimeDb, 'civilian')
      
      const [alertsSnapshot, notificationsSnapshot, civilianSnapshot] = await Promise.all([
        get(alertsRef).catch(err => {
          console.warn('Error fetching sos_alerts:', err)
          return { exists: () => false }
        }),
        get(notificationsRef).catch(err => {
          console.warn('Error fetching notifications:', err)
          return { exists: () => false }
        }),
        get(civilianRef).catch(err => {
          console.warn('Error fetching civilian data:', err)
          return { exists: () => false }
        })
      ])
      
      const alertsList = []
      
      // Process SOS alerts
      if (alertsSnapshot.exists()) {
        const alertsData = alertsSnapshot.val()
        console.log('Found SOS alerts:', Object.keys(alertsData).length)
        Object.keys(alertsData).forEach(alertId => {
          try {
            const alert = alertsData[alertId]
            alertsList.push({
              id: alertId,
              ...alert,
              type: 'sos_alert',
              createdAt: new Date(alert.createdAt || alert.timestamp),
              resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null
            })
          } catch (err) {
            console.warn('Error processing SOS alert:', alertId, err)
          }
        })
      } else {
        console.log('No SOS alerts found in sos_alerts path')
      }
      
      // Process SOS notifications
      if (notificationsSnapshot.exists()) {
        const notificationsData = notificationsSnapshot.val()
        console.log('Found notifications:', Object.keys(notificationsData).length)
        Object.keys(notificationsData).forEach(userId => {
          try {
            const userNotifications = notificationsData[userId]
            Object.keys(userNotifications).forEach(notificationId => {
              try {
                const notification = userNotifications[notificationId]
                if (notification.type === 'sos_alert') {
                  alertsList.push({
                    id: notificationId,
                    userId: userId,
                    type: 'sos_notification',
                    title: notification.title,
                    message: notification.message,
                    data: notification.data,
                    createdAt: new Date(notification.createdAt || notification.timestamp),
                    isRead: notification.isRead || false,
                    status: notification.data?.status || 'active'
                  })
                }
              } catch (err) {
                console.warn('Error processing notification:', notificationId, err)
              }
            })
          } catch (err) {
            console.warn('Error processing user notifications:', userId, err)
          }
        })
      } else {
        console.log('No notifications found')
      }
      
      // Process civilian SOS alerts
      if (civilianSnapshot.exists()) {
        const civilianData = civilianSnapshot.val()
        console.log('Found civilian data:', Object.keys(civilianData).length)
        Object.keys(civilianData).forEach(userId => {
          try {
            const userData = civilianData[userId]
            if (userData && typeof userData === 'object') {
              // Check for SOS alerts in various possible locations
              const possibleAlertPaths = [
                userData.sos_alerts,
                userData.alerts,
                userData.emergency_alerts,
                userData.sos_requests
              ]
              
              possibleAlertPaths.forEach(alertData => {
                if (alertData && typeof alertData === 'object') {
                  Object.keys(alertData).forEach(alertId => {
                    try {
                      const alert = alertData[alertId]
                      if (alert && (alert.type === 'sos' || alert.type === 'emergency' || alert.status === 'active')) {
                        alertsList.push({
                          id: alertId,
                          userId: userId,
                          type: 'civilian_sos',
                          title: alert.title || 'SOS Alert',
                          message: alert.message || 'Emergency SOS request',
                          location: alert.location || 'Location not available',
                          priority: alert.priority || 'high',
                          status: alert.status || 'active',
                          createdAt: new Date(alert.createdAt || alert.timestamp || new Date()),
                          data: alert
                        })
                      }
                    } catch (err) {
                      console.warn('Error processing civilian alert:', alertId, err)
                    }
                  })
                }
              })
            }
          } catch (err) {
            console.warn('Error processing civilian user data:', userId, err)
          }
        })
      } else {
        console.log('No civilian data found')
      }
      
      // Sort by creation date (newest first)
      alertsList.sort((a, b) => b.createdAt - a.createdAt)
      setSosAlerts(alertsList)
      
      console.log('Total alerts found:', alertsList.length)
      console.log('Alert types:', [...new Set(alertsList.map(alert => alert.type))])
      
      // Calculate stats
      calculateSOSStats(alertsList)
      
    } catch (err) {
      console.error('Error fetching SOS alerts:', err)
      setError(`Failed to load SOS alert data: ${err.message || 'Unknown error'}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const setupRealTimeListeners = () => {
    const alertsRef = ref(realtimeDb, 'sos_alerts')
    const notificationsRef = ref(realtimeDb, 'notifications')
    const civilianRef = ref(realtimeDb, 'civilian')
    
    // Listen for SOS alerts
    onValue(alertsRef, (snapshot) => {
      try {
        console.log('SOS alerts real-time update:', snapshot.exists())
        if (snapshot.exists()) {
          const alertsData = snapshot.val()
          const alertsList = []
          const activeAlertsList = []
          
          Object.keys(alertsData).forEach(alertId => {
            try {
              const alert = alertsData[alertId]
              const alertObj = {
                id: alertId,
                ...alert,
                type: 'sos_alert',
                createdAt: new Date(alert.createdAt || alert.timestamp),
                resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null
              }
              
              alertsList.push(alertObj)
              
              // Track active alerts
              if (alert.status === 'active' || alert.status === 'pending') {
                activeAlertsList.push(alertObj)
              }
            } catch (err) {
              console.warn('Error processing real-time SOS alert:', alertId, err)
            }
          })
          
          alertsList.sort((a, b) => b.createdAt - a.createdAt)
          setSosAlerts(prev => {
            const existing = prev.filter(alert => alert.type !== 'sos_alert')
            return [...existing, ...alertsList].sort((a, b) => b.createdAt - a.createdAt)
          })
          setActiveAlerts(activeAlertsList)
          console.log('Updated SOS alerts:', alertsList.length)
        } else {
          console.log('No SOS alerts found in database')
        }
      } catch (err) {
        console.error('Error in SOS alerts real-time listener:', err)
      }
    })
    
    // Listen for SOS notifications
    onValue(notificationsRef, (snapshot) => {
      try {
        console.log('Notifications real-time update:', snapshot.exists())
        if (snapshot.exists()) {
          const notificationsData = snapshot.val()
          const sosNotifications = []
          
          Object.keys(notificationsData).forEach(userId => {
            try {
              const userNotifications = notificationsData[userId]
              Object.keys(userNotifications).forEach(notificationId => {
                try {
                  const notification = userNotifications[notificationId]
                  if (notification.type === 'sos_alert') {
                    sosNotifications.push({
                      id: notificationId,
                      userId: userId,
                      type: 'sos_notification',
                      title: notification.title,
                      message: notification.message,
                      data: notification.data,
                      createdAt: new Date(notification.createdAt || notification.timestamp),
                      isRead: notification.isRead || false,
                      status: notification.data?.status || 'active'
                    })
                  }
                } catch (err) {
                  console.warn('Error processing real-time notification:', notificationId, err)
                }
              })
            } catch (err) {
              console.warn('Error processing real-time user notifications:', userId, err)
            }
          })
          
          setSosAlerts(prev => {
            const existing = prev.filter(alert => alert.type !== 'sos_notification')
            return [...existing, ...sosNotifications].sort((a, b) => b.createdAt - a.createdAt)
          })
          console.log('Updated SOS notifications:', sosNotifications.length)
        }
      } catch (err) {
        console.error('Error in notifications real-time listener:', err)
      }
    })
    
    // Listen for civilian SOS alerts (mobile app data)
    onValue(civilianRef, (snapshot) => {
      try {
        console.log('Civilian data real-time update:', snapshot.exists())
        if (snapshot.exists()) {
          const civilianData = snapshot.val()
          const civilianAlerts = []
          
          // Check for SOS alerts in civilian data structure
          Object.keys(civilianData).forEach(userId => {
            try {
              const userData = civilianData[userId]
              if (userData && typeof userData === 'object') {
                // Check for SOS alerts in various possible locations
                const possibleAlertPaths = [
                  userData.sos_alerts,
                  userData.alerts,
                  userData.emergency_alerts,
                  userData.sos_requests
                ]
                
                possibleAlertPaths.forEach(alertData => {
                  if (alertData && typeof alertData === 'object') {
                    Object.keys(alertData).forEach(alertId => {
                      try {
                        const alert = alertData[alertId]
                        if (alert && (alert.type === 'sos' || alert.type === 'emergency' || alert.status === 'active')) {
                          civilianAlerts.push({
                            id: alertId,
                            userId: userId,
                            type: 'civilian_sos',
                            title: alert.title || 'SOS Alert',
                            message: alert.message || 'Emergency SOS request',
                            location: alert.location || 'Location not available',
                            priority: alert.priority || 'high',
                            status: alert.status || 'active',
                            createdAt: new Date(alert.createdAt || alert.timestamp || new Date()),
                            data: alert
                          })
                        }
                      } catch (err) {
                        console.warn('Error processing real-time civilian alert:', alertId, err)
                      }
                    })
                  }
                })
              }
            } catch (err) {
              console.warn('Error processing real-time civilian user data:', userId, err)
            }
          })
          
          if (civilianAlerts.length > 0) {
            setSosAlerts(prev => {
              const existing = prev.filter(alert => alert.type !== 'civilian_sos')
              return [...existing, ...civilianAlerts].sort((a, b) => b.createdAt - a.createdAt)
            })
            console.log('Updated civilian SOS alerts:', civilianAlerts.length)
          }
        }
      } catch (err) {
        console.error('Error in civilian data real-time listener:', err)
      }
    })
  }

  const calculateSOSStats = (alertsList) => {
    const totalAlerts = alertsList.length
    const activeAlerts = alertsList.filter(alert => 
      alert.status === 'active' || alert.status === 'pending'
    ).length
    const resolvedAlerts = alertsList.filter(alert => 
      alert.status === 'resolved' || alert.status === 'completed'
    ).length
    
    // Calculate today's alerts
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayAlerts = alertsList.filter(alert => 
      alert.createdAt >= today
    ).length
    
    // Calculate average response time
    const resolvedAlertsWithTime = alertsList.filter(alert => 
      alert.status === 'resolved' && alert.resolvedAt
    )
    
    let totalResponseTime = 0
    resolvedAlertsWithTime.forEach(alert => {
      const responseTime = (alert.resolvedAt - alert.createdAt) / 1000 / 60 // in minutes
      totalResponseTime += responseTime
    })
    
    const averageResponseTime = resolvedAlertsWithTime.length > 0 
      ? totalResponseTime / resolvedAlertsWithTime.length 
      : 0
    
    setSosStats({
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      averageResponseTime: Math.round(averageResponseTime),
      todayAlerts
    })
  }

  const formatDate = (date) => {
    try {
      if (!date) return 'N/A'
      const dateObj = date instanceof Date ? date : new Date(date)
      if (isNaN(dateObj.getTime())) return 'Invalid Date'
      return dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (error) {
      console.warn('Error formatting date:', error)
      return 'N/A'
    }
  }

  const formatDuration = (minutes) => {
    try {
      if (!minutes || isNaN(minutes) || minutes < 0) return '0m'
      if (minutes < 60) return `${Math.round(minutes)}m`
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = Math.round(minutes % 60)
      return `${hours}h ${remainingMinutes}m`
    } catch (error) {
      console.warn('Error formatting duration:', error)
      return '0m'
    }
  }

  const getStatusColor = (status) => {
    try {
      if (!status) return '#fef3c7'
      switch (status.toLowerCase()) {
        case 'active': return '#fef3c7'
        case 'pending': return '#fef3c7'
        case 'received': return '#fef3c7'
        case 'in progress': return '#fed7aa'
        case 'resolved': return '#d1fae5'
        case 'completed': return '#d1fae5'
        default: return '#fef3c7'
      }
    } catch (error) {
      console.warn('Error getting status color:', error)
      return '#fef3c7'
    }
  }

  const getStatusIcon = (status) => {
    try {
      if (!status) return '❓'
      switch (status.toLowerCase()) {
        case 'active': return '🚨'
        case 'pending': return '⏳'
        case 'resolved': return '✅'
        case 'completed': return '📋'
        default: return '❓'
      }
    } catch (error) {
      console.warn('Error getting status icon:', error)
      return '❓'
    }
  }

  const getPriorityColor = (priority) => {
    try {
      if (!priority) return '#6b7280'
      switch (priority.toLowerCase()) {
        case 'immediate': return '#dc2626'
        case 'high': return '#f59e0b'
        case 'medium': return '#3b82f6'
        case 'low': return '#10b981'
        default: return '#6b7280'
      }
    } catch (error) {
      console.warn('Error getting priority color:', error)
      return '#6b7280'
    }
  }

  const handleViewAlertDetails = (alert) => {
    try {
      if (!alert) {
        console.warn('No alert data provided to handleViewAlertDetails')
        return
      }
      setSelectedAlert(alert)
      setShowAlertDetails(true)
    } catch (error) {
      console.error('Error viewing alert details:', error)
    }
  }

  const handleCloseAlertDetails = () => {
    setSelectedAlert(null)
    setShowAlertDetails(false)
  }

  const handleResolveAlert = async (alertId) => {
    try {
      const alertRef = ref(realtimeDb, `sos_alerts/${alertId}`)
      await update(alertRef, {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'admin'
      })
      
      alert('SOS alert resolved successfully')
    } catch (err) {
      console.error('Error resolving alert:', err)
      alert('Failed to resolve alert. Please try again.')
    }
  }

  const filteredAlerts = sosAlerts.filter(alert => {
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus
    const dateMatch = filterDate === 'all' || 
      (filterDate === 'today' && alert.createdAt >= new Date().setHours(0, 0, 0, 0)) ||
      (filterDate === 'week' && alert.createdAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    
    return statusMatch && dateMatch
  })

  if (loading) {
    return (
      <div className="sos-management-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading SOS alerts...</p>
        </div>
      </div>
    )
  }

  // Error boundary for the component
  if (error) {
    return (
      <div className="sos-management-container">
        <div className="sos-management-header">
          <div className="header-content">
            <div>
              <h1>SOS Alert Management</h1>
              <p>Monitor and manage emergency SOS alerts from users</p>
            </div>
            <button onClick={fetchSOSAlerts} className="refresh-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              Retry
            </button>
          </div>
        </div>
        <div className="error-message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="sos-management-container">
      <div className="sos-management-header">
        <div className="header-content">
          <div>
            <h1>SOS Alert Management</h1>
            <p>Monitor and manage emergency SOS alerts from users</p>
          </div>
          <button onClick={fetchSOSAlerts} className="refresh-btn" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                Refreshing...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>


      {/* SOS Statistics */}
      <div className="sos-stats">
        <div className="stat-card">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <h3>Total Alerts</h3>
            <p className="stat-number">{sosStats.totalAlerts}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <h3>Active Alerts</h3>
            <p className="stat-number">{sosStats.activeAlerts}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Resolved</h3>
            <p className="stat-number">{sosStats.resolvedAlerts}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <h3>Avg Response</h3>
            <p className="stat-number">{formatDuration(sosStats.averageResponseTime)}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Today</h3>
            <p className="stat-number">{sosStats.todayAlerts}</p>
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

      {/* Active Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="active-alerts-section">
          <h2>🚨 Active Emergency Alerts</h2>
          <div className="active-alerts-grid">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="active-alert-card">
                <div className="alert-header">
                  <div className="alert-status">
                    <span className="status-icon">{getStatusIcon(alert.status)}</span>
                    <span 
                      className="status-text"
                      style={{ color: getStatusColor(alert.status) }}
                    >
                      {alert.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="alert-actions">
                    <button 
                      className="view-details-btn"
                      onClick={() => handleViewAlertDetails(alert)}
                    >
                      View Details
                    </button>
                    <button 
                      className="resolve-btn"
                      onClick={() => handleResolveAlert(alert.id)}
                    >
                      Resolve
                    </button>
                  </div>
                </div>
                
                <div className="alert-content">
                  <div className="alert-title">{alert.title || 'SOS Alert'}</div>
                  <div className="alert-message">{alert.message || alert.data?.message || 'Emergency assistance required'}</div>
                  
                  {alert.data?.location && (
                    <div className="alert-location">
                      <strong>Location:</strong> {alert.data.location.address || `${alert.data.location.latitude}, ${alert.data.location.longitude}`}
                    </div>
                  )}
                  
                  <div className="alert-time">
                    Alerted: {formatDate(alert.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Date Filter:</label>
          <select 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
          </select>
        </div>
        
        <button onClick={fetchSOSAlerts} className="refresh-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23,4 23,10 17,10"></polyline>
            <polyline points="1,20 1,14 7,14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading SOS alerts...</p>
        </div>
      )}

      {/* All Alerts Table */}
      {!loading && (
        <div className="alerts-table-section">
          <div className="section-header">
            <h2>All SOS Alerts</h2>
          </div>

          {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            <h3>No SOS Alerts Found</h3>
            <p>No emergency alerts match your current filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert, index) => (
                  <tr key={alert.id}>
                    <td className="alert-number">{index + 1}</td>
                    <td className="alert-type">
                      <span className="type-badge">
                        {alert.type === 'sos_alert' ? '🚨 SOS' : '📱 Notification'}
                      </span>
                    </td>
                    <td className="alert-user">
                      {alert.userId ? alert.userId.substring(0, 8) + '...' : 'Unknown'}
                    </td>
                    <td className="alert-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(alert.status) }}
                      >
                        {getStatusIcon(alert.status)} {alert.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="alert-priority">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(alert.data?.priority) }}
                      >
                        {alert.data?.priority || 'Unknown'}
                      </span>
                    </td>
                    <td className="alert-location">
                      {alert.data?.location?.address || 
                       (alert.data?.location ? 
                         `${alert.data.location.latitude?.toFixed(4)}, ${alert.data.location.longitude?.toFixed(4)}` : 
                         'N/A'
                       )}
                    </td>
                    <td className="alert-created">{formatDate(alert.createdAt)}</td>
                    <td className="alert-actions">
                      <button 
                        className="view-details-btn"
                        onClick={() => handleViewAlertDetails(alert)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* Alert Details Modal */}
      {showAlertDetails && selectedAlert && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>SOS Alert Details</h3>
              <button className="modal-close" onClick={handleCloseAlertDetails}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="alert-details-grid">
                <div className="detail-item">
                  <strong>Alert ID:</strong> {selectedAlert.id}
                </div>
                <div className="detail-item">
                  <strong>Type:</strong> {selectedAlert.type === 'sos_alert' ? 'SOS Alert' : 'SOS Notification'}
                </div>
                <div className="detail-item">
                  <strong>Status:</strong> 
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedAlert.status) }}
                  >
                    {getStatusIcon(selectedAlert.status)} {selectedAlert.status.toUpperCase()}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>User ID:</strong> {selectedAlert.userId || 'Unknown'}
                </div>
                <div className="detail-item">
                  <strong>Title:</strong> {selectedAlert.title || 'SOS Alert'}
                </div>
                <div className="detail-item">
                  <strong>Message:</strong> {selectedAlert.message || selectedAlert.data?.message || 'Emergency assistance required'}
                </div>
                {selectedAlert.data?.location && (
                  <>
                    <div className="detail-item">
                      <strong>Location:</strong> {selectedAlert.data.location.address || 'Coordinates provided'}
                    </div>
                    <div className="detail-item">
                      <strong>Coordinates:</strong> 
                      {selectedAlert.data.location.latitude && selectedAlert.data.location.longitude
                        ? `${selectedAlert.data.location.latitude.toFixed(6)}, ${selectedAlert.data.location.longitude.toFixed(6)}`
                        : 'N/A'
                      }
                    </div>
                  </>
                )}
                <div className="detail-item">
                  <strong>Priority:</strong> 
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(selectedAlert.data?.priority) }}
                  >
                    {selectedAlert.data?.priority || 'Unknown'}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Created:</strong> {formatDate(selectedAlert.createdAt)}
                </div>
                <div className="detail-item">
                  <strong>Resolved:</strong> {formatDate(selectedAlert.resolvedAt)}
                </div>
                {selectedAlert.data?.sentTo && (
                  <div className="detail-item">
                    <strong>Sent To:</strong> {selectedAlert.data.sentTo} emergency contact(s)
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              {selectedAlert.status === 'active' && (
                <button 
                  className="resolve-btn"
                  onClick={() => {
                    handleResolveAlert(selectedAlert.id)
                    handleCloseAlertDetails()
                  }}
                >
                  Resolve Alert
                </button>
              )}
              <button className="close-btn" onClick={handleCloseAlertDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SOSManagement
