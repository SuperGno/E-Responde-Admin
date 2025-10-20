import { useEffect, useState } from 'react'
import { useAuth } from '../providers/AuthProvider'

export default function Header() {
  const { user, claims } = useAuth()
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })
  const [notifCount] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <header className="app-header">
      <div className="header-content">
            <div className="header-left">
              <div className="page-title">
                <h1>E-Responde Dashboard</h1>
              </div>
            </div>
        
        <div className="header-right">
          <div className="header-controls">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
              className="theme-toggle"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            
            <div className="notification-btn">
              <button className="notification-button" title="Notifications">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifCount > 0 && (
                  <span className="notification-badge">{notifCount}</span>
                )}
              </button>
            </div>
            
                <div className="user-info">
                  <div className="user-avatar">
                    <img 
                      src="/Admin-E-Responde.png" 
                      alt="E-Responde Logo" 
                      style={{width: '32px', height: '32px', objectFit: 'cover', borderRadius: '50%'}}
                    />
                  </div>
                  <div className="user-details">
                    <div className="user-name">{claims?.role || 'Administrator'}</div>
                    <div className="user-email">{user?.email || 'admin@e-responde.ph'}</div>
                  </div>
                </div>
          </div>
        </div>
      </div>
    </header>
  )
}


