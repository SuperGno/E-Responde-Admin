import { useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard.jsx'
import Analytics from './components/Analytics.jsx'
import ViewReport from './components/ViewReport.jsx'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const handleNavigateToReport = (reportId) => {
    setCurrentPage('view-report');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigateToReport={handleNavigateToReport} />
      case 'analytics':
        return <Analytics />
      case 'view-report':
        return <ViewReport />
      default:
        return <Dashboard onNavigateToReport={handleNavigateToReport} />
    }
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
        </nav>
      </div>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
