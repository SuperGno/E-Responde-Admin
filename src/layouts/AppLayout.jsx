import { Outlet } from 'react-router-dom'
import Sidebar from '../ui/Sidebar'
import Header from '../ui/Header'
import { AccountTypeProvider } from '../contexts/AccountTypeContext'

export default function AppLayout() {
  return (
    <AccountTypeProvider>
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col lg:ml-72">
          <Header />
          <main className="flex-1 overflow-auto bg-gray-50">
            <Outlet />
          </main>
        </div>
      </div>
    </AccountTypeProvider>
  )
}


