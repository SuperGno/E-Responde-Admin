import { useEffect, useState } from 'react'
import { useAuth } from '../providers/AuthProvider'

export default function Header() {
  const { user, claims } = useAuth()
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })
  const [notifCount] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/70 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-slate-100 font-semibold tracking-wide">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md hover:bg-slate-800/60 text-slate-300">
            {theme === 'dark' ? '🌞' : '🌙'}
          </button>
          <div className="relative">
            <button className="p-2 rounded-md hover:bg-slate-800/60 text-slate-300">🔔</button>
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                {notifCount}
              </span>
            )}
          </div>
          <div className="text-xs md:text-sm text-slate-300">
            {claims?.role} · {user?.email}
          </div>
        </div>
      </div>
    </header>
  )
}


