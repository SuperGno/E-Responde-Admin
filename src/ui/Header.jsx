import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import notificationService from '../services/notificationService'

// Helper functions for notifications
const getNotificationTitle = (type) => {
  switch (type) {
    case 'crime_report': return 'New Crime Report'
    case 'sos_alert': return 'SOS Alert'
    case 'police_dispatch': return 'Police Dispatch'
    case 'police_availability': return 'Officer Available'
    default: return 'Notification'
  }
}

const getNotificationMessage = (notification) => {
  switch (notification.type) {
    case 'crime_report':
      if (notification.reportType && notification.reportDescription) {
        // Show specific report details
        const shortDescription = notification.reportDescription.length > 50 
          ? notification.reportDescription.substring(0, 50) + '...'
          : notification.reportDescription
        return `${notification.reportType}: ${shortDescription}`
      }
      return 'New crime report submitted from mobile app'
    case 'sos_alert':
      return `${notification.count} active SOS alert(s)`
    case 'police_dispatch':
      return `${notification.count} officer(s) dispatched`
    case 'police_availability':
      if (notification.previousCount !== undefined) {
        const change = notification.count - notification.previousCount
        if (change > 0) {
          return `${change} officer(s) became available`
        } else if (change < 0) {
          return `${Math.abs(change)} officer(s) became unavailable`
        }
      }
      return `${notification.count} officer(s) currently available`
    default:
      return 'New notification received'
  }
}

const getNotificationPriority = (type) => {
  switch (type) {
    case 'sos_alert': return 'critical'
    case 'crime_report': return 'high'
    case 'police_dispatch': return 'high'
    case 'police_availability': return 'info'
    default: return 'info'
  }
}

