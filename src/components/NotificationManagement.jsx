import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off, update, push, remove } from 'firebase/database'
import './NotificationManagement.css'

function NotificationManagement() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notificationStats, setNotificationStats] = useState({
    totalNotifications: 0,
    unreadNotifications: 0,
    sentToday: 0,
    deliveryRate: 0
  })
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [showNotificationDetails, setShowNotificationDetails] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterUser, setFilterUser] = useState('all')
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'general',
    priority: 'medium',
    targetUsers: 'all',
    scheduledTime: '',
    isScheduled: false
  })

  useEffect(() => {
    fetchNotifications()
    setupRealTimeListeners()
    
    return () => {
      // Cleanup listeners
      const notificationsRef = ref(realtimeDb, 'notifications')
      off(notificationsRef, 'value')
    }
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError('')
      
      const notificationsRef = ref(realtimeDb, 'notifications')
      const snapshot = await get(notificationsRef)
      
      const notificationsList = []
      if (snapshot.exists()) {
        const notificationsData = snapshot.val()
        
        // Process notifications by user with comprehensive error handling
        if (notificationsData && typeof notificationsData === 'object') {
          Object.keys(notificationsData).forEach(userId => {
            try {
              const userNotifications = notificationsData[userId]
              if (userNotifications && typeof userNotifications === 'object') {
                Object.keys(userNotifications).forEach(notificationId => {
                  try {
                    const notification = userNotifications[notificationId]
                    if (notification && typeof notification === 'object') {
                      // Ensure all required fields have safe defaults
                      const safeNotification = {
                        id: notificationId || 'unknown',
                        userId: userId || 'unknown',
                        title: notification.title || 'No Title',
                        message: notification.message || 'No message',
                        type: notification.type || 'general',
                        priority: notification.priority || 'medium',
                        isRead: Boolean(notification.isRead),
                        status: notification.status || 'sent',
                        createdAt: new Date(notification.createdAt || notification.timestamp || new Date()),
                        readAt: notification.readAt ? new Date(notification.readAt) : null,
                        sentAt: notification.sentAt ? new Date(notification.sentAt) : null,
                        // Preserve other properties safely
                        ...Object.fromEntries(
                          Object.entries(notification).filter(([key, value]) => 
                            !['title', 'message', 'type', 'priority', 'isRead', 'status', 'createdAt', 'readAt', 'sentAt'].includes(key)
                          )
                        )
                      }
                      notificationsList.push(safeNotification)
                    }
                  } catch (notificationError) {
                    console.warn(`Error processing notification ${notificationId}:`, notificationError)
                    // Add a fallback notification entry
                    notificationsList.push({
                      id: notificationId || 'error',
                      userId: userId || 'unknown',
                      title: 'Error Loading Notification',
                      message: 'This notification could not be loaded properly',
                      type: 'system_alert',
                      priority: 'low',
                      isRead: false,
                      status: 'error',
                      createdAt: new Date(),
                      readAt: null,
                      sentAt: null
                    })
                  }
                })
              }
            } catch (userError) {
              console.warn(`Error processing user ${userId} notifications:`, userError)
            }
          })
        }
      }
      
      // Sort by creation date (newest first) with safe comparison
      notificationsList.sort((a, b) => {
        try {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        } catch (sortError) {
          console.warn('Error sorting notifications:', sortError)
          return 0
        }
      })
      
      setNotifications(notificationsList)
      
      // Calculate stats with error handling
      try {
        calculateNotificationStats(notificationsList)
      } catch (statsError) {
        console.warn('Error calculating notification stats:', statsError)
      }
      
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError('Failed to load notification data. Please try again.')
      // Set empty state to prevent further errors
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const setupRealTimeListeners = () => {
    const notificationsRef = ref(realtimeDb, 'notifications')
    
    onValue(notificationsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const notificationsData = snapshot.val()
          const notificationsList = []
          
          if (notificationsData && typeof notificationsData === 'object') {
            Object.keys(notificationsData).forEach(userId => {
              try {
                const userNotifications = notificationsData[userId]
                if (userNotifications && typeof userNotifications === 'object') {
                  Object.keys(userNotifications).forEach(notificationId => {
                    try {
                      const notification = userNotifications[notificationId]
                      if (notification && typeof notification === 'object') {
                        const safeNotification = {
                          id: notificationId || 'unknown',
                          userId: userId || 'unknown',
                          title: notification.title || 'No Title',
                          message: notification.message || 'No message',
                          type: notification.type || 'general',
                          priority: notification.priority || 'medium',
                          isRead: Boolean(notification.isRead),
                          status: notification.status || 'sent',
                          createdAt: new Date(notification.createdAt || notification.timestamp || new Date()),
                          readAt: notification.readAt ? new Date(notification.readAt) : null,
                          sentAt: notification.sentAt ? new Date(notification.sentAt) : null,
                          // Preserve other properties safely
                          ...Object.fromEntries(
                            Object.entries(notification).filter(([key, value]) => 
                              !['title', 'message', 'type', 'priority', 'isRead', 'status', 'createdAt', 'readAt', 'sentAt'].includes(key)
                            )
                          )
                        }
                        notificationsList.push(safeNotification)
                      }
                    } catch (notificationError) {
                      console.warn(`Error processing real-time notification ${notificationId}:`, notificationError)
                    }
                  })
                }
              } catch (userError) {
                console.warn(`Error processing real-time user ${userId} notifications:`, userError)
              }
            })
          }
          
          // Safe sorting
          notificationsList.sort((a, b) => {
            try {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            } catch (sortError) {
              console.warn('Error sorting real-time notifications:', sortError)
              return 0
            }
          })
          
          setNotifications(notificationsList)
          
          // Safe stats calculation
          try {
            calculateNotificationStats(notificationsList)
          } catch (statsError) {
            console.warn('Error calculating real-time notification stats:', statsError)
          }
        } else {
          // No data available
          setNotifications([])
          setNotificationStats({
            totalNotifications: 0,
            unreadNotifications: 0,
            sentToday: 0,
            deliveryRate: 0
          })
        }
      } catch (listenerError) {
        console.error('Error in real-time listener:', listenerError)
        setError('Error receiving real-time updates. Please refresh the page.')
      }
    })
  }

  const calculateNotificationStats = (notificationsList) => {
    try {
      if (!Array.isArray(notificationsList)) {
        console.warn('Invalid notifications list provided to calculateNotificationStats')
        setNotificationStats({
          totalNotifications: 0,
          unreadNotifications: 0,
          sentToday: 0,
          deliveryRate: 0
        })
        return
      }

      const totalNotifications = notificationsList.length
      const unreadNotifications = notificationsList.filter(notification => 
        notification && typeof notification === 'object' && !notification.isRead
      ).length
      
      // Calculate today's notifications with safe date comparison
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const sentToday = notificationsList.filter(notification => {
        try {
          if (!notification || !notification.createdAt) return false
          const notificationDate = new Date(notification.createdAt)
          return notificationDate >= today
        } catch (dateError) {
          console.warn('Error comparing notification date:', dateError)
          return false
        }
      }).length
      
      // Calculate delivery rate (simplified) with safe filtering
      const deliveredNotifications = notificationsList.filter(notification => {
        if (!notification || typeof notification !== 'object') return false
        return notification.status === 'delivered' || notification.isRead === true
      }).length
      
      const deliveryRate = totalNotifications > 0 
        ? Math.round((deliveredNotifications / totalNotifications) * 100)
        : 0
      
      setNotificationStats({
        totalNotifications,
        unreadNotifications,
        sentToday,
        deliveryRate
      })
    } catch (error) {
      console.error('Error calculating notification stats:', error)
      setNotificationStats({
        totalNotifications: 0,
        unreadNotifications: 0,
        sentToday: 0,
        deliveryRate: 0
      })
    }
  }

  const handleCreateNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const notificationData = {
        title: newNotification.title,
        message: newNotification.message,
        type: newNotification.type,
        priority: newNotification.priority,
        targetUsers: newNotification.targetUsers,
        isScheduled: newNotification.isScheduled,
        scheduledTime: newNotification.scheduledTime,
        createdAt: new Date().toISOString(),
        sentAt: newNotification.isScheduled ? null : new Date().toISOString(),
        isRead: false,
        status: newNotification.isScheduled ? 'scheduled' : 'sent',
        createdBy: 'admin@e-responde.com'
      }

      // Create notification for all users or specific user
      if (newNotification.targetUsers === 'all') {
        // Get all users and send notification to each
        const usersRef = ref(realtimeDb, 'civilian/civilian account')
        const usersSnapshot = await get(usersRef)
        
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val()
          const notificationPromises = []
          
          Object.keys(usersData).forEach(userId => {
            const notificationRef = ref(realtimeDb, `notifications/${userId}`)
            const newNotificationRef = push(notificationRef)
            notificationPromises.push(update(newNotificationRef, notificationData))
          })
          
          await Promise.all(notificationPromises)
        }
      } else {
        // Send to specific user
        const notificationRef = ref(realtimeDb, `notifications/${newNotification.targetUsers}`)
        const newNotificationRef = push(notificationRef)
        await update(newNotificationRef, notificationData)
      }

      // Reset form
      setNewNotification({
        title: '',
        message: '',
        type: 'general',
        priority: 'medium',
        targetUsers: 'all',
        scheduledTime: '',
        isScheduled: false
      })
      
      setShowCreateModal(false)
      alert('Notification created successfully!')
      
    } catch (err) {
      console.error('Error creating notification:', err)
      alert('Failed to create notification. Please try again.')
    }
  }

  const handleMarkAsRead = async (notificationId, userId) => {
    try {
      const notificationRef = ref(realtimeDb, `notifications/${userId}/${notificationId}`)
      await update(notificationRef, {
        isRead: true,
        readAt: new Date().toISOString()
      })
      
      alert('Notification marked as read')
    } catch (err) {
      console.error('Error marking notification as read:', err)
      alert('Failed to mark notification as read. Please try again.')
    }
  }

  const handleDeleteNotification = async (notificationId, userId) => {
    if (!confirm('Are you sure you want to delete this notification?')) {
      return
    }

    try {
      const notificationRef = ref(realtimeDb, `notifications/${userId}/${notificationId}`)
      await remove(notificationRef)
      
      alert('Notification deleted successfully')
    } catch (err) {
      console.error('Error deleting notification:', err)
      alert('Failed to delete notification. Please try again.')
    }
  }

  const handleViewNotificationDetails = (notification) => {
    setSelectedNotification(notification)
    setShowNotificationDetails(true)
  }

  const handleCloseNotificationDetails = () => {
    setSelectedNotification(null)
    setShowNotificationDetails(false)
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

  const getTypeColor = (type) => {
    if (!type) return '#6b7280'
    switch (type) {
      case 'sos_alert': return '#ef4444'
      case 'dispatch_assignment': return '#3b82f6'
      case 'crime_report': return '#8b5cf6'
      case 'system_alert': return '#f59e0b'
      case 'general': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getTypeIcon = (type) => {
    if (!type) return '📢'
    switch (type) {
      case 'sos_alert': return '🚨'
      case 'dispatch_assignment': return '🚔'
      case 'crime_report': return '📋'
      case 'system_alert': return '⚠️'
      case 'general': return '📢'
      default: return '📢'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#dc2626'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return '#10b981'
      case 'delivered': return '#3b82f6'
      case 'scheduled': return '#f59e0b'
      case 'failed': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    const typeMatch = filterType === 'all' || notification.type === filterType
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'read' && notification.isRead) ||
      (filterStatus === 'unread' && !notification.isRead) ||
      (filterStatus === 'scheduled' && notification.status === 'scheduled')
    const userMatch = filterUser === 'all' || notification.userId === filterUser
    
    return typeMatch && statusMatch && userMatch
  })

  if (loading) {
    return (
      <div className="notification-management-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading notification management...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="notification-management-container">
      <div className="notification-header">
        <h1>Notification Management</h1>
        <p>Manage and monitor system notifications</p>
        
        <div className="header-actions">
          <button 
            className="create-notification-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Notification
          </button>
        </div>
      </div>

      {/* Notification Statistics */}
      <div className="notification-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Notifications</h3>
            <p className="stat-number">{notificationStats.totalNotifications}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📬</div>
          <div className="stat-content">
            <h3>Unread</h3>
            <p className="stat-number">{notificationStats.unreadNotifications}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Sent Today</h3>
            <p className="stat-number">{notificationStats.sentToday}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Delivery Rate</h3>
            <p className="stat-number">{notificationStats.deliveryRate}%</p>
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
          <label>Type Filter:</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="sos_alert">SOS Alert</option>
            <option value="dispatch_assignment">Dispatch Assignment</option>
            <option value="crime_report">Crime Report</option>
            <option value="system_alert">System Alert</option>
            <option value="general">General</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Status Filter:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>User Filter:</label>
          <select 
            value={filterUser} 
            onChange={(e) => setFilterUser(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Users</option>
            {/* Add specific users here if needed */}
          </select>
        </div>
        
        <button onClick={fetchNotifications} className="refresh-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23,4 23,10 17,10"></polyline>
            <polyline points="1,20 1,14 7,14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      {/* Notifications Table */}
      <div className="notifications-section">
        <h2>All Notifications</h2>
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            <h3>No Notifications Found</h3>
            <p>No notifications match your current filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="notifications-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>User</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((notification, index) => (
                  <tr key={notification.id}>
                    <td className="notification-number">{index + 1}</td>
                    <td className="notification-type">
                      <span className="type-badge">
                        {getTypeIcon(notification.type)} {notification.type ? notification.type.replace('_', ' ').toUpperCase() : 'GENERAL'}
                      </span>
                    </td>
                    <td className="notification-title">
                      <div className="title-text">{notification.title || 'No Title'}</div>
                      <div className="message-preview">
                        {notification.message ? notification.message.substring(0, 50) + '...' : 'No message'}
                      </div>
                    </td>
                    <td className="notification-user">
                      {notification.userId ? notification.userId.substring(0, 8) + '...' : 'Unknown User'}
                    </td>
                    <td className="notification-priority">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(notification.priority) }}
                      >
                        {notification.priority?.toUpperCase() || 'MEDIUM'}
                      </span>
                    </td>
                    <td className="notification-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(notification.status) }}
                      >
                        {notification.isRead ? 'READ' : 'UNREAD'}
                      </span>
                    </td>
                    <td className="notification-created">{formatDate(notification.createdAt)}</td>
                    <td className="notification-actions">
                      <button 
                        className="view-details-btn"
                        onClick={() => handleViewNotificationDetails(notification)}
                      >
                        View
                      </button>
                      {!notification.isRead && (
                        <button 
                          className="mark-read-btn"
                          onClick={() => handleMarkAsRead(notification.id, notification.userId)}
                        >
                          Mark Read
                        </button>
                      )}
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteNotification(notification.id, notification.userId)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Notification Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content create-modal">
            <div className="modal-header">
              <h3>Create New Notification</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                  placeholder="Enter notification title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                  placeholder="Enter notification message"
                  rows="4"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={newNotification.type}
                    onChange={(e) => setNewNotification({...newNotification, type: e.target.value})}
                  >
                    <option value="general">General</option>
                    <option value="sos_alert">SOS Alert</option>
                    <option value="dispatch_assignment">Dispatch Assignment</option>
                    <option value="crime_report">Crime Report</option>
                    <option value="system_alert">System Alert</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newNotification.priority}
                    onChange={(e) => setNewNotification({...newNotification, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Target Users</label>
                <select
                  value={newNotification.targetUsers}
                  onChange={(e) => setNewNotification({...newNotification, targetUsers: e.target.value})}
                >
                  <option value="all">All Users</option>
                  {/* Add specific users here if needed */}
                </select>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newNotification.isScheduled}
                    onChange={(e) => setNewNotification({...newNotification, isScheduled: e.target.checked})}
                  />
                  Schedule for later
                </label>
              </div>

              {newNotification.isScheduled && (
                <div className="form-group">
                  <label>Scheduled Time</label>
                  <input
                    type="datetime-local"
                    value={newNotification.scheduledTime}
                    onChange={(e) => setNewNotification({...newNotification, scheduledTime: e.target.value})}
                  />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="create-btn" onClick={handleCreateNotification}>
                Create Notification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Details Modal */}
      {showNotificationDetails && selectedNotification && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Notification Details</h3>
              <button className="modal-close" onClick={handleCloseNotificationDetails}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="notification-details-grid">
                <div className="detail-item">
                  <strong>ID:</strong> {selectedNotification.id}
                </div>
                <div className="detail-item">
                  <strong>Type:</strong> 
                  <span className="type-badge">
                    {getTypeIcon(selectedNotification.type)} {selectedNotification.type.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Title:</strong> {selectedNotification.title}
                </div>
                <div className="detail-item">
                  <strong>Message:</strong> {selectedNotification.message}
                </div>
                <div className="detail-item">
                  <strong>User ID:</strong> {selectedNotification.userId}
                </div>
                <div className="detail-item">
                  <strong>Priority:</strong> 
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(selectedNotification.priority) }}
                  >
                    {selectedNotification.priority?.toUpperCase() || 'MEDIUM'}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Status:</strong> 
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedNotification.status) }}
                  >
                    {selectedNotification.isRead ? 'READ' : 'UNREAD'}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Created:</strong> {formatDate(selectedNotification.createdAt)}
                </div>
                <div className="detail-item">
                  <strong>Read:</strong> {formatDate(selectedNotification.readAt)}
                </div>
                <div className="detail-item">
                  <strong>Sent:</strong> {formatDate(selectedNotification.sentAt)}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              {!selectedNotification.isRead && (
                <button 
                  className="mark-read-btn"
                  onClick={() => {
                    handleMarkAsRead(selectedNotification.id, selectedNotification.userId)
                    handleCloseNotificationDetails()
                  }}
                >
                  Mark as Read
                </button>
              )}
              <button className="close-btn" onClick={handleCloseNotificationDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationManagement
