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
    verifiedContacts: 0,
    averageContactsPerUser: 0
  })
  const [selectedContact, setSelectedContact] = useState(null)
  const [showContactDetails, setShowContactDetails] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterUser, setFilterUser] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [newContact, setNewContact] = useState({
    userId: '',
    name: '',
    phoneNumber: '',
    relationship: '',
    isPrimary: false,
    isVerified: false,
    notes: ''
  })

  useEffect(() => {
    fetchEmergencyContacts()
    setupRealTimeListeners()
    
    return () => {
      // Cleanup listeners
      const contactsRef = ref(realtimeDb, 'emergency_contacts')
      off(contactsRef, 'value')
    }
  }, [])

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
    const verifiedContacts = contactsList.filter(contact => 
      contact.isVerified === true
    ).length
    
    // Calculate average contacts per user
    const uniqueUsers = new Set(contactsList.map(contact => contact.userId))
    const averageContactsPerUser = uniqueUsers.size > 0 
      ? Math.round(totalContacts / uniqueUsers.size * 10) / 10
      : 0
    
    setContactStats({
      totalContacts,
      activeContacts,
      verifiedContacts,
      averageContactsPerUser
    })
  }

  const handleCreateContact = async () => {
    if (!newContact.userId || !newContact.name || !newContact.phoneNumber) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const contactData = {
        name: newContact.name,
        phoneNumber: newContact.phoneNumber,
        relationship: newContact.relationship,
        isPrimary: newContact.isPrimary,
        isVerified: newContact.isVerified,
        notes: newContact.notes,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isActive: true,
        createdBy: 'admin@e-responde.com'
      }

      const contactRef = ref(realtimeDb, `emergency_contacts/${newContact.userId}`)
      const newContactRef = push(contactRef)
      await update(newContactRef, contactData)

      // Reset form
      setNewContact({
        userId: '',
        name: '',
        phoneNumber: '',
        relationship: '',
        isPrimary: false,
        isVerified: false,
        notes: ''
      })
      
      setShowCreateModal(false)
      alert('Emergency contact created successfully!')
      
    } catch (err) {
      console.error('Error creating emergency contact:', err)
      alert('Failed to create emergency contact. Please try again.')
    }
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

  const getStatusColor = (isActive, isVerified) => {
    if (!isActive) return '#6b7280'
    if (isVerified) return '#10b981'
    return '#f59e0b'
  }

  const getStatusText = (isActive, isVerified) => {
    if (!isActive) return 'Inactive'
    if (isVerified) return 'Verified'
    return 'Pending'
  }

  const filteredContacts = emergencyContacts.filter(contact => {
    const userMatch = filterUser === 'all' || contact.userId === filterUser
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'active' && contact.isActive) ||
      (filterStatus === 'inactive' && !contact.isActive) ||
      (filterStatus === 'verified' && contact.isVerified) ||
      (filterStatus === 'pending' && contact.isActive && !contact.isVerified)
    
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
        <p>Manage and monitor emergency contacts for all users</p>
        
        <div className="header-actions">
          <button 
            className="create-contact-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Contact
          </button>
        </div>
      </div>

      {/* Contact Statistics */}
      <div className="contact-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Total Contacts</h3>
            <p className="stat-number">{contactStats.totalContacts}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Active Contacts</h3>
            <p className="stat-number">{contactStats.activeContacts}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🔒</div>
          <div className="stat-content">
            <h3>Verified</h3>
            <p className="stat-number">{contactStats.verifiedContacts}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Avg per User</h3>
            <p className="stat-number">{contactStats.averageContactsPerUser}</p>
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
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
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
                      {contact.userId.substring(0, 8)}...
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
                        style={{ backgroundColor: getStatusColor(contact.isActive, contact.isVerified) }}
                      >
                        {getStatusText(contact.isActive, contact.isVerified)}
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
                        className="edit-btn"
                        onClick={() => handleUpdateContact(contact.id, contact.userId, {
                          isVerified: !contact.isVerified
                        })}
                      >
                        {contact.isVerified ? 'Unverify' : 'Verify'}
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

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content create-modal">
            <div className="modal-header">
              <h3>Add Emergency Contact</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>User ID *</label>
                <input
                  type="text"
                  value={newContact.userId}
                  onChange={(e) => setNewContact({...newContact, userId: e.target.value})}
                  placeholder="Enter user ID"
                  required
                />
              </div>

              <div className="form-group">
                <label>Contact Name *</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  placeholder="Enter contact name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={newContact.phoneNumber}
                  onChange={(e) => setNewContact({...newContact, phoneNumber: e.target.value})}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Relationship</label>
                  <select
                    value={newContact.relationship}
                    onChange={(e) => setNewContact({...newContact, relationship: e.target.value})}
                  >
                    <option value="family">Family</option>
                    <option value="friend">Friend</option>
                    <option value="colleague">Colleague</option>
                    <option value="neighbor">Neighbor</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text"
                    value={newContact.notes}
                    onChange={(e) => setNewContact({...newContact, notes: e.target.value})}
                    placeholder="Additional notes"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newContact.isPrimary}
                    onChange={(e) => setNewContact({...newContact, isPrimary: e.target.checked})}
                  />
                  Primary Contact
                </label>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newContact.isVerified}
                    onChange={(e) => setNewContact({...newContact, isVerified: e.target.checked})}
                  />
                  Verified Contact
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="create-btn" onClick={handleCreateContact}>
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <strong>Contact ID:</strong> {selectedContact.id}
                </div>
                <div className="detail-item">
                  <strong>User ID:</strong> {selectedContact.userId}
                </div>
                <div className="detail-item">
                  <strong>Name:</strong> {selectedContact.name}
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
                  <strong>Status:</strong> 
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedContact.isActive, selectedContact.isVerified) }}
                  >
                    {getStatusText(selectedContact.isActive, selectedContact.isVerified)}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Primary Contact:</strong> {selectedContact.isPrimary ? 'Yes' : 'No'}
                </div>
                <div className="detail-item">
                  <strong>Verified:</strong> {selectedContact.isVerified ? 'Yes' : 'No'}
                </div>
                <div className="detail-item">
                  <strong>Notes:</strong> {selectedContact.notes || 'None'}
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
              <button 
                className="edit-btn"
                onClick={() => {
                  handleUpdateContact(selectedContact.id, selectedContact.userId, {
                    isVerified: !selectedContact.isVerified
                  })
                  handleCloseContactDetails()
                }}
              >
                {selectedContact.isVerified ? 'Unverify' : 'Verify'}
              </button>
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
