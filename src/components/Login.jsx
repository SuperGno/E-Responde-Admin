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
      
      console.log('User logged in:', user.uid)

      // Check all possible account types to determine user role
      let accountType = null
      let accountData = null
      
      try {
        // Check for admin account first
        const adminSnap = await get(ref(realtimeDb, 'admin_dashboard_account'))
        if (adminSnap.exists()) {
          const adminData = adminSnap.val()
          if (adminData.userId === user.uid || adminData.authUid === user.uid) {
            accountType = 'admin'
            accountData = adminData
            console.log('Admin account verified for user', user.uid)
          }
        }
        
        // If not admin, check for civilian account
        if (!accountType) {
          const civilianSnap = await get(ref(realtimeDb, `civilian/civilian account/${user.uid}`))
          if (civilianSnap.exists()) {
            accountType = 'civilian'
            accountData = civilianSnap.val()
            console.log('Civilian account verified for user', user.uid)
          }
        }
        
        // If not civilian, check for police account
        if (!accountType) {
          const policeSnap = await get(ref(realtimeDb, `police/police account/${user.uid}`))
          if (policeSnap.exists()) {
            accountType = 'police'
            accountData = policeSnap.val()
            console.log('Police account verified for user', user.uid)
          }
        }
        
        // If no account found in any category
        if (!accountType) {
          setError('Account not found. Please ensure you have a valid account (Admin, Civilian, or Police).')
          setLoading(false)
          return
        }
        
        console.log('Login successful for', accountType, 'account:', user.uid)
        console.log('Account data:', accountData)
        
        // Store account type in localStorage for debugging
        localStorage.setItem('userAccountType', accountType)
        localStorage.setItem('userRole', accountData?.role || accountType)
        
      } catch (error) {
        console.error('Error verifying account:', error)
        setError('Error verifying account. Please try again.')
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
    <div className="login-container">
      <div className="login-card">
        <div style={{textAlign: 'center', marginBottom: '2.5rem'}}>
          <div style={{width: '80px', height: '80px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <img 
              src="/Admin-E-Responde.png" 
              alt="E-Responde Logo" 
              style={{width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%'}}
            />
          </div>
          <h1>E-Responde Admin</h1>
        </div>
        
        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
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
            <label htmlFor="password">Password</label>
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
          
          <button 
            type="submit" 
            disabled={loading} 
            className="login-btn"
          >
            {loading ? (
              <>
                <div style={{width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                Signing In...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10,17 15,12 10,7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Access Dashboard
              </>
            )}
          </button>
        </form>
        
      </div>
    </div>
  )
}

export default Login
