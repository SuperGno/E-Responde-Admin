import { NavLink } from 'react-router-dom'

const itemCls = ({ isActive }) =>
  `relative flex items-center gap-3 px-4 py-2 rounded-md transition overflow-hidden ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'
  }`

export default function Sidebar() {
  return (
    <aside className="w-64 hidden md:flex md:flex-col border-r border-slate-800 bg-slate-900/80 dark:bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60">
      <div className="px-5 py-6 text-xl font-semibold tracking-wide text-slate-100">E-Responde</div>
      <nav className="flex flex-col gap-1 px-3">
        <NavLink to="/" className={itemCls}>Dashboard</NavLink>
        <NavLink to="/analytics" className={itemCls}>Analytics</NavLink>
        <NavLink to="/heatmap" className={itemCls}>Heatmap</NavLink>
        <NavLink to="/dispatch" className={itemCls}>Dispatch</NavLink>
        <NavLink to="/accounts" className={itemCls}>Account Management</NavLink>
      </nav>
      <div className="mt-auto p-4 text-xs text-slate-500">Admin Console</div>
    </aside>
  )
}


