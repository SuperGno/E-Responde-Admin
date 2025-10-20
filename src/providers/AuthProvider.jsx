import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, getAuth } from 'firebase/auth'
import { realtimeDb } from '../firebase'
import { ref, get } from 'firebase/database'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [claims, setClaims] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setUser(null)
          setClaims(null)
          setLoading(false)
          return
        }
        const snap = await get(ref(realtimeDb, 'admin_dashboard_account'))
        const account = snap.exists() ? snap.val() : null
        setUser(u)
        // Normalize role to lowercase short key for consistent checks
        const roleRaw = account?.role || 'superadmin'
        const normalized = String(roleRaw).toLowerCase()
        console.log('AuthProvider: signed in user', u.uid, 'resolved role from DB:', account?.role, 'normalized:', normalized)
        setClaims({ role: normalized })
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const value = useMemo(() => ({ user, claims, loading }), [user, claims, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}


