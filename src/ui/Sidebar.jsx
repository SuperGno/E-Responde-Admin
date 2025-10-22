import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { getAuth, signOut } from 'firebase/auth'
import { useAccountType } from '../contexts/AccountTypeContext'
import { useState } from 'react'

function LinkItem({ to, label, children }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-white text-black shadow-lg' 
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <span className="flex-shrink-0 w-5 h-5">{children}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accountType, switchAccountType } = useAccountType()
  const [showAccountSubmenu, setShowAccountSubmenu] = useState(false)
  
  const isAccountsPage = location.pathname === '/accounts'

  const handleLogout = async () => {
    try {
      const auth = getAuth()
      await signOut(auth)
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleAccountManagementClick = (e) => {
    e.preventDefault()
    setShowAccountSubmenu(!showAccountSubmenu)
  }

  const handleAccountTypeSelect = (type) => {
    switchAccountType(type)
    navigate('/accounts')
    setShowAccountSubmenu(false)
  }

  return (
    <aside className="fixed left-0 top-0 w-72 h-full bg-black border-r border-gray-800 shadow-md z-50 lg:translate-x-0 -translate-x-full transition-transform duration-300">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
            <img 
              src="/Admin-E-Responde.png" 
              alt="E-Responde Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">E-Responde</h2>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Admin Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 py-4 overflow-y-auto">
        <LinkItem to="/" label="Dashboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </LinkItem>
        <LinkItem to="/analytics" label="Analytics & Heatmap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"/>
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        </LinkItem>
        <LinkItem to="/dispatch" label="Dispatch Center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </LinkItem>
        <LinkItem to="/voip" label="VoIP Management">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </LinkItem>
        <LinkItem to="/sos" label="SOS Management">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6"/>
          </svg>
        </LinkItem>
        <LinkItem to="/monitoring" label="Real-time Monitoring">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6"/>
            <path d="M21 12h-6m-6 0H3"/>
            <path d="M12 3v6m0 6v6"/>
          </svg>
        </LinkItem>
        <LinkItem to="/notifications" label="Notification Management">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </LinkItem>
        <LinkItem to="/emergency-contacts" label="Emergency Contacts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </LinkItem>
        <div className="px-2">
          <button 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              isAccountsPage 
                ? 'bg-white text-black shadow-lg' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
            onClick={handleAccountManagementClick}
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Account Management</span>
            </div>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className={`transition-transform duration-200 ${showAccountSubmenu ? 'rotate-180' : ''}`}
            >
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>
          
          {showAccountSubmenu && (
            <div className="mt-2 ml-4 space-y-1">
              <button 
                className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  accountType === 'civilian' 
                    ? 'bg-white text-black' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={() => handleAccountTypeSelect('civilian')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                </svg>
                <span>Civilian Accounts</span>
              </button>
              <button 
                className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  accountType === 'police' 
                    ? 'bg-white text-black' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={() => handleAccountTypeSelect('police')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>Police Accounts</span>
              </button>
            </div>
          )}
        </div>
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-status-danger text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-all duration-200 focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
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


