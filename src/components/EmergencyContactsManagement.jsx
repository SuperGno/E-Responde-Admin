import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, onValue, off, update, push, remove } from 'firebase/database'
import './EmergencyContactsManagement.css'

function EmergencyContactsManagement() {
  const [emergencyContacts, setEmergencyContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [contactStats, setContactStats] = useState({
    totalContacts: 0,
    activeContacts: 0,
    averageContactsPerUser: 0
  })
  const [selectedContact, setSelectedContact] = useState(null)
  const [showContactDetails, setShowContactDetails] = useState(false)
  const [filterUser, setFilterUser] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [userNames, setUserNames] = useState({}) // Store user names by userId

  useEffect(() => {
    fetchUserNames()
    fetchEmergencyContacts()
    setupRealTimeListeners()
    
    return () => {
      // Cleanup listeners
      const contactsRef = ref(realtimeDb, 'emergency_contacts')
      off(contactsRef, 'value')
    }
  }, [])

  const fetchUserNames = async () => {
    try {
      const civilianRef = ref(realtimeDb, 'civilian/civilian account')
      const snapshot = await get(civilianRef)
      
      if (snapshot.exists()) {
        const civilianData = snapshot.val()
        const namesMap = {}
        
        Object.keys(civilianData).forEach(userId => {
          const userData = civilianData[userId]
          if (userData.firstName) {
            const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
            namesMap[userId] = fullName || userData.firstName
          }
        })
        
        setUserNames(namesMap)
      }
    } catch (err) {
      console.error('Error fetching user names:', err)
    }
  }

  const fetchEmergencyContacts = async () => {
    try {
      setLoading(true)
      setError('')
      
      const contactsRef = ref(realtimeDb, 'emergency_contacts')
      const snapshot = await get(contactsRef)
      
      const contactsList = []
      if (snapshot.exists()) {
        const contactsData = snapshot.val()
        
        Object.keys(contactsData).forEach(userId => {
          const userContacts = contactsData[userId]
          Object.keys(userContacts).forEach(contactId => {
            const contact = userContacts[contactId]
            contactsList.push({
              id: contactId,
              userId: userId,
              ...contact,
              createdAt: new Date(contact.createdAt || contact.timestamp),
              lastUpdated: new Date(contact.lastUpdated || contact.updatedAt || contact.createdAt)
            })
          })
        })
      }
      
      // Sort by creation date (newest first)
      contactsList.sort((a, b) => b.createdAt - a.createdAt)
      setEmergencyContacts(contactsList)
      
      // Calculate stats
      calculateContactStats(contactsList)
      
    } catch (err) {
      console.error('Error fetching emergency contacts:', err)
      setError('Failed to load emergency contacts data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const setupRealTimeListeners = () => {
    const contactsRef = ref(realtimeDb, 'emergency_contacts')
    
    onValue(contactsRef, (snapshot) => {
      if (snapshot.exists()) {
        const contactsData = snapshot.val()
        const contactsList = []
        
        Object.keys(contactsData).forEach(userId => {
          const userContacts = contactsData[userId]
          Object.keys(userContacts).forEach(contactId => {
            const contact = userContacts[contactId]
            contactsList.push({
              id: contactId,
              userId: userId,
              ...contact,
              createdAt: new Date(contact.createdAt || contact.timestamp),
              lastUpdated: new Date(contact.lastUpdated || contact.updatedAt || contact.createdAt)
            })
          })
        })
        
        contactsList.sort((a, b) => b.createdAt - a.createdAt)
        setEmergencyContacts(contactsList)
        calculateContactStats(contactsList)
      }
    })
  }

  const calculateContactStats = (contactsList) => {
    const totalContacts = contactsList.length
    const activeContacts = contactsList.filter(contact => 
      contact.isActive !== false
    ).length
    
    // Calculate average contacts per user
    const uniqueUsers = new Set(contactsList.map(contact => contact.userId))
    const averageContactsPerUser = uniqueUsers.size > 0 
      ? Math.round(totalContacts / uniqueUsers.size * 10) / 10
      : 0
    
    setContactStats({
      totalContacts,
      activeContacts,
      averageContactsPerUser
    })
  }


  const handleUpdateContact = async (contactId, userId, updates) => {
    try {
      const contactRef = ref(realtimeDb, `emergency_contacts/${userId}/${contactId}`)
      await update(contactRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      })
      
      alert('Emergency contact updated successfully!')
    } catch (err) {
      console.error('Error updating emergency contact:', err)
      alert('Failed to update emergency contact. Please try again.')
    }
  }

  const handleDeleteContact = async (contactId, userId) => {
    if (!confirm('Are you sure you want to delete this emergency contact?')) {
      return
    }

    try {
      const contactRef = ref(realtimeDb, `emergency_contacts/${userId}/${contactId}`)
      await remove(contactRef)
      
      alert('Emergency contact deleted successfully')
    } catch (err) {
      console.error('Error deleting emergency contact:', err)
      alert('Failed to delete emergency contact. Please try again.')
    }
  }

  const handleViewContactDetails = (contact) => {
    setSelectedContact(contact)
    setShowContactDetails(true)
  }

  const handleCloseContactDetails = () => {
    setSelectedContact(null)
    setShowContactDetails(false)
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

  const getRelationshipColor = (relationship) => {
    switch (relationship?.toLowerCase()) {
      case 'family': return '#ef4444'
      case 'friend': return '#3b82f6'
      case 'colleague': return '#10b981'
      case 'neighbor': return '#f59e0b'
      case 'other': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusColor = (isActive) => {
    if (!isActive) return '#6b7280'
    return '#10b981'
  }

  const getStatusText = (isActive) => {
    if (!isActive) return 'Inactive'
    return 'Active'
  }

  const filteredContacts = emergencyContacts.filter(contact => {
    const userMatch = filterUser === 'all' || contact.userId === filterUser
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'active' && contact.isActive) ||
      (filterStatus === 'inactive' && !contact.isActive)
    
    return userMatch && statusMatch
  })

  if (loading) {
    return (
      <div className="emergency-contacts-management-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading emergency contacts management...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="emergency-contacts-management-container">
      <div className="contacts-header">
        <h1>Emergency Contacts Management</h1>
      </div>

      {/* Contact Statistics */}
      <div className="contact-stats">
        <div className="stat-card">
          <div className="stat-value">{contactStats.totalContacts}</div>
          <div className="stat-title">TOTAL CONTACTS</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{contactStats.activeContacts}</div>
          <div className="stat-title">ACTIVE CONTACTS</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{contactStats.averageContactsPerUser}</div>
          <div className="stat-title">AVG PER USER</div>
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
        
        <div className="filter-group">
          <label>Status Filter:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        
        <button onClick={fetchEmergencyContacts} className="refresh-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23,4 23,10 17,10"></polyline>
            <polyline points="1,20 1,14 7,14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      {/* Contacts Table */}
      <div className="contacts-section">
        <h2>Emergency Contacts</h2>
        {filteredContacts.length === 0 ? (
          <div className="no-contacts">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            <h3>No Emergency Contacts Found</h3>
            <p>No emergency contacts match your current filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Relationship</th>
                  <th>Status</th>
                  <th>Primary</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact, index) => (
                  <tr key={contact.id}>
                    <td className="contact-number">{index + 1}</td>
                    <td className="contact-user">
                      {userNames[contact.userId] || contact.userId.substring(0, 8) + '...'}
                    </td>
                    <td className="contact-name">
                      <div className="name-text">{contact.name}</div>
                      {contact.notes && (
                        <div className="notes-preview">{contact.notes.substring(0, 30)}...</div>
                      )}
                    </td>
                    <td className="contact-phone">
                      <a href={`tel:${contact.phoneNumber}`} className="phone-link">
                        {contact.phoneNumber}
                      </a>
                    </td>
                    <td className="contact-relationship">
                      <span 
                        className="relationship-badge"
                        style={{ backgroundColor: getRelationshipColor(contact.relationship) }}
                      >
                        {contact.relationship || 'Other'}
                      </span>
                    </td>
                    <td className="contact-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(contact.isActive) }}
                      >
                        {getStatusText(contact.isActive)}
                      </span>
                    </td>
                    <td className="contact-primary">
                      {contact.isPrimary ? (
                        <span className="primary-indicator">⭐</span>
                      ) : (
                        <span className="secondary-indicator">-</span>
                      )}
                    </td>
                    <td className="contact-created">{formatDate(contact.createdAt)}</td>
                    <td className="contact-actions">
                      <button 
                        className="view-details-btn"
                        onClick={() => handleViewContactDetails(contact)}
                      >
                        View
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteContact(contact.id, contact.userId)}
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


      {/* Contact Details Modal */}
      {showContactDetails && selectedContact && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Emergency Contact Details</h3>
              <button className="modal-close" onClick={handleCloseContactDetails}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="contact-details-grid">
                <div className="detail-item">
                  <strong>User:</strong> {userNames[selectedContact.userId] || selectedContact.userId}
                </div>
                <div className="detail-item">
                  <strong>Primary Contact:</strong> {selectedContact.name}
                </div>
                <div className="detail-item">
                  <strong>Phone:</strong> 
                  <a href={`tel:${selectedContact.phoneNumber}`} className="phone-link">
                    {selectedContact.phoneNumber}
                  </a>
                </div>
                <div className="detail-item">
                  <strong>Relationship:</strong> 
                  <span 
                    className="relationship-badge"
                    style={{ backgroundColor: getRelationshipColor(selectedContact.relationship) }}
                  >
                    {selectedContact.relationship || 'Other'}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Created:</strong> {formatDate(selectedContact.createdAt)}
                </div>
                <div className="detail-item">
                  <strong>Last Updated:</strong> {formatDate(selectedContact.lastUpdated)}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="close-btn" onClick={handleCloseContactDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmergencyContactsManagement
