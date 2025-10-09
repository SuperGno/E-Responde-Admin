import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import './Login.css'

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const allowedAdminEmail = 'admin@e-responde.com'

    try {
      if (email.toLowerCase() !== allowedAdminEmail.toLowerCase()) {
        setError('Access denied. Only authorized administrators can access this system.')
        setLoading(false)
        return
      }

      // Validate password strength for demo purposes
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.')
        setLoading(false)
        return
      }

      await signInWithEmailAndPassword(auth, email, password)
      onLoginSuccess()
    } catch (err) {
      console.error('Login error:', err)
      if (err.code === 'auth/user-not-found') {
        setError('Admin account not found. Please contact system administrator.')
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.')
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.')
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
        
      </div>
    </div>
  )
}

export default Login
