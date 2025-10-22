import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../ui/Sidebar'
import Header from '../ui/Header'
import { AccountTypeProvider } from '../contexts/AccountTypeContext'

export default function AppLayout() {
  const navigate = useNavigate()
  
  const handleNavigateToReport = (reportId) => {
    navigate(`/report/${reportId}`)
  }
  
  return (
    <AccountTypeProvider>
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col lg:ml-72">
          <Header onNavigateToReport={handleNavigateToReport} />
          <main className="flex-1 overflow-auto bg-gray-50">
            <Outlet />
          </main>
        </div>
      </div>
    </AccountTypeProvider>
  )
}


