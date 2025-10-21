import { createContext, useContext, useState } from 'react'

const AccountTypeContext = createContext()

export function AccountTypeProvider({ children }) {
  const [accountType, setAccountType] = useState('admin')
  
  const switchAccountType = (type) => {
    setAccountType(type)
  }
  
  return (
    <AccountTypeContext.Provider value={{ accountType, setAccountType, switchAccountType }}>
      {children}
    </AccountTypeContext.Provider>
  )
}

export function useAccountType() {
  const context = useContext(AccountTypeContext)
  if (!context) {
    throw new Error('useAccountType must be used within AccountTypeProvider')
  }
  return context
}