import { useState } from 'react'
import { realtimeDb } from '../firebase'
import { ref, set, get } from 'firebase/database'
import CryptoJS from 'crypto-js'
import './Login.css'

function Login({ onLoginSuccess }) {
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

  // Hash password using SHA-256
  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString()
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

      // Hash the password
      const hashedPassword = hashPassword(createPassword)

      // Create account data
      const accountData = {
        email: createEmail,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        role: 'admin'
      }

      // Save directly to Firebase Realtime Database under admin_dashboard_account
      const accountRef = ref(realtimeDb, 'admin_dashboard_account')
      await set(accountRef, accountData)

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
      if (err.code === 'PERMISSION_DENIED') {
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

      // Get admin account data from Realtime Database
      const adminRef = ref(realtimeDb, 'admin_dashboard_account')
      const snapshot = await get(adminRef)
      
      if (!snapshot.exists()) {
        setError('No admin accounts found. Please create an account first.')
        setLoading(false)
        return
      }

      const adminData = snapshot.val()

      // Check if email matches
      if (adminData.email.toLowerCase() !== email.toLowerCase()) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }

      // Hash the provided password and compare with stored hash
      const hashedPassword = hashPassword(password)

      if (adminData.password !== hashedPassword) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }
      onLoginSuccess()

    } catch (err) {
      console.error('Login error:', err)
      
      if (err.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firebase rules.')
      } else if (err.code === 'UNAVAILABLE') {
        setError('Firebase service is unavailable. Please try again later.')
      } else if (err.message.includes('network')) {
        setError('Network error. Please check your internet connection.')
      } else {
        setError('Login failed. Please check your credentials and try again.')
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
        
      </div>
    </div>
  )
}

export default Login
