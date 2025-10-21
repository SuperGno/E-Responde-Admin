import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off } from 'firebase/database'
import './RealTimeMonitoring.css'

function RealTimeMonitoring() {
  const [systemStats, setSystemStats] = useState({
    activeUsers: 0,
    activeCalls: 0,
    activeDispatches: 0,
    emergencyAlerts: 0,
    systemHealth: 'Good',
    responseTime: 0
  })
  const [activeUsers, setActiveUsers] = useState([])
  const [activeCalls, setActiveCalls] = useState([])
  const [emergencyAlerts, setEmergencyAlerts] = useState([])
  const [systemHealth, setSystemHealth] = useState({
    database: 'Connected',
    notifications: 'Active',
    location: 'Tracking',
    lastUpdate: new Date()
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000) // 5 seconds

  useEffect(() => {
    fetchSystemData()
    setupRealTimeListeners()
    
    // Auto-refresh interval
    let interval
    if (autoRefresh) {
      interval = setInterval(fetchSystemData, refreshInterval)
    }
    
    return () => {
      // Cleanup listeners
      const usersRef = ref(realtimeDb, 'civilian/civilian account')
      const callsRef = ref(realtimeDb, 'voip_calls')
      const alertsRef = ref(realtimeDb, 'sos_alerts')
      off(usersRef, 'value')
      off(callsRef, 'value')
      off(alertsRef, 'value')
      
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [autoRefresh, refreshInterval])

  const fetchSystemData = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Fetch all system data in parallel
      const [
        usersSnapshot,
        callsSnapshot,
        alertsSnapshot,
        reportsSnapshot,
        notificationsSnapshot
      ] = await Promise.all([
        get(ref(realtimeDb, 'civilian/civilian account')),
        get(ref(realtimeDb, 'voip_calls')),
        get(ref(realtimeDb, 'sos_alerts')),
        get(ref(realtimeDb, 'civilian/civilian crime reports')),
        get(ref(realtimeDb, 'notifications'))
      ])
      
      // Process active users
      const usersList = []
      if (usersSnapshot.exists()) {
        const usersData = usersSnapshot.val()
        Object.keys(usersData).forEach(userId => {
          const user = usersData[userId]
          if (user.email && user.firstName) {
            // Check if user is active (has recent activity)
            const lastActivity = user.lastSignIn || user.createdAt
            const isActive = lastActivity && (new Date() - new Date(lastActivity)) < 24 * 60 * 60 * 1000 // 24 hours
            
            usersList.push({
              id: userId,
              name: `${user.firstName} ${user.lastName || ''}`,
              email: user.email,
              isActive: isActive,
              lastActivity: lastActivity,
              userType: 'civilian'
            })
          }
        })
      }
      
      // Process active calls
      const callsList = []
      if (callsSnapshot.exists()) {
        const callsData = callsSnapshot.val()
        Object.keys(callsData).forEach(callId => {
          const call = callsData[callId]
          if (call.status === 'ringing' || call.status === 'answered') {
            callsList.push({
              id: callId,
              caller: call.caller,
              callee: call.callee,
              status: call.status,
              createdAt: new Date(call.createdAt),
              duration: call.answeredAt ? (new Date() - new Date(call.answeredAt)) / 1000 : 0
            })
          }
        })
      }
      
      // Process emergency alerts
      const alertsList = []
      if (alertsSnapshot.exists()) {
        const alertsData = alertsSnapshot.val()
        Object.keys(alertsData).forEach(alertId => {
          const alert = alertsData[alertId]
          if (alert.status === 'active' || alert.status === 'pending') {
            alertsList.push({
              id: alertId,
              userId: alert.userId,
              type: alert.type || 'sos_alert',
              status: alert.status,
              createdAt: new Date(alert.createdAt || alert.timestamp),
              location: alert.data?.location,
              priority: alert.data?.priority || 'high'
            })
          }
        })
      }
      
      // Process notifications for additional alerts
      if (notificationsSnapshot.exists()) {
        const notificationsData = notificationsSnapshot.val()
        Object.keys(notificationsData).forEach(userId => {
          const userNotifications = notificationsData[userId]
          Object.keys(userNotifications).forEach(notificationId => {
            const notification = userNotifications[notificationId]
            if (notification.type === 'sos_alert' && !notification.isRead) {
              alertsList.push({
                id: notificationId,
                userId: userId,
                type: 'sos_notification',
                status: 'active',
                createdAt: new Date(notification.createdAt || notification.timestamp),
                location: notification.data?.location,
                priority: notification.data?.priority || 'high'
              })
            }
          })
        })
      }
      
      // Calculate system statistics
      const activeUsersCount = usersList.filter(user => user.isActive).length
      const activeCallsCount = callsList.length
      const activeDispatchesCount = reportsSnapshot.exists() ? 
        Object.values(reportsSnapshot.val()).filter(report => 
          report.status?.toLowerCase() === 'dispatched' || 
          report.status?.toLowerCase() === 'in progress'
        ).length : 0
      const emergencyAlertsCount = alertsList.length
      
      // Calculate system health
      const healthScore = calculateSystemHealth(activeUsersCount, activeCallsCount, emergencyAlertsCount)
      
      setSystemStats({
        activeUsers: activeUsersCount,
        activeCalls: activeCallsCount,
        activeDispatches: activeDispatchesCount,
        emergencyAlerts: emergencyAlertsCount,
        systemHealth: healthScore,
        responseTime: Date.now()
      })
      
      setActiveUsers(usersList)
      setActiveCalls(callsList)
      setEmergencyAlerts(alertsList)
      
      setSystemHealth({
        database: 'Connected',
        notifications: 'Active',
        location: 'Tracking',
        lastUpdate: new Date()
      })
      
    } catch (err) {
      console.error('Error fetching system data:', err)
      setError('Failed to load system data. Please try again.')
      setSystemHealth({
        database: 'Error',
        notifications: 'Error',
        location: 'Error',
        lastUpdate: new Date()
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateSystemHealth = (users, calls, alerts) => {
    // Simple health calculation based on system load
    const loadScore = (users * 0.1) + (calls * 0.3) + (alerts * 0.5)
    
    if (loadScore < 10) return 'Excellent'
    if (loadScore < 20) return 'Good'
    if (loadScore < 30) return 'Fair'
    return 'Poor'
  }

  const setupRealTimeListeners = () => {
    // Listen for user activity
    const usersRef = ref(realtimeDb, 'civilian/civilian account')
    onValue(usersRef, () => {
      if (autoRefresh) return // Skip if auto-refresh is handling it
      fetchSystemData()
    })
    
    // Listen for call activity
    const callsRef = ref(realtimeDb, 'voip_calls')
    onValue(callsRef, () => {
      if (autoRefresh) return
      fetchSystemData()
    })
    
    // Listen for emergency alerts
    const alertsRef = ref(realtimeDb, 'sos_alerts')
    onValue(alertsRef, () => {
      if (autoRefresh) return
      fetchSystemData()
    })
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  const getHealthColor = (health) => {
    switch (health) {
      case 'Excellent': return '#10b981'
      case 'Good': return '#3b82f6'
      case 'Fair': return '#f59e0b'
      case 'Poor': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981'
      case 'ringing': return '#f59e0b'
      case 'answered': return '#3b82f6'
      case 'pending': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'immediate': return '#dc2626'
      case 'high': return '#f59e0b'
      case 'medium': return '#3b82f6'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }

  if (loading && !autoRefresh) {
    return (
      <div className="real-time-monitoring-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading real-time monitoring data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="real-time-monitoring-container">
      <div className="monitoring-header">
        <h1>Real-Time System Monitoring</h1>
        <p>Live monitoring of system activity, users, and emergency situations</p>
        
        <div className="monitoring-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh ({refreshInterval / 1000}s)
          </label>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="refresh-interval-select"
          >
            <option value={2000}>2 seconds</option>
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
          </select>
          
          <button onClick={fetchSystemData} className="manual-refresh-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="system-health-section">
        <h2>System Health Overview</h2>
        <div className="health-cards">
          <div className="health-card">
            <div className="health-icon">📊</div>
            <div className="health-content">
              <h3>System Status</h3>
              <p 
                className="health-status"
                style={{ color: getHealthColor(systemStats.systemHealth) }}
              >
                {systemStats.systemHealth}
              </p>
            </div>
          </div>
          
          <div className="health-card">
            <div className="health-icon">🔗</div>
            <div className="health-content">
              <h3>Database</h3>
              <p 
                className="health-status"
                style={{ color: systemHealth.database === 'Connected' ? '#10b981' : '#ef4444' }}
              >
                {systemHealth.database}
              </p>
            </div>
          </div>
          
          <div className="health-card">
            <div className="health-icon">🔔</div>
            <div className="health-content">
              <h3>Notifications</h3>
              <p 
                className="health-status"
                style={{ color: systemHealth.notifications === 'Active' ? '#10b981' : '#ef4444' }}
              >
                {systemHealth.notifications}
              </p>
            </div>
          </div>
          
          <div className="health-card">
            <div className="health-icon">📍</div>
            <div className="health-content">
              <h3>Location Tracking</h3>
              <p 
                className="health-status"
                style={{ color: systemHealth.location === 'Tracking' ? '#10b981' : '#ef4444' }}
              >
                {systemHealth.location}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Statistics */}
      <div className="real-time-stats">
        <h2>Live System Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>Active Users</h3>
              <p className="stat-number">{systemStats.activeUsers}</p>
              <p className="stat-label">Currently online</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📞</div>
            <div className="stat-content">
              <h3>Active Calls</h3>
              <p className="stat-number">{systemStats.activeCalls}</p>
              <p className="stat-label">In progress</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🚨</div>
            <div className="stat-content">
              <h3>Emergency Alerts</h3>
              <p className="stat-number">{systemStats.emergencyAlerts}</p>
              <p className="stat-label">Active alerts</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🚔</div>
            <div className="stat-content">
              <h3>Active Dispatches</h3>
              <p className="stat-number">{systemStats.activeDispatches}</p>
              <p className="stat-label">In progress</p>
            </div>
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

      {/* Active Users */}
      <div className="active-users-section">
        <h2>Active Users ({activeUsers.filter(user => user.isActive).length})</h2>
        <div className="users-grid">
          {activeUsers.filter(user => user.isActive).slice(0, 10).map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-email">{user.email}</div>
                <div className="user-activity">
                  Last active: {formatDate(user.lastActivity)}
                </div>
              </div>
              <div className="user-status">
                <span className="status-indicator active">Online</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Calls */}
      <div className="active-calls-section">
        <h2>Active Calls ({activeCalls.length})</h2>
        {activeCalls.length === 0 ? (
          <div className="no-data">
            <p>No active calls at the moment</p>
          </div>
        ) : (
          <div className="calls-grid">
            {activeCalls.map((call) => (
              <div key={call.id} className="call-card">
                <div className="call-header">
                  <div className="call-status">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(call.status) }}
                    >
                      {call.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="call-duration">
                    {formatDuration(call.duration)}
                  </div>
                </div>
                
                <div className="call-participants">
                  <div className="participant">
                    <strong>Caller:</strong> {call.caller?.name || 'Unknown'}
                  </div>
                  <div className="participant">
                    <strong>Callee:</strong> {call.callee?.name || 'Unknown'}
                  </div>
                </div>
                
                <div className="call-time">
                  Started: {formatDate(call.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Alerts */}
      <div className="emergency-alerts-section">
        <h2>Emergency Alerts ({emergencyAlerts.length})</h2>
        {emergencyAlerts.length === 0 ? (
          <div className="no-data">
            <p>No active emergency alerts</p>
          </div>
        ) : (
          <div className="alerts-grid">
            {emergencyAlerts.map((alert) => (
              <div key={alert.id} className="alert-card">
                <div className="alert-header">
                  <div className="alert-type">
                    <span className="type-badge">
                      {alert.type === 'sos_alert' ? '🚨 SOS' : '📱 Notification'}
                    </span>
                    <span 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(alert.priority) }}
                    >
                      {alert.priority?.toUpperCase() || 'HIGH'}
                    </span>
                  </div>
                  <div className="alert-time">
                    {formatDate(alert.createdAt)}
                  </div>
                </div>
                
                <div className="alert-details">
                  <div className="detail-item">
                    <strong>User ID:</strong> {alert.userId?.substring(0, 8)}...
                  </div>
                  <div className="detail-item">
                    <strong>Status:</strong> {alert.status}
                  </div>
                  {alert.location && (
                    <div className="detail-item">
                      <strong>Location:</strong> {alert.location.address || 'Coordinates provided'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Information */}
      <div className="system-info-section">
        <h2>System Information</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3>Last Update</h3>
            <p>{formatDate(systemHealth.lastUpdate)}</p>
          </div>
          
          <div className="info-card">
            <h3>Auto-refresh</h3>
            <p>{autoRefresh ? 'Enabled' : 'Disabled'}</p>
          </div>
          
          <div className="info-card">
            <h3>Refresh Interval</h3>
            <p>{refreshInterval / 1000} seconds</p>
          </div>
          
          <div className="info-card">
            <h3>Data Source</h3>
            <p>Firebase Realtime Database</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealTimeMonitoring
