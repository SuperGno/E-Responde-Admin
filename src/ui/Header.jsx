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

export default function Header({ onNavigateToReport }) {
  const { user, claims } = useAuth()
  const navigate = useNavigate()
  // Fixed black and white theme - no theme switching
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showNotificationMenu, setShowNotificationMenu] = useState(false)
  const [showIndividualMenu, setShowIndividualMenu] = useState(null)
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
        
        // Calculate unread count from actual notifications
        const unreadCount = initialNotifications.filter(notif => !notif.isRead).length
        setUnreadCount(unreadCount)
        
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
              data: notification.data,
              reportId: notification.data?.reportId || notification.reportId,
              reportType: notification.data?.reportType || notification.reportType,
              reportLocation: notification.data?.reportLocation || notification.reportLocation,
              reportStatus: notification.data?.reportStatus || notification.reportStatus,
              isRead: false // Mark as unread by default
            }
            
            // Remove any existing notifications of the same type to prevent duplicates
            const filteredPrev = prev.filter(notif => notif.type !== notification.type)
            const updatedNotifications = [newNotification, ...filteredPrev].slice(0, 20) // Keep only last 20 notifications
            
            // Update unread count based on actual notifications
            const unreadCount = updatedNotifications.filter(notif => !notif.isRead).length
            setUnreadCount(unreadCount)
            
            return updatedNotifications
          })
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
        setShowNotificationMenu(false)
        setShowIndividualMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])



  const handleNotificationClick = async (notification) => {
    try {
      console.log('🔔 Notification clicked:', notification)
      
      // Mark notification as read
      await notificationService.markAsRead(notification.id)
      
      // Update the notification in the state
      setNotifications(prev => {
        const updated = prev.map(notif => 
          notif.id === notification.id ? { ...notif, isRead: true } : notif
        )
        
        // Recalculate unread count
        const unreadCount = updated.filter(notif => !notif.isRead).length
        setUnreadCount(unreadCount)
        
        return updated
      })
      
      // Close notification dropdown
      setShowNotifications(false)
      
      // Navigate based on notification type
      if (notification.type === 'crime_report') {
        console.log('🔔 Crime report notification - navigating to report details')
        
        if (notification.reportId && onNavigateToReport) {
          console.log('🔔 Navigating to specific report:', notification.reportId)
          // Navigate directly to the report detail view
          onNavigateToReport(notification.reportId)
        } else {
          console.log('🔔 No report ID or onNavigateToReport function - navigating to dashboard')
          // Navigate to dashboard without specific report
          navigate('/')
        }
      } else if (notification.type === 'sos_alert') {
        console.log('🔔 SOS alert notification - navigating to dispatch')
        // Navigate to dispatch center for SOS alerts
        navigate('/dispatch')
      } else if (notification.type === 'police_dispatch') {
        console.log('🔔 Police dispatch notification - navigating to dispatch')
        // Navigate to dispatch center for police dispatch
        navigate('/dispatch')
      } else if (notification.type === 'police_availability') {
        console.log('🔔 Police availability notification - navigating to accounts')
        // Navigate to account management for police availability
        navigate('/accounts')
      } else {
        console.log('🔔 Unknown notification type - navigating to dashboard')
        // Default to dashboard for unknown types
        navigate('/')
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
    }
  }

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications)
    setShowNotificationMenu(false)
  }

  const handleMarkAllAsRead = async () => {
    try {
      // Mark all notifications as read
      for (const notification of notifications) {
        await notificationService.markAsRead(notification.id)
      }
      
      // Update all notifications to read state
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })))
      setUnreadCount(0)
      setShowNotificationMenu(false)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId)
      
      // Update the notification in the state
      setNotifications(prev => {
        const updated = prev.map(notif => 
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
        
        // Recalculate unread count
        const unreadCount = updated.filter(notif => !notif.isRead).length
        setUnreadCount(unreadCount)
        
        return updated
      })
      
      setShowIndividualMenu(null)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleDeleteNotification = async (notificationId) => {
    try {
      // Remove notification from the list and recalculate unread count
      setNotifications(prev => {
        const updated = prev.filter(notif => notif.id !== notificationId)
        const unreadCount = updated.filter(notif => !notif.isRead).length
        setUnreadCount(unreadCount)
        return updated
      })
      
      setShowIndividualMenu(null)
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
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
                <div className="absolute top-full right-0 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-2">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                      <div className="flex items-center space-x-2">
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {unreadCount} unread
                        </span>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowNotificationMenu(!showNotificationMenu)
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="1"/>
                              <circle cx="12" cy="5" r="1"/>
                              <circle cx="12" cy="19" r="1"/>
                            </svg>
                          </button>
                          
                          {showNotificationMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAllAsRead()
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                                  <path d="M9 12l2 2 4-4"/>
                                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                                </svg>
                                Mark all as read
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center p-8 text-gray-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                        <span className="ml-2">Loading notifications...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        <p className="text-sm font-medium">No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notification) => (
                        <div 
                          key={notification.id}
                          className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                notification.type === 'crime_report' ? 'bg-blue-100 text-blue-600' :
                                notification.type === 'sos_alert' ? 'bg-red-100 text-red-600' :
                                notification.type === 'police_dispatch' ? 'bg-green-100 text-green-600' :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                {notification.type === 'crime_report' && (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4"/>
                                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                                  </svg>
                                )}
                                {notification.type === 'sos_alert' && (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                )}
                                {notification.type === 'police_dispatch' && (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                )}
                                {notification.type === 'police_availability' && (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="8.5" cy="7" r="4"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div 
                                  className="flex-1 cursor-pointer"
                                  onClick={() => handleNotificationClick(notification)}
                                >
                                  <h4 className="text-sm font-semibold text-gray-900">{notification.title}</h4>
                                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                  
                                  {notification.reportType && (
                                    <div className="mt-2">
                                      <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded">
                                        {notification.reportType}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">{formatTime(notification.timestamp)}</span>
                                  
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setShowIndividualMenu(showIndividualMenu === notification.id ? null : notification.id)
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="1"/>
                                        <circle cx="12" cy="5" r="1"/>
                                        <circle cx="12" cy="19" r="1"/>
                                      </svg>
                                    </button>
                                    
                                    {showIndividualMenu === notification.id && (
                                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleMarkAsRead(notification.id)
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                                            <path d="M9 12l2 2 4-4"/>
                                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                                          </svg>
                                          Mark as read
                                        </button>
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteNotification(notification.id)
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                                            <path d="M3 6h18"/>
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                          </svg>
                                          Delete this notification
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 10 && (
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                      <button className="w-full bg-gray-900 text-white text-sm font-medium py-2 px-4 rounded hover:bg-gray-800">
                        View All Notifications
                      </button>
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


