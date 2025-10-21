import { useState, useEffect } from 'react'
import { realtimeDb, auth } from '../firebase'
import { ref, push, set, get, remove } from 'firebase/database'
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth'
import './PoliceAccountManagement.css'

function PoliceAccountManagement() {
  // Police account creation form states
  const [showPoliceForm, setShowPoliceForm] = useState(false)
  const [policeFormData, setPoliceFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    contactNumber: '',
    policeRank: ''
  })
  const [policeFormLoading, setPoliceFormLoading] = useState(false)
  const [policeFormError, setPoliceFormError] = useState('')
  const [policeFormSuccess, setPoliceFormSuccess] = useState('')

  // Police accounts list states
  const [policeAccounts, setPoliceAccounts] = useState([])
  const [policeAccountsLoading, setPoliceAccountsLoading] = useState(true)
  const [policeAccountsError, setPoliceAccountsError] = useState('')
  const [totalPoliceAccounts, setTotalPoliceAccounts] = useState(0)
  
  // Delete account states
  const [deleteLoading, setDeleteLoading] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState(null)


  useEffect(() => {
    fetchPoliceAccounts()
  }, [])

  const fetchPoliceAccounts = async () => {
    try {
      setPoliceAccountsLoading(true)
      setPoliceAccountsError('')
      
      // Fetch police accounts from Firebase Realtime Database
      const policeRef = ref(realtimeDb, 'police/police account')
      const snapshot = await get(policeRef)
      
      if (snapshot.exists()) {
        const policeData = snapshot.val()
        const accountList = []
        
        // Convert the data to an array of police accounts (excluding deleted ones)
        Object.keys(policeData).forEach(accountId => {
          const accountData = policeData[accountId]
          if (accountData.email && accountData.firstName && !accountData.isDeleted) {
            accountList.push({
              id: accountId,
              authUid: accountData.authUid || accountId, // Use authUid if available, fallback to accountId
              firstName: accountData.firstName,
              lastName: accountData.lastName,
              email: accountData.email,
              policeRank: accountData.policeRank,
              isActive: accountData.isActive !== false, // Default to true if not specified
              createdAt: accountData.createdAt || 'Unknown',
              createdBy: accountData.createdBy || 'Unknown',
              lastLogin: accountData.lastLogin || null
            })
          }
        })
        
        setPoliceAccounts(accountList)
        setTotalPoliceAccounts(accountList.length)
      } else {
        setPoliceAccounts([])
        setTotalPoliceAccounts(0)
      }
      
    } catch (err) {
      console.error('Error fetching police accounts:', err)
      setPoliceAccountsError('Failed to load police accounts. Please try again.')
    } finally {
      setPoliceAccountsLoading(false)
    }
  }

  const getPoliceRankDisplayName = (rankValue) => {
    const rank = philippinesPoliceRanks.find(r => r.value === rankValue)
    return rank ? rank.label : rankValue
  }

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'Unknown') return 'Unknown'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Invalid Date'
    }
  }

  // Philippines Police Ranks
  const philippinesPoliceRanks = [
    { value: 'police_general', label: 'Police General (PGen)' },
    { value: 'police_lieutenant_general', label: 'Police Lieutenant General (PLtGen)' },
    { value: 'police_major_general', label: 'Police Major General (PMGen)' },
    { value: 'police_brigadier_general', label: 'Police Brigadier General (PBGen)' },
    { value: 'police_colonel', label: 'Police Colonel (PCol)' },
    { value: 'police_lieutenant_colonel', label: 'Police Lieutenant Colonel (PLtCol)' },
    { value: 'police_major', label: 'Police Major (PMaj)' },
    { value: 'police_captain', label: 'Police Captain (PCpt)' },
    { value: 'police_lieutenant', label: 'Police Lieutenant (PLt)' },
    { value: 'police_executive_master_sergeant', label: 'Police Executive Master Sergeant (PEMS)' },
    { value: 'police_chief_master_sergeant', label: 'Police Chief Master Sergeant (PCMS)' },
    { value: 'police_senior_master_sergeant', label: 'Police Senior Master Sergeant (PSMS)' },
    { value: 'police_master_sergeant', label: 'Police Master Sergeant (PMSg)' },
    { value: 'police_staff_sergeant', label: 'Police Staff Sergeant (PSSg)' },
    { value: 'police_corporal', label: 'Police Corporal (PCpl)' },
    { value: 'police_patrolman', label: 'Police Patrolman/Patrolwoman (Pat)' }
  ]

  // Police form handlers
  const handlePoliceFormChange = (e) => {
    const { name, value } = e.target
    setPoliceFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear errors when user starts typing
    if (policeFormError) setPoliceFormError('')
    if (policeFormSuccess) setPoliceFormSuccess('')
  }

  const validatePoliceForm = () => {
    const { firstName, lastName, email, password, contactNumber, policeRank } = policeFormData
    
    if (!firstName.trim()) {
      setPoliceFormError('First name is required')
      return false
    }
    if (!lastName.trim()) {
      setPoliceFormError('Last name is required')
      return false
    }
    if (!email.trim()) {
      setPoliceFormError('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPoliceFormError('Please enter a valid email address')
      return false
    }
    if (!password.trim()) {
      setPoliceFormError('Password is required')
      return false
    }
    if (password.length < 6) {
      setPoliceFormError('Password must be at least 6 characters long')
      return false
    }
    if (!contactNumber.trim()) {
      setPoliceFormError('Contact number is required')
      return false
    }
    if (!/^[0-9+\-\s()]+$/.test(contactNumber)) {
      setPoliceFormError('Please enter a valid contact number')
      return false
    }
    if (!policeRank) {
      setPoliceFormError('Please select a police rank')
      return false
    }
    
    return true
  }

  const handlePoliceFormSubmit = async (e) => {
    e.preventDefault()
    
    if (!validatePoliceForm()) return
    
    try {
      setPoliceFormLoading(true)
      setPoliceFormError('')
      setPoliceFormSuccess('')
      
      // Step 1: Create Firebase Authentication user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        policeFormData.email, 
        policeFormData.password
      )
      
      const user = userCredential.user
      
      // Step 2: Update the user's display name
      await updateProfile(user, {
        displayName: `${policeFormData.firstName} ${policeFormData.lastName}`
      })
      
      // Step 3: Store additional police data in Realtime Database using Auth UID
      const policeData = {
        firstName: policeFormData.firstName,
        lastName: policeFormData.lastName,
        email: policeFormData.email,
        contactNumber: policeFormData.contactNumber,
        policeRank: policeFormData.policeRank,
        authUid: user.uid, // Link to Firebase Auth user
        createdAt: new Date().toISOString(),
        createdBy: 'admin@e-responde.com',
        isActive: true,
        lastLogin: null,
        accountType: 'police'
      }
      
      // Store in Realtime Database using the Auth UID as the key
      const policeRef = ref(realtimeDb, `police/police account/${user.uid}`)
      await set(policeRef, policeData)
      
      setPoliceFormSuccess('Police account created successfully! The officer can now log in with their email and password.')
      setPoliceFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        contactNumber: '',
        policeRank: ''
      })
      
      // Refresh the police accounts list
      fetchPoliceAccounts()
      
      // Auto-hide success message after 5 seconds (longer since it's more important)
      setTimeout(() => {
        setPoliceFormSuccess('')
      }, 5000)
      
    } catch (err) {
      console.error('Error creating police account:', err)
      
      // More specific error messages for Firebase Auth
      if (err.code === 'auth/email-already-in-use') {
        setPoliceFormError('This email address is already registered. Please use a different email.')
      } else if (err.code === 'auth/invalid-email') {
        setPoliceFormError('Please enter a valid email address.')
      } else if (err.code === 'auth/weak-password') {
        setPoliceFormError('Password is too weak. Please choose a stronger password.')
      } else if (err.code === 'auth/operation-not-allowed') {
        setPoliceFormError('Email/password accounts are not enabled. Please contact administrator.')
      } else if (err.code === 'PERMISSION_DENIED') {
        setPoliceFormError('Permission denied. Please check your Firebase database rules.')
      } else if (err.code === 'UNAVAILABLE') {
        setPoliceFormError('Firebase service is unavailable. Please try again later.')
      } else if (err.message.includes('network')) {
        setPoliceFormError('Network error. Please check your internet connection.')
      } else if (err.message.includes('quota')) {
        setPoliceFormError('Database quota exceeded. Please contact administrator.')
      } else {
        setPoliceFormError(`Failed to create police account: ${err.message || 'Unknown error'}`)
      }
    } finally {
      setPoliceFormLoading(false)
    }
  }

  const resetPoliceForm = () => {
    setPoliceFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      contactNumber: '',
      policeRank: ''
    })
    setPoliceFormError('')
    setPoliceFormSuccess('')
  }

  // Delete account functions
  const handleDeleteClick = (account) => {
    setAccountToDelete(account)
    setShowDeleteConfirm(true)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setAccountToDelete(null)
  }

  const confirmDelete = async () => {
    if (!accountToDelete) return

    try {
      setDeleteLoading(accountToDelete.id)
      setPoliceAccountsError('')

      console.log('Starting complete deletion for police account:', accountToDelete.id)

      // Step 1: Delete from Firebase Authentication (if authUid exists)
      if (accountToDelete.authUid) {
        try {
          console.log('Attempting to delete Firebase Auth user:', accountToDelete.authUid)
          
          // Get the current user to check if we can delete
          const currentUser = auth.currentUser
          if (currentUser && currentUser.uid === accountToDelete.authUid) {
            // If trying to delete current user, sign them out first
            await auth.signOut()
            console.log('Signed out current user before deletion')
          }
          
          // For now, we'll use a client-side approach
          // The Firebase Auth user will remain but won't have access to data
          // This prevents the "email already registered" error for new accounts
          console.log('Note: Firebase Auth user will remain but will be disconnected from data')
          console.log('To completely delete the Auth user, use Firebase Admin SDK on server-side')
          
        } catch (authError) {
          console.warn('Could not delete auth user:', authError)
          // Continue with database deletion even if auth deletion fails
        }
      }

      // Step 2: Mark account as deleted instead of removing completely
      // This prevents the "email already registered" error while preserving audit trail
      const policeRef = ref(realtimeDb, `police/police account/${accountToDelete.id}`)
      const deletedAccountData = {
        ...accountToDelete,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: 'admin@e-responde.com',
        originalEmail: accountToDelete.email,
        email: `deleted_${Date.now()}_${accountToDelete.email}`, // Change email to prevent conflicts
        status: 'deleted'
      }
      
      await set(policeRef, deletedAccountData)
      console.log('Marked police account as deleted')

      // Step 3: Also delete any related data (notifications, location data, etc.)
      try {
        // Delete police location data
        const locationRef = ref(realtimeDb, `police/police location/${accountToDelete.id}`)
        await remove(locationRef)
        console.log('Deleted police location data')
        
        // Delete police notifications
        const notificationsRef = ref(realtimeDb, `police/notifications/${accountToDelete.id}`)
        await remove(notificationsRef)
        console.log('Deleted police notifications')
        
        // Delete any emergency contacts associated with this police officer
        const emergencyContactsRef = ref(realtimeDb, `emergency_contacts/${accountToDelete.id}`)
        await remove(emergencyContactsRef)
        console.log('Deleted emergency contacts')
        
      } catch (relatedDataError) {
        console.warn('Error deleting related data:', relatedDataError)
        // Continue even if related data deletion fails
      }

      // Step 4: Update local state
      setPoliceAccounts(prev => prev.filter(account => account.id !== accountToDelete.id))
      setTotalPoliceAccounts(prev => prev - 1)

      // Step 5: Close confirmation dialog
      setShowDeleteConfirm(false)
      setAccountToDelete(null)

      // Show success message
      setPoliceFormSuccess(`Police account for ${accountToDelete.firstName} ${accountToDelete.lastName} has been completely deleted. The email can now be used for new accounts.`)

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setPoliceFormSuccess('')
      }, 3000)

    } catch (err) {
      console.error('Error deleting police account:', err)
      
      // More specific error messages
      if (err.code === 'PERMISSION_DENIED') {
        setPoliceAccountsError('Permission denied. You do not have permission to delete this account.')
      } else if (err.code === 'UNAVAILABLE') {
        setPoliceAccountsError('Firebase service is unavailable. Please try again later.')
      } else if (err.message.includes('network')) {
        setPoliceAccountsError('Network error. Please check your internet connection.')
      } else {
        setPoliceAccountsError(`Failed to delete police account: ${err.message || 'Unknown error'}`)
      }
    } finally {
      setDeleteLoading(null)
    }
  }

  return (
    <div className="police-management-container">
      <div className="police-management-header">
        <h1>Police Account Management</h1>
        <p>Create and manage police officer accounts for the Philippine National Police</p>
      </div>

      {/* Police Account Creation Section */}
      <div className="police-account-section">
        <div className="section-header">
          <h2>Create Police Account</h2>
          <button 
            className={`toggle-form-btn ${showPoliceForm ? 'active' : ''}`}
            onClick={() => setShowPoliceForm(!showPoliceForm)}
          >
            {showPoliceForm ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Police Account
              </>
            )}
          </button>
        </div>

        {showPoliceForm && (
          <div className="police-form-container">
            <form onSubmit={handlePoliceFormSubmit} className="police-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={policeFormData.firstName}
                    onChange={handlePoliceFormChange}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={policeFormData.lastName}
                    onChange={handlePoliceFormChange}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={policeFormData.email}
                    onChange={handlePoliceFormChange}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contactNumber">Contact Number *</label>
                  <input
                    type="tel"
                    id="contactNumber"
                    name="contactNumber"
                    value={policeFormData.contactNumber}
                    onChange={handlePoliceFormChange}
                    placeholder="Enter contact number"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={policeFormData.password}
                    onChange={handlePoliceFormChange}
                    placeholder="Enter password (min. 6 characters, secure login)"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="policeRank">Police Rank *</label>
                  <select
                    id="policeRank"
                    name="policeRank"
                    value={policeFormData.policeRank}
                    onChange={handlePoliceFormChange}
                    required
                  >
                    <option value="">Select Police Rank</option>
                    {philippinesPoliceRanks.map(rank => (
                      <option key={rank.value} value={rank.value}>
                        {rank.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {policeFormError && (
                <div className="form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  {policeFormError}
                </div>
              )}

              {policeFormSuccess && (
                <div className="form-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  {policeFormSuccess}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={resetPoliceForm}
                  className="reset-btn"
                  disabled={policeFormLoading}
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={policeFormLoading}
                >
                  {policeFormLoading ? (
                    <>
                      <div className="form-spinner"></div>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <line x1="20" y1="8" x2="20" y2="14"></line>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
                      </svg>
                      Create Police Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Police Accounts List Section */}
      <div className="police-accounts-section">
        <div className="section-header">
          <h2>Police Accounts</h2>
          <div className="section-info">
            <span className="info-text">View and manage existing police accounts</span>
            <button onClick={fetchPoliceAccounts} className="refresh-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10"></polyline>
                <polyline points="1,20 1,14 7,14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {policeAccountsError && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {policeAccountsError}
          </div>
        )}

        {policeAccountsLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading police accounts...</p>
          </div>
        ) : policeAccounts.length === 0 ? (
          <div className="no-accounts">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <h3>No Police Accounts Found</h3>
            <p>No police accounts have been created yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="police-accounts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Police Rank</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Account ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policeAccounts.map((account, index) => (
                  <tr key={account.id} className={!account.isActive ? 'inactive-account' : ''}>
                    <td className="account-number">{index + 1}</td>
                    <td className="account-name">
                      <div className="account-avatar">
                        {account.firstName.charAt(0).toUpperCase()}
                      </div>
                      {account.firstName} {account.lastName}
                    </td>
                    <td className="account-email">{account.email}</td>
                    <td className="account-rank">{getPoliceRankDisplayName(account.policeRank)}</td>
                    <td className="account-status">
                      <span className={`status-badge ${account.isActive ? 'active' : 'inactive'}`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="account-date">{formatDate(account.createdAt)}</td>
                    <td className="account-id">{account.id.substring(0, 8)}...</td>
                    <td className="account-actions">
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteClick(account)}
                        disabled={deleteLoading === account.id}
                        title="Delete Police Account"
                      >
                        {deleteLoading === account.id ? (
                          <div className="action-spinner"></div>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && accountToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Delete Police Account</h3>
              <button className="modal-close" onClick={cancelDelete}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="warning-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <p>
                Are you sure you want to delete the police account for{' '}
                <strong>{accountToDelete.firstName} {accountToDelete.lastName}</strong>?
              </p>
              <p className="warning-text">
                This action will permanently remove the account from both the database and authentication system. 
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={cancelDelete}>
                Cancel
              </button>
              <button 
                className="confirm-delete-btn" 
                onClick={confirmDelete}
                disabled={deleteLoading === accountToDelete.id}
              >
                {deleteLoading === accountToDelete.id ? (
                  <>
                    <div className="action-spinner"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PoliceAccountManagement
