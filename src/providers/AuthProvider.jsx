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
        
        setUser(u)
        
        // Check all possible account types
        let accountType = null
        let role = 'user'
        let accountData = null
        
        try {
          // Check for admin account first
          const adminSnap = await get(ref(realtimeDb, 'admin_dashboard_account'))
          if (adminSnap.exists()) {
            const adminData = adminSnap.val()
            if (adminData.userId === u.uid || adminData.authUid === u.uid) {
              accountType = 'admin'
              role = adminData.role || 'admin'
              accountData = adminData
              console.log('AuthProvider: Admin account found for user', u.uid)
            }
          }
          
          // If not admin, check for civilian account
          if (!accountType) {
            const civilianSnap = await get(ref(realtimeDb, `civilian/civilian account/${u.uid}`))
            if (civilianSnap.exists()) {
              const civilianData = civilianSnap.val()
              // Check if account is deleted
              if (civilianData.isDeleted) {
                console.warn('AuthProvider: Civilian account is deleted for user', u.uid)
                setUser(null)
                setClaims(null)
                setLoading(false)
                return
              }
              accountType = 'civilian'
              role = 'civilian'
              accountData = civilianData
              console.log('AuthProvider: Civilian account found for user', u.uid)
            }
          }
          
          // If not civilian, check for police account
          if (!accountType) {
            const policeSnap = await get(ref(realtimeDb, `police/police account/${u.uid}`))
            if (policeSnap.exists()) {
              const policeData = policeSnap.val()
              // Check if account is deleted
              if (policeData.isDeleted) {
                console.warn('AuthProvider: Police account is deleted for user', u.uid)
                setUser(null)
                setClaims(null)
                setLoading(false)
                return
              }
              accountType = 'police'
              role = 'police'
              accountData = policeData
              console.log('AuthProvider: Police account found for user', u.uid)
            }
          }
          
          // If no account found in any category
          if (!accountType) {
            console.warn('AuthProvider: No account found for user', u.uid, 'in any category')
            setUser(null)
            setClaims(null)
            setLoading(false)
            return
          }
          
          // Normalize role to lowercase for consistent checks
          const normalized = String(role).toLowerCase()
          console.log('AuthProvider: signed in user', u.uid, 'account type:', accountType, 'role:', normalized)
          console.log('AuthProvider: account data:', accountData)
          
          const claimsData = { 
            role: normalized, 
            accountType: accountType,
            accountData: accountData 
          }
          
          console.log('AuthProvider: setting claims:', claimsData)
          setClaims(claimsData)
          
        } catch (error) {
          console.error('AuthProvider: Error checking account types:', error)
          setUser(null)
          setClaims(null)
        }
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


