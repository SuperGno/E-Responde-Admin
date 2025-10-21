import { useState, useEffect } from 'react'
import { realtimeDb } from '../firebase'
import { ref, get, update, remove } from 'firebase/database'
import './UserAccountManagement.css'

function UserAccountManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalUsers, setTotalUsers] = useState(0)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Fetch users from Firebase Realtime Database - civilian/civilian account
      const civilianRef = ref(realtimeDb, 'civilian/civilian account')
      const snapshot = await get(civilianRef)
      
      if (snapshot.exists()) {
        const civilianData = snapshot.val()
        const userList = []
        
        // Convert the data to an array of users
        Object.keys(civilianData).forEach(userId => {
          const userData = civilianData[userId]
          if (userData.email && userData.firstName) {
            userList.push({
              id: userId,
              firstName: userData.firstName,
              email: userData.email,
              createdAt: userData.createdAt || userData.registeredAt || 'Unknown',
              isSuspended: userData.isSuspended || false,
              suspendedAt: userData.suspendedAt || null,
              suspendedBy: userData.suspendedBy || null,
              lastSignIn: userData.lastSignIn || userData.createdAt || 'Unknown'
            })
          }
        })
        
        setUsers(userList)
        setTotalUsers(userList.length)
      } else {
        setUsers([])
        setTotalUsers(0)
      }
      
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load user data. Please try again.')
    } finally {
      setLoading(false)
    }
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

  const handleSuspendUser = async (userId, currentStatus) => {
    try {
      setActionLoading(userId)
      setError('')

      // Update user status in Firebase Realtime Database
      const userRef = ref(realtimeDb, `civilian/civilian account/${userId}`)
      
      const updates = {
        isSuspended: !currentStatus,
        suspendedAt: !currentStatus ? new Date().toISOString() : null,
        suspendedBy: !currentStatus ? 'admin@e-responde.com' : null
      }

      await update(userRef, updates)
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { 
              ...user, 
              isSuspended: !currentStatus,
              suspendedAt: updates.suspendedAt,
              suspendedBy: updates.suspendedBy
            }
          : user
      ))

    } catch (err) {
      console.error('Error updating user status:', err)
      setError('Failed to update user status. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCleanupUserData = async (userId, userEmail) => {
    try {
      setActionLoading(userId)
      setError('')

      // Clean up civilian account data
      const civilianRef = ref(realtimeDb, `civilian/civilian account/${userId}`)
      await remove(civilianRef)

      // Clean up any police account data (if exists)
      const policeRef = ref(realtimeDb, `police/police account/${userId}`)
      await remove(policeRef)

      // Clean up phone mappings
      const phoneRef = ref(realtimeDb, `phone_mappings`)
      const phoneSnapshot = await get(phoneRef)
      if (phoneSnapshot.exists()) {
        const phoneData = phoneSnapshot.val()
        for (const [phoneNumber, data] of Object.entries(phoneData)) {
          if (data.userId === userId || data.email === userEmail) {
            await remove(ref(realtimeDb, `phone_mappings/${phoneNumber}`))
          }
        }
      }

      // Clean up emergency contacts
      const emergencyRef = ref(realtimeDb, `emergency_contacts/${userId}`)
      await remove(emergencyRef)

      // Update local state
      setUsers(prev => prev.filter(user => user.id !== userId))
      setTotalUsers(prev => prev - 1)

      console.log(`User data cleaned up successfully for ${userEmail}`)
      alert(`User data cleaned up successfully. ${userEmail} can now sign up again.`)
      
    } catch (err) {
      console.error('Error cleaning up user data:', err)
      setError('Failed to clean up user data. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="user-management-container">
        <div className="user-management-header">
          <h1>User Account Management</h1>
          <p>Manage and monitor registered users</p>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading user data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <h1>Civilian Management</h1>
        <p>Manage and monitor registered civilian users</p>
      </div>

      <div className="user-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </div>
          <div className="stat-content">
            <h3>Total Registered Users</h3>
            <p className="stat-number">{totalUsers}</p>
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

      <div className="users-table-container">
        <div className="table-header">
          <h2>Registered Users</h2>
          <button onClick={fetchUsers} className="refresh-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <div className="no-users">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
            </svg>
            <h3>No Users Found</h3>
            <p>No civilian users have registered yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>First Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Registration Date</th>
                  <th>User ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} className={user.isSuspended ? 'suspended-user' : ''}>
                    <td className="user-number">{index + 1}</td>
                    <td className="user-name">
                      <div className="user-avatar">
                        {user.firstName.charAt(0).toUpperCase()}
                      </div>
                      {user.firstName}
                    </td>
                    <td className="user-email">{user.email}</td>
                    <td className="user-status">
                      <span className={`status-badge ${user.isSuspended ? 'suspended' : 'active'}`}>
                        {user.isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="user-date">{formatDate(user.createdAt)}</td>
                    <td className="user-id">{user.id.substring(0, 8)}...</td>
                    <td className="user-actions">
                      <div className="action-buttons">
                        <button
                          className={`action-btn ${user.isSuspended ? 'unsuspend-btn' : 'suspend-btn'}`}
                          onClick={() => handleSuspendUser(user.id, user.isSuspended)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <div className="action-spinner"></div>
                          ) : (
                            <>
                              {user.isSuspended ? (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4"></path>
                                    <circle cx="12" cy="12" r="10"></circle>
                                  </svg>
                                  Unsuspend
                                </>
                              ) : (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18"></path>
                                    <path d="M6 6l12 12"></path>
                                  </svg>
                                  Suspend
                                </>
                              )}
                            </>
                          )}
                        </button>
                        <button
                          className="action-btn cleanup-btn"
                          onClick={() => {
                            if (confirm(`Are you sure you want to clean up all data for ${user.email}? This will allow them to sign up again.`)) {
                              handleCleanupUserData(user.id, user.email)
                            }
                          }}
                          disabled={actionLoading === user.id}
                          title="Clean up user data to allow re-signup"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                          Cleanup
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default UserAccountManagement
