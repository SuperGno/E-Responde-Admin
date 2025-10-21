import PoliceAccountManagement from './PoliceAccountManagement'
import UserAccountManagement from './UserAccountManagement'
import { useAccountType } from '../contexts/AccountTypeContext'
import './AccountManagement.css'

function AccountManagement() {
  const { accountType } = useAccountType()

  return (
    <div className="account-management-container">
      <div className="account-management-header">
        <h1>Account Management</h1>
        <p>Manage civilian and police accounts</p>
      </div>

      <div className="account-content">
        {accountType === 'civilian' ? (
          <UserAccountManagement />
        ) : (
          <PoliceAccountManagement />
        )}
      </div>
    </div>
  )
}

export default AccountManagement
