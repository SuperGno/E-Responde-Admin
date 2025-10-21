import { realtimeDb } from '../firebase'
import { ref, onValue, off, get, update, push, set } from 'firebase/database'

class NotificationService {
  constructor() {
    this.listeners = new Map()
    this.notificationCallbacks = new Set()
    this.lastNotifications = new Map() // Track last notifications to prevent duplicates
    this.notificationCooldowns = new Map() // Prevent spam notifications
  }

  // Listen for real-time notifications
  startListening() {
    // Listen for new crime reports (multiple possible paths)
    this.listenForCrimeReports()
    this.listenForIncidentReports()
    this.listenForEmergencyReports()
    // Listen for SOS alerts
    this.listenForSOSAlerts()
    // Listen for police dispatch updates
    this.listenForPoliceDispatch()
    // Listen for police availability updates
    this.listenForPoliceAvailability()
  }

  // Stop all listeners
  stopListening() {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe()
    })
    this.listeners.clear()
  }

  // Listen for new crime reports (using the same path as Dashboard)
  listenForCrimeReports() {
    const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
    let lastReportIds = new Set()
    let lastNotificationTime = 0
    const COOLDOWN_PERIOD = 5000 // 5 seconds cooldown to prevent spam
    
    console.log('🔔 Setting up notification listener for civilian crime reports...')
    
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      console.log('🔔 Notification listener triggered:', snapshot.exists())
      
      if (snapshot.exists()) {
        const reports = snapshot.val()
        const now = Date.now()
        const timeSinceLastNotification = now - lastNotificationTime
        
        // Get all reports and find truly new ones
        const allReports = Object.entries(reports).map(([id, report]) => ({
          id,
          ...report,
          timestamp: report.timestamp || report.createdAt || report.date
        }))
        
        console.log('🔔 Total reports found:', allReports.length)
        
        // Find reports from the last 10 minutes
        const recentReports = allReports.filter(report => {
          const reportTime = new Date(report.timestamp)
          const tenMinutesAgo = new Date(now - 10 * 60 * 1000)
          return reportTime > tenMinutesAgo
        })
        
        console.log('🔔 Recent reports (last 10 min):', recentReports.length)
        
        // Find truly new reports (not seen before)
        const newReports = recentReports.filter(report => 
          !lastReportIds.has(report.id) && 
          report.status !== 'resolved' && 
          report.status !== 'closed'
        )
        
        console.log('🔔 New reports (not seen before):', newReports.length)
        
        // Only notify if there are new reports and enough time has passed
        if (newReports.length > 0 && timeSinceLastNotification > COOLDOWN_PERIOD) {
          console.log('🔔 Sending individual notifications for', newReports.length, 'new reports')
          
          // Add new report IDs to tracking set
          newReports.forEach(report => lastReportIds.add(report.id))
          
          // Clean up old IDs (keep only last 100)
          if (lastReportIds.size > 100) {
            const idsArray = Array.from(lastReportIds)
            lastReportIds.clear()
            idsArray.slice(-50).forEach(id => lastReportIds.add(id))
          }
          
          // Send individual notification for each report
          newReports.forEach((report, index) => {
            // Add a small delay between notifications to avoid spam
            setTimeout(() => {
              this.notifyCallbacks({
                type: 'crime_report',
                data: [report], // Single report
                count: 1,
                isNew: true,
                reportId: report.id,
                reportType: report.type,
                reportDescription: report.description,
                reportLocation: report.location?.address || report.location,
                reportStatus: report.status
              })
            }, index * 500) // 500ms delay between each notification
          })
          
          lastNotificationTime = now
        }
      } else {
        console.log('🔔 No reports found in database')
      }
    })
    
    this.listeners.set('crime_reports', unsubscribe)
  }

  // Listen for incident reports (alternative path)
  listenForIncidentReports() {
    const incidentRef = ref(realtimeDb, 'incidents')
    let lastIncidentIds = new Set()
    let lastNotificationTime = 0
    const COOLDOWN_PERIOD = 5000
    
    const unsubscribe = onValue(incidentRef, (snapshot) => {
      if (snapshot.exists()) {
        const incidents = snapshot.val()
        const now = Date.now()
        const timeSinceLastNotification = now - lastNotificationTime
        
        const allIncidents = Object.entries(incidents).map(([id, incident]) => ({
          id,
          ...incident,
          timestamp: incident.timestamp || incident.createdAt
        }))
        
        const recentIncidents = allIncidents.filter(incident => {
          const incidentTime = new Date(incident.timestamp)
          const tenMinutesAgo = new Date(now - 10 * 60 * 1000)
          return incidentTime > tenMinutesAgo
        })
        
        const newIncidents = recentIncidents.filter(incident => 
          !lastIncidentIds.has(incident.id) && 
          incident.status !== 'resolved' && 
          incident.status !== 'closed'
        )
        
        if (newIncidents.length > 0 && timeSinceLastNotification > COOLDOWN_PERIOD) {
          newIncidents.forEach(incident => lastIncidentIds.add(incident.id))
          
          if (lastIncidentIds.size > 100) {
            const idsArray = Array.from(lastIncidentIds)
            lastIncidentIds.clear()
            idsArray.slice(-50).forEach(id => lastIncidentIds.add(id))
          }
          
          this.notifyCallbacks({
            type: 'crime_report',
            data: newIncidents,
            count: newIncidents.length,
            isNew: true
          })
          
          lastNotificationTime = now
        }
      }
    })
    
    this.listeners.set('incident_reports', unsubscribe)
  }

  // Listen for emergency reports (another possible path)
  listenForEmergencyReports() {
    const emergencyRef = ref(realtimeDb, 'emergency_reports')
    let lastEmergencyIds = new Set()
    let lastNotificationTime = 0
    const COOLDOWN_PERIOD = 5000
    
    const unsubscribe = onValue(emergencyRef, (snapshot) => {
      if (snapshot.exists()) {
        const emergencies = snapshot.val()
        const now = Date.now()
        const timeSinceLastNotification = now - lastNotificationTime
        
        const allEmergencies = Object.entries(emergencies).map(([id, emergency]) => ({
          id,
          ...emergency,
          timestamp: emergency.timestamp || emergency.createdAt
        }))
        
        const recentEmergencies = allEmergencies.filter(emergency => {
          const emergencyTime = new Date(emergency.timestamp)
          const tenMinutesAgo = new Date(now - 10 * 60 * 1000)
          return emergencyTime > tenMinutesAgo
        })
        
        const newEmergencies = recentEmergencies.filter(emergency => 
          !lastEmergencyIds.has(emergency.id) && 
          emergency.status !== 'resolved' && 
          emergency.status !== 'closed'
        )
        
        if (newEmergencies.length > 0 && timeSinceLastNotification > COOLDOWN_PERIOD) {
          newEmergencies.forEach(emergency => lastEmergencyIds.add(emergency.id))
          
          if (lastEmergencyIds.size > 100) {
            const idsArray = Array.from(lastEmergencyIds)
            lastEmergencyIds.clear()
            idsArray.slice(-50).forEach(id => lastEmergencyIds.add(id))
          }
          
          this.notifyCallbacks({
            type: 'crime_report',
            data: newEmergencies,
            count: newEmergencies.length,
            isNew: true
          })
          
          lastNotificationTime = now
        }
      }
    })
    
    this.listeners.set('emergency_reports', unsubscribe)
  }

  // Listen for SOS alerts
  listenForSOSAlerts() {
    const sosRef = ref(realtimeDb, 'sos_alerts')
    const unsubscribe = onValue(sosRef, (snapshot) => {
      if (snapshot.exists()) {
        const alerts = snapshot.val()
        const activeAlerts = Object.values(alerts).filter(alert => 
          alert.status === 'active' || alert.status === 'pending'
        )
        
        if (activeAlerts.length > 0) {
          this.notifyCallbacks({
            type: 'sos_alert',
            data: activeAlerts,
            count: activeAlerts.length
          })
        }
      }
    })
    
    this.listeners.set('sos_alerts', unsubscribe)
  }

  // Listen for police dispatch updates
  listenForPoliceDispatch() {
    const dispatchRef = ref(realtimeDb, 'police_dispatch')
    const unsubscribe = onValue(dispatchRef, (snapshot) => {
      if (snapshot.exists()) {
        const dispatches = snapshot.val()
        const activeDispatches = Object.values(dispatches).filter(dispatch => 
          dispatch.status === 'dispatched' || dispatch.status === 'en_route'
        )
        
        if (activeDispatches.length > 0) {
          this.notifyCallbacks({
            type: 'police_dispatch',
            data: activeDispatches,
            count: activeDispatches.length
          })
        }
      }
    })
    
    this.listeners.set('police_dispatch', unsubscribe)
  }

  // Listen for police availability updates
  listenForPoliceAvailability() {
    const policeRef = ref(realtimeDb, 'police/police account')
    let lastAvailableCount = 0
    let lastNotificationTime = 0
    const COOLDOWN_PERIOD = 30000 // 30 seconds cooldown
    
    const unsubscribe = onValue(policeRef, (snapshot) => {
      if (snapshot.exists()) {
        const policeAccounts = snapshot.val()
        const availableOfficers = Object.values(policeAccounts).filter(officer => 
          officer.isActive && officer.availability === 'available'
        )
        
        const now = Date.now()
        const timeSinceLastNotification = now - lastNotificationTime
        
        // Only notify if there's a meaningful change and enough time has passed
        if (availableOfficers.length !== lastAvailableCount && 
            timeSinceLastNotification > COOLDOWN_PERIOD &&
            availableOfficers.length > 0) {
          
          this.notifyCallbacks({
            type: 'police_availability',
            data: availableOfficers,
            count: availableOfficers.length,
            previousCount: lastAvailableCount
          })
          
          lastNotificationTime = now
        }
        
        lastAvailableCount = availableOfficers.length
      }
    })
    
    this.listeners.set('police_availability', unsubscribe)
  }

  // Subscribe to notification updates
  subscribe(callback) {
    this.notificationCallbacks.add(callback)
    return () => this.notificationCallbacks.delete(callback)
  }

  // Notify all subscribers
  notifyCallbacks(notification) {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('Error in notification callback:', error)
      }
    })
  }

  // Debug function to check database structure
  async debugDatabaseStructure() {
    try {
      console.log('🔍 Debugging database structure...')
      
      const paths = [
        'civilian/civilian crime reports', // Main path used by Dashboard
        'reports',
        'incidents', 
        'emergency_reports',
        'sos_alerts',
        'police_dispatch',
        'police/police account'
      ]
      
      for (const path of paths) {
        const snapshot = await get(ref(realtimeDb, path))
        if (snapshot.exists()) {
          const data = snapshot.val()
          console.log(`✅ Path "${path}" exists with ${Object.keys(data).length} entries`)
          console.log('Sample data:', Object.keys(data).slice(0, 3))
          
          // Show sample report structure for the main path
          if (path === 'civilian/civilian crime reports') {
            const sampleKeys = Object.keys(data).slice(0, 2)
            sampleKeys.forEach(key => {
              const report = data[key]
              console.log(`📋 Sample report ${key}:`, {
                type: report.type,
                status: report.status,
                timestamp: report.timestamp,
                createdAt: report.createdAt,
                date: report.date
              })
            })
          }
        } else {
          console.log(`❌ Path "${path}" does not exist`)
        }
      }
    } catch (error) {
      console.error('Error debugging database:', error)
    }
  }

  // Get all notifications
  async getAllNotifications() {
    try {
      const [reportsSnapshot, incidentsSnapshot, emergencySnapshot, sosSnapshot, dispatchSnapshot, policeSnapshot] = await Promise.all([
        get(ref(realtimeDb, 'civilian/civilian crime reports')), // Use same path as Dashboard
        get(ref(realtimeDb, 'incidents')),
        get(ref(realtimeDb, 'emergency_reports')),
        get(ref(realtimeDb, 'sos_alerts')),
        get(ref(realtimeDb, 'police_dispatch')),
        get(ref(realtimeDb, 'police/police account'))
      ])

      const notifications = []

      // Process crime reports
      if (reportsSnapshot.exists()) {
        const reports = reportsSnapshot.val()
        Object.values(reports).forEach(report => {
          const reportTime = new Date(report.timestamp || report.createdAt)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          
          if (reportTime > oneHourAgo) {
            notifications.push({
              id: `report_${report.id || Date.now()}`,
              type: 'crime_report',
              title: 'New Crime Report',
              message: `${report.crimeType || 'Incident'} reported at ${report.location || 'Unknown location'}`,
              timestamp: report.timestamp || report.createdAt,
              priority: 'high',
              data: report
            })
          }
        })
      }

      // Process SOS alerts
      if (sosSnapshot.exists()) {
        const alerts = sosSnapshot.val()
        Object.values(alerts).forEach(alert => {
          if (alert.status === 'active' || alert.status === 'pending') {
            notifications.push({
              id: `sos_${alert.id || Date.now()}`,
              type: 'sos_alert',
              title: 'SOS Alert',
              message: `Emergency alert from ${alert.reporterName || 'Unknown'} at ${alert.location || 'Unknown location'}`,
              timestamp: alert.timestamp || alert.createdAt,
              priority: 'critical',
              data: alert
            })
          }
        })
      }

      // Process police dispatch
      if (dispatchSnapshot.exists()) {
        const dispatches = dispatchSnapshot.val()
        Object.values(dispatches).forEach(dispatch => {
          if (dispatch.status === 'dispatched' || dispatch.status === 'en_route') {
            notifications.push({
              id: `dispatch_${dispatch.id || Date.now()}`,
              type: 'police_dispatch',
              title: 'Police Dispatch',
              message: `Officer ${dispatch.officerName || 'Unknown'} dispatched to ${dispatch.location || 'Unknown location'}`,
              timestamp: dispatch.timestamp || dispatch.createdAt,
              priority: 'high',
              data: dispatch
            })
          }
        })
      }

      // Process police availability
      if (policeSnapshot.exists()) {
        const policeAccounts = policeSnapshot.val()
        const availableOfficers = Object.values(policeAccounts).filter(officer => 
          officer.isActive && officer.availability === 'available'
        )
        
        if (availableOfficers.length > 0) {
          notifications.push({
            id: `availability_${Date.now()}`,
            type: 'police_availability',
            title: 'Officers Available',
            message: `${availableOfficers.length} police officers are currently available`,
            timestamp: new Date().toISOString(),
            priority: 'info',
            data: { availableOfficers }
          })
        }
      }

      // Sort by timestamp (newest first)
      return notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return []
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const readRef = ref(realtimeDb, `admin/read_notifications/${notificationId}`)
      await set(readRef, {
        readAt: new Date().toISOString(),
        readBy: 'admin'
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Get unread count
  async getUnreadCount() {
    try {
      const notifications = await this.getAllNotifications()
      const readRef = ref(realtimeDb, 'admin/read_notifications')
      const readSnapshot = await get(readRef)
      
      let readNotifications = []
      if (readSnapshot.exists()) {
        readNotifications = Object.keys(readSnapshot.val())
      }
      
      return notifications.filter(notification => 
        !readNotifications.includes(notification.id)
      ).length
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  // Trigger notifications for existing reports (for testing)
  async triggerNotificationsForExistingReports() {
    try {
      console.log('🔔 Triggering notifications for existing reports...')
      
      const reportsRef = ref(realtimeDb, 'civilian/civilian crime reports')
      const snapshot = await get(reportsRef)
      
      if (snapshot.exists()) {
        const reports = snapshot.val()
        const allReports = Object.entries(reports).map(([id, report]) => ({
          id,
          ...report,
          timestamp: report.timestamp || report.createdAt || report.date
        }))
        
        // Get reports from the last hour
        const recentReports = allReports.filter(report => {
          const reportTime = new Date(report.timestamp)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          return reportTime > oneHourAgo
        })
        
        console.log('🔔 Found', recentReports.length, 'recent reports to notify about')
        
        if (recentReports.length > 0) {
          // Send individual notification for each report
          recentReports.forEach((report, index) => {
            setTimeout(() => {
              this.notifyCallbacks({
                type: 'crime_report',
                data: [report], // Single report
                count: 1,
                isNew: true,
                reportId: report.id,
                reportType: report.type,
                reportDescription: report.description,
                reportLocation: report.location?.address || report.location,
                reportStatus: report.status
              })
            }, index * 1000) // 1 second delay between each notification
          })
        }
      }
    } catch (error) {
      console.error('Error triggering notifications for existing reports:', error)
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService()

export default notificationService
