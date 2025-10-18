import { useState, useEffect } from 'react'
import { getPoliceNotifications, markNotificationAsRead, listenForNotifications } from '../utils/notificationUtils'
import './PoliceNotifications.css'

function PoliceNotifications({ policeId }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!policeId) {
      setLoading(false)
      return
    }

    // Initial load
    const loadNotifications = async () => {
      try {
        setLoading(true)
        const policeNotifications = await getPoliceNotifications(policeId)
        setNotifications(policeNotifications)
        setError('')
      } catch (err) {
        console.error('Error loading notifications:', err)
        setError('Failed to load notifications')
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()

    // Set up real-time listener
    const unsubscribe = listenForNotifications(policeId, (newNotifications) => {
      setNotifications(newNotifications)
    })

    return () => {
      unsubscribe()
    }
  }, [policeId])

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(policeId, notificationId)
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      )
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#dc2626'
      case 'medium': return '#d97706'
      case 'low': return '#16a34a'
      default: return '#6b7280'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="police-notifications">
        <div className="loading">Loading notifications...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="police-notifications">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="police-notifications">
      <div className="notifications-header">
        <h2>Dispatch Notifications</h2>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount} unread</span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
          <p>No notifications</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`notification-card ${notification.isRead ? 'read' : 'unread'}`}
            >
              <div className="notification-header">
                <div className="notification-title">
                  <h3>{notification.title}</h3>
                  {!notification.isRead && <div className="unread-indicator"></div>}
                </div>
                <div className="notification-time">
                  {formatDate(notification.createdAt)}
                </div>
              </div>

              <div className="notification-content">
                <p className="notification-message">{notification.message}</p>
                
                {notification.type === 'dispatch_assignment' && notification.reportDetails && (
                  <div className="dispatch-details">
                    <h4>Assignment Details:</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <strong>Crime Type:</strong> {notification.reportDetails.crimeType}
                      </div>
                      <div className="detail-item">
                        <strong>Location:</strong> {notification.reportDetails.location}
                      </div>
                      <div className="detail-item">
                        <strong>Reporter:</strong> {notification.reportDetails.reporterName}
                      </div>
                      <div className="detail-item">
                        <strong>Priority:</strong> 
                        <span 
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(notification.reportDetails.priority) }}
                        >
                          {notification.reportDetails.priority}
                        </span>
                      </div>
                      {notification.reportDetails.estimatedTime && (
                        <div className="detail-item">
                          <strong>Estimated Response Time:</strong> {notification.reportDetails.estimatedTime}
                        </div>
                      )}
                      {notification.reportDetails.notes && (
                        <div className="detail-item">
                          <strong>Dispatch Notes:</strong> {notification.reportDetails.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="description-section">
                      <strong>Description:</strong>
                      <p>{notification.reportDetails.description}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="notification-actions">
                {!notification.isRead && (
                  <button 
                    className="mark-read-btn"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    Mark as Read
                  </button>
                )}
                <button className="view-details-btn">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PoliceNotifications
