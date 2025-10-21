import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export default function RequireAuth({ children, roles }) {
  const { user, claims, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // Check if user has required role/account type
  if (roles && claims) {
    const userRole = claims.role?.toLowerCase()
    const userAccountType = claims.accountType?.toLowerCase()
    
    // Check if user role or account type matches any of the required roles
    const hasAccess = roles.some(role => {
      const normalizedRole = role.toLowerCase()
      return normalizedRole === userRole || 
             normalizedRole === userAccountType ||
             (normalizedRole === 'admin' && (userRole === 'admin' || userRole === 'superadmin')) ||
             (normalizedRole === 'dispatcher' && (userRole === 'police' || userAccountType === 'police')) ||
             (normalizedRole === 'analyst' && (userRole === 'admin' || userRole === 'superadmin' || userAccountType === 'admin'))
    })
    
    if (!hasAccess) {
      console.log('Access denied. User role:', userRole, 'Account type:', userAccountType, 'Required roles:', roles)
      return <Navigate to="/unauthorized" replace />
    }
  }
  
  return children
}


