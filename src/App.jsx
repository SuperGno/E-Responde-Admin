import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './components/Dashboard.jsx'
import Analytics from './components/Analytics.jsx'
import ViewReport from './components/ViewReport.jsx'
import Heatmap from './components/Heatmap.jsx'
import Dispatch from './components/Dispatch.jsx'
import Login from './components/Login.jsx'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedReportId, setSelectedReportId] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleLoginSuccess = () => {
    // User state will be updated by onAuthStateChanged
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleNavigateToReport = (reportId) => {
    setSelectedReportId(reportId);
    setCurrentPage('view-report');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigateToReport={handleNavigateToReport} />
      case 'analytics':
        return <Analytics />
      case 'view-report':
        return <ViewReport reportId={selectedReportId} />
      case 'heatmap':
        return <Heatmap />
      case 'dispatch':
        return <Dispatch />
      default:
        return <Dashboard onNavigateToReport={handleNavigateToReport} />
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>E-Responde</h2>
        </div>
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Dashboard
          </button>
          <button 
            className={`nav-item ${currentPage === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentPage('analytics')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"></path>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
            </svg>
            Analytics
          </button>
          <button 
            className={`nav-item ${currentPage === 'view-report' ? 'active' : ''}`}
            onClick={() => setCurrentPage('view-report')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            View Report
          </button>
          <button 
            className={`nav-item ${currentPage === 'heatmap' ? 'active' : ''}`}
            onClick={() => setCurrentPage('heatmap')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Heatmap
          </button>
          <button 
            className={`nav-item ${currentPage === 'dispatch' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dispatch')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            Dispatch
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </div>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
