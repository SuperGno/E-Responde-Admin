import { NavLink, useNavigate } from 'react-router-dom'
import { getAuth, signOut } from 'firebase/auth'

function LinkItem({ to, label, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => (
      `nav-item ${isActive ? 'active' : ''}`
    )}>
      {({ isActive }) => (
        <>
          <span className="nav-icon">{children}</span>
          <span className="nav-label">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const auth = getAuth()
      await signOut(auth)
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
            <div className="sidebar-brand">
              <div className="brand-logo">
                <img 
                  src="/Admin-E-Responde.png" 
                  alt="E-Responde Logo" 
                  style={{width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%'}}
                />
              </div>
              <div className="brand-text">
                <h2>E-Responde</h2>
              </div>
            </div>
      </div>
      
      <nav className="sidebar-nav">
        <LinkItem to="/" label="Dashboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </LinkItem>
        <LinkItem to="/analytics" label="Analytics">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"/>
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        </LinkItem>
        <LinkItem to="/heatmap" label="Crime Heatmap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </LinkItem>
        <LinkItem to="/dispatch" label="Dispatch Center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </LinkItem>
        <LinkItem to="/accounts" label="Account Management">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </LinkItem>
      </nav>
      
      <div className="sidebar-footer">
        <button 
          onClick={handleLogout}
          className="logout-btn"
          style={{
            background: '#ef4444',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </aside>
  )
}


