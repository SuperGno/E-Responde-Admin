import { Outlet } from 'react-router-dom'
import Sidebar from '../ui/Sidebar'
import Header from '../ui/Header'
import '../App.css'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


