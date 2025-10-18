// Notification utilities for police accounts
import { getDatabase, ref, get, update, onValue, off } from 'firebase/database'
import { app } from '../firebase'

/**
 * Get all notifications for a specific police officer
 * @param {string} policeId - The police officer's ID
 * @returns {Promise<Array>} Array of notifications
 */
export const getPoliceNotifications = async (policeId) => {
  try {
    const db = getDatabase(app)
    const notificationsRef = ref(db, `police/notifications/${policeId}`)
    const snapshot = await get(notificationsRef)
    
    if (snapshot.exists()) {
      const notificationsData = snapshot.val()
      return Object.values(notificationsData).filter(notification => notification.isActive)
    }
    return []
  } catch (error) {
    console.error('Error fetching police notifications:', error)
    return []
  }
}

/**
 * Mark a notification as read
 * @param {string} policeId - The police officer's ID
 * @param {string} notificationId - The notification ID
 */
export const markNotificationAsRead = async (policeId, notificationId) => {
  try {
    const db = getDatabase(app)
    const notificationRef = ref(db, `police/notifications/${policeId}/${notificationId}`)
    await update(notificationRef, { isRead: true })
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

/**
 * Get unread notification count for a police officer
 * @param {string} policeId - The police officer's ID
 * @returns {Promise<number>} Number of unread notifications
 */
export const getUnreadNotificationCount = async (policeId) => {
  try {
    const notifications = await getPoliceNotifications(policeId)
    return notifications.filter(notification => !notification.isRead).length
  } catch (error) {
    console.error('Error getting unread notification count:', error)
    return 0
  }
}

/**
 * Listen for real-time notifications for a police officer
 * @param {string} policeId - The police officer's ID
 * @param {function} callback - Callback function to handle notifications
 * @returns {function} Unsubscribe function
 */
export const listenForNotifications = (policeId, callback) => {
  try {
    const db = getDatabase(app)
    const notificationsRef = ref(db, `police/notifications/${policeId}`)
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notificationsData = snapshot.val()
        const notifications = Object.values(notificationsData).filter(notification => notification.isActive)
        callback(notifications)
      } else {
        callback([])
      }
    })
    
    return unsubscribe
  } catch (error) {
    console.error('Error setting up notification listener:', error)
    return () => {}
  }
}

/**
 * Get notification details for a specific dispatch assignment
 * @param {string} policeId - The police officer's ID
 * @param {string} reportId - The report ID
 * @returns {Promise<Object|null>} Notification details or null
 */
export const getDispatchNotification = async (policeId, reportId) => {
  try {
    const notifications = await getPoliceNotifications(policeId)
    return notifications.find(notification => 
      notification.type === 'dispatch_assignment' && 
      notification.reportId === reportId
    ) || null
  } catch (error) {
    console.error('Error getting dispatch notification:', error)
    return null
  }
}

/**
 * Update notification status (e.g., when police officer responds to dispatch)
 * @param {string} policeId - The police officer's ID
 * @param {string} notificationId - The notification ID
 * @param {Object} updates - Updates to apply to the notification
 */
export const updateNotification = async (policeId, notificationId, updates) => {
  try {
    const db = getDatabase(app)
    const notificationRef = ref(db, `police/notifications/${policeId}/${notificationId}`)
    await update(notificationRef, updates)
  } catch (error) {
    console.error('Error updating notification:', error)
  }
}
