import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export default function RequireAuth({ children, roles }) {
  const { user, claims, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // Development shortcut: allow any authenticated user to proceed when not in production
  if (process.env.NODE_ENV !== 'production') {
    return children
  }

  if (roles && claims && !roles.map(r => r.toLowerCase()).includes(claims.role)) return <Navigate to="/unauthorized" replace />
  return children
}


