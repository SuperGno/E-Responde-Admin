import { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate, useLocation } from 'react-router-dom'
import { realtimeDb } from '../firebase'
import { ref, set, get } from 'firebase/database'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth'
import './Login.css'

function Login({ onLoginSuccess }) {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  const authContext = useAuth()

  // Simple password hashing using built-in Web Crypto API
  const hashPassword = async (password) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError('')
    setCreateSuccess('')

    try {
      // Validation
      if (!createEmail || !createPassword || !confirmPassword) {
        setCreateError('All fields are required.')
        setCreateLoading(false)
        return
      }

      if (createPassword !== confirmPassword) {
        setCreateError('Passwords do not match.')
        setCreateLoading(false)
        return
      }

      if (createPassword.length < 6) {
        setCreateError('Password must be at least 6 characters long.')
        setCreateLoading(false)
        return
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(createEmail)) {
        setCreateError('Please enter a valid email address.')
        setCreateLoading(false)
        return
      }

      // Step 1: Create Firebase Authentication user
      const auth = getAuth()
      const userCredential = await createUserWithEmailAndPassword(auth, createEmail, createPassword)
      const user = userCredential.user
      
      console.log('Firebase Auth user created:', user.uid)

      // Step 2: Update the user's display name
      await updateProfile(user, {
        displayName: 'Admin Dashboard'
      })

      // Step 3: Hash the password for storage
      const hashedPassword = await hashPassword(createPassword)

      // Step 4: Create account data for Realtime Database
      const accountData = {
        userId: user.uid, // Use Firebase Auth UID as userId
        email: createEmail,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        role: 'admin',
        authUid: user.uid, // Link to Firebase Auth user
        displayName: 'Admin Dashboard'
      }

      // Step 5: Save to Firebase Realtime Database under admin_dashboard_account
      const accountRef = ref(realtimeDb, 'admin_dashboard_account')
      await set(accountRef, accountData)

      console.log('Admin account created in Realtime Database')

      setCreateSuccess('Account created successfully! You can now login with your credentials.')
      
      // Clear form
      setCreateEmail('')
      setCreatePassword('')
      setConfirmPassword('')

      // Switch back to login after 2 seconds
      setTimeout(() => {
        setIsCreatingAccount(false)
        setCreateSuccess('')
      }, 2000)

    } catch (err) {
      console.error('Account creation error:', err)
      
      // More specific error messages
      if (err.code === 'auth/email-already-in-use') {
        setCreateError('This email is already registered. Please use a different email or try logging in.')
      } else if (err.code === 'auth/weak-password') {
        setCreateError('Password is too weak. Please choose a stronger password.')
      } else if (err.code === 'auth/invalid-email') {
        setCreateError('Invalid email address. Please enter a valid email.')
      } else if (err.code === 'PERMISSION_DENIED') {
        setCreateError('Permission denied. Please check your Firebase rules.')
      } else if (err.code === 'UNAVAILABLE') {
        setCreateError('Firebase service is unavailable. Please try again later.')
      } else if (err.message.includes('network')) {
        setCreateError('Network error. Please check your internet connection.')
      } else if (err.message.includes('quota')) {
        setCreateError('Database quota exceeded. Please contact administrator.')
      } else {
        setCreateError(`Failed to create account: ${err.message || 'Unknown error'}`)
      }
    } finally {
      setCreateLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate input
      if (!email || !password) {
        setError('Please enter both email and password.')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long.')
        setLoading(false)
        return
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address.')
        setLoading(false)
        return
      }

      // Use Firebase Authentication for login
      const auth = getAuth()
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      console.log('Admin logged in:', user.uid)

      // Verify this is an admin account by checking Realtime Database
      const adminRef = ref(realtimeDb, 'admin_dashboard_account')
      const snapshot = await get(adminRef)
      
      if (!snapshot.exists()) {
        setError('Admin account not found in database.')
        setLoading(false)
        return
      }

      const adminData = snapshot.val()

      // Check if the logged-in user is the admin
      if (adminData.userId !== user.uid) {
        setError('This account is not authorized as an admin.')
        setLoading(false)
        return
      }

      // Inform parent if provided
      if (typeof onLoginSuccess === 'function') {
        try { onLoginSuccess() } catch {}
      }
      // Navigate to protected area; AuthProvider will provide user state
      navigate(from, { replace: true })

    } catch (err) {
      console.error('Login error:', err)
      
      // Firebase Authentication error codes
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.')
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.')
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.')
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.')
      } else if (err.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firebase rules.')
      } else if (err.code === 'UNAVAILABLE') {
        setError('Firebase service is unavailable. Please try again later.')
      } else if (err.message.includes('network')) {
        setError('Network error. Please check your internet connection.')
      } else {
        setError(`Login failed: ${err.message || 'Unknown error'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem'}}>
      <div className="login-card" style={{background: 'white', padding: '3rem 2.5rem', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)', width: '100%', maxWidth: '420px', position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #667eea, #764ba2)'}}></div>
        <div style={{textAlign: 'center', marginBottom: '2rem'}}>
          <div style={{width: '60px', height: '60px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '50%', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          </div>
          <h1 style={{margin: '0 0 0.5rem 0', color: '#f5f5dc', fontSize: '1.75rem', fontWeight: '700'}}>E-Responde Admin</h1>
          <p style={{margin: 0, color: '#64748b', fontSize: '0.95rem'}}>Emergency Response Management System</p>
        </div>

        {/* Toggle between Login and Create Account */}
        <div style={{display: 'flex', marginBottom: '2rem', background: '#f8fafc', borderRadius: '8px', padding: '4px'}}>
          <button
            type="button"
            onClick={() => setIsCreatingAccount(false)}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              borderRadius: '6px',
              background: !isCreatingAccount ? 'white' : 'transparent',
              color: !isCreatingAccount ? '#667eea' : '#64748b',
              fontWeight: !isCreatingAccount ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: !isCreatingAccount ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingAccount(true)}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              borderRadius: '6px',
              background: isCreatingAccount ? 'white' : 'transparent',
              color: isCreatingAccount ? '#667eea' : '#64748b',
              fontWeight: isCreatingAccount ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isCreatingAccount ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Create Account
          </button>
        </div>
        
        {!isCreatingAccount ? (
          // Login Form
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter admin email"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? (
                <>
                  <div style={{width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></div>
                  Logging in...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '0.5rem'}}>
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10,17 15,12 10,7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                  Login
                </>
              )}
            </button>
          </form>
        ) : (
          // Create Account Form
          <form onSubmit={handleCreateAccount}>
            <div className="form-group">
              <label htmlFor="createEmail">Email:</label>
              <input
                type="email"
                id="createEmail"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                placeholder="Enter email address"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="createPassword">Password:</label>
              <input
                type="password"
                id="createPassword"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                placeholder="Enter password (min 6 characters)"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password:</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your password"
              />
            </div>
            
            {createError && <div className="error-message">{createError}</div>}
            {createSuccess && <div style={{color: '#10b981', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px'}}>{createSuccess}</div>}
            
            <button type="submit" disabled={createLoading} className="login-btn">
              {createLoading ? (
                <>
                  <div style={{width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '0.5rem'}}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                  Create Account
                </>
              )}
            </button>
          </form>
        )}

        {/* Dev debug panel to display resolved auth & claims */}
        {process.env.NODE_ENV !== 'production' && (
          <div style={{ marginTop: '1rem', background: '#0f1724', color: '#cbd5e1', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>Debug</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
{JSON.stringify({ user: authContext?.user ? { uid: authContext.user.uid, email: authContext.user.email } : null, claims: authContext?.claims, loading: authContext?.loading }, null, 2)}
            </pre>
            <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>If <code>claims.role</code> is missing or not in <code>[superadmin, dispatcher, analyst, admin]</code> you will be redirected to <code>/unauthorized</code>.</p>
          </div>
        )}
        
      </div>
    </div>
  )
}

export default Login