export default function Header() {
  const { user, claims } = useAuth()
  const navigate = useNavigate()
  // Fixed black and white theme - no theme switching
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const notificationRef = useRef(null)
  const lastNotificationIds = useRef(new Set())

  // Set fixed black and white theme
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('bw-theme')
  }, [])

  // Initialize notification service
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        setIsLoading(true)
        
        // Debug database structure
        await notificationService.debugDatabaseStructure()
        
        // Get initial notifications
        const initialNotifications = await notificationService.getAllNotifications()
        setNotifications(initialNotifications)
        
        // Get unread count
        const count = await notificationService.getUnreadCount()
        setUnreadCount(count)
        
        // Start listening for real-time updates
        notificationService.startListening()
        
        // Trigger notifications for existing reports (for testing)
        setTimeout(() => {
          notificationService.triggerNotificationsForExistingReports()
        }, 2000) // Wait 2 seconds after initialization
        
        // Subscribe to real-time updates
        const unsubscribe = notificationService.subscribe((notification) => {
          // Create a unique ID for this notification
          const notificationId = `${notification.type}_${notification.count}_${Date.now()}`
          
          // Check if we've already processed this notification
          if (lastNotificationIds.current.has(notificationId)) {
            return
          }
          
          // Add to processed notifications
          lastNotificationIds.current.add(notificationId)
          
          // Clean up old notification IDs (keep only last 50)
          if (lastNotificationIds.current.size > 50) {
            const idsArray = Array.from(lastNotificationIds.current)
            lastNotificationIds.current.clear()
            idsArray.slice(-25).forEach(id => lastNotificationIds.current.add(id))
          }
          
          setNotifications(prev => {
            const newNotification = {
              id: notificationId,
              type: notification.type,
              title: getNotificationTitle(notification.type),
              message: getNotificationMessage(notification),
              timestamp: new Date().toISOString(),
              priority: getNotificationPriority(notification.type),
              data: notification.data
            }
            
            // Remove any existing notifications of the same type to prevent duplicates
            const filteredPrev = prev.filter(notif => notif.type !== notification.type)
            return [newNotification, ...filteredPrev].slice(0, 20) // Keep only last 20 notifications
          })
          setUnreadCount(prev => prev + 1)
        })
        
        setIsLoading(false)
        
        return () => {
          unsubscribe()
          notificationService.stopListening()
        }
      } catch (error) {
        console.error('Error initializing notifications:', error)
        setIsLoading(false)
      }
    }

    initializeNotifications()
  }, [])

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const handleNotificationClick = async (notification) => {
    try {
      // Mark notification as read
      await notificationService.markAsRead(notification.id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      
      // Close notification dropdown
      setShowNotifications(false)
      
      // Navigate based on notification type
      if (notification.type === 'crime_report') {
        // Navigate to dashboard first
        navigate('/')
        
        // If there's a specific report ID, find and click its view button
        if (notification.reportId) {
          console.log('🔔 Navigating to specific report:', notification.reportId)
          
          // Wait for dashboard to load, then find and click the specific report's view button
          setTimeout(() => {
            // Try multiple selectors to find the report
            const selectors = [
              `[data-report-id="${notification.reportId}"]`,
              `[data-id="${notification.reportId}"]`,
              `tr[data-report-id="${notification.reportId}"]`,
              `tr[data-id="${notification.reportId}"]`
            ]
            
            let reportElement = null
            for (const selector of selectors) {
              reportElement = document.querySelector(selector)
              if (reportElement) break
            }
            
            if (reportElement) {
              // Try multiple selectors for the view button
              const viewButtonSelectors = [
                '.view-btn',
                '[data-action="view"]',
                'button[class*="view"]',
                'button:contains("VIEW")',
                'button:contains("View")'
              ]
              
              let viewButton = null
              for (const selector of viewButtonSelectors) {
                viewButton = reportElement.querySelector(selector)
                if (viewButton) break
              }
              
              // If not found in the report element, look for buttons with "VIEW" text
              if (!viewButton) {
                const buttons = reportElement.querySelectorAll('button')
                for (const button of buttons) {
                  if (button.textContent.includes('VIEW') || button.textContent.includes('View')) {
                    viewButton = button
                    break
                  }
                }
              }
              
              if (viewButton) {
                viewButton.click()
                console.log('🔔 Successfully clicked view button for report:', notification.reportId)
              } else {
                console.log('🔔 View button not found for report:', notification.reportId)
                // Fallback: scroll to the report element
                reportElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                reportElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                setTimeout(() => {
                  reportElement.style.backgroundColor = ''
                }, 3000)
              }
            } else {
              console.log('🔔 Report element not found:', notification.reportId)
            }
          }, 1500) // Wait 1.5 seconds for dashboard to fully load
        }
      } else if (notification.type === 'sos_alert') {
        // Navigate to dispatch center for SOS alerts
        navigate('/dispatch')
      } else if (notification.type === 'police_dispatch') {
        // Navigate to dispatch center for police dispatch
        navigate('/dispatch')
      } else if (notification.type === 'police_availability') {
        // Navigate to account management for police availability
        navigate('/accounts')
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
    }
  }

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications)
  }

  const formatTime = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now - time) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return time.toLocaleDateString()
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-black">E-Responde Dashboard</h1>
          <p className="text-sm text-gray-500 uppercase tracking-wider">Admin Control Center</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative" ref={notificationRef}>
            <button 
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2" 
              onClick={toggleNotifications}
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-status-danger text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
              
              {showNotifications && (
                <div className="absolute top-full right-0 w-96 max-h-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50 mt-2">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-black">Notifications</h3>
                      <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-full">{unreadCount} unread</span>
                    </div>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-3 p-8 text-gray-500">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                        <span>Loading notifications...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notification) => (
                        <div 
                          key={notification.id}
                          className={`p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                            notification.priority === 'critical' ? 'border-l-4 border-l-status-danger' : ''
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="notification-icon">
                            {notification.type === 'crime_report' && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4"/>
                                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                                <path d="M12 1v6m0 6v6"/>
                              </svg>
                            )}
                            {notification.type === 'sos_alert' && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                <path d="M12 6v6l4 2"/>
                              </svg>
                            )}
                            {notification.type === 'police_dispatch' && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                <path d="M12 8v4l3 3"/>
                              </svg>
                            )}
                            {notification.type === 'police_availability' && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="8.5" cy="7" r="4"/>
                                <path d="M20 8v6"/>
                                <path d="M23 11h-6"/>
                              </svg>
                            )}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            
                            {/* Show report details if available */}
                            {notification.reportType && (
                              <div className="notification-report-details">
                                <div className="report-type-badge">{notification.reportType}</div>
                                {notification.reportLocation && (
                                  <div className="report-location">
                                    📍 {notification.reportLocation.length > 30 
                                      ? notification.reportLocation.substring(0, 30) + '...'
                                      : notification.reportLocation
                                    }
                                  </div>
                                )}
                                {notification.reportStatus && (
                                  <div className="report-status">
                                    Status: <span className={`status-${notification.reportStatus.toLowerCase()}`}>
                                      {notification.reportStatus}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="notification-time">{formatTime(notification.timestamp)}</div>
                            
                            {/* Action buttons for notifications */}
                            <div className="notification-actions">
                              <button 
                                className="notification-action-btn view-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleNotificationClick(notification)
                                }}
                                title="View Details"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                                View
                              </button>
                              
                              <button 
                                className="notification-action-btn mark-read-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  notificationService.markAsRead(notification.id)
                                  setUnreadCount(prev => Math.max(0, prev - 1))
                                }}
                                title="Mark as Read"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 12l2 2 4-4"/>
                                  <circle cx="12" cy="12" r="10"/>
                                </svg>
                                Mark Read
                              </button>
                            </div>
                          </div>
                          {notification.priority === 'critical' && (
                            <div className="notification-priority-indicator"></div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 10 && (
                    <div className="notification-footer">
                      <button className="view-all-btn">View All Notifications</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                <img 
                  src="/Admin-E-Responde.png" 
                  alt="E-Responde Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-black">{claims?.role || 'Administrator'}</div>
                <div className="text-xs text-gray-500">{user?.email || 'admin@e-responde.ph'}</div>
              </div>
            </div>
        </div>
      </div>
    </header>
  )
}


