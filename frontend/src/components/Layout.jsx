import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Activity, LayoutDashboard, CalendarRange, MessageCircle, User, LogOut, Menu, X, Trophy, Sun, Moon } from 'lucide-react'
import { auth } from '../api'
import useTheme from '../hooks/useTheme'

function InitialsAvatar({ user, size = 'md' }) {
  const initial = (user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()
  const sizeClasses = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sizeClasses} rounded-full bg-teal-600 dark:bg-teal-500 text-white dark:text-gray-950 font-semibold flex items-center justify-center flex-shrink-0`}>
      {initial}
    </div>
  )
}

export default function Layout({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()

  const handleLogout = async () => {
    try {
      await auth.logout()
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const navigation = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Activities', to: '/activities', icon: Activity },
    { name: 'AI Coach', to: '/coach', icon: MessageCircle },
    { name: 'Calendar', to: '/calendar', icon: CalendarRange },
    { name: 'Race PBs', to: '/race-pbs', icon: Trophy },
    { name: 'Profile', to: '/profile', icon: User }
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `} style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              My<span className="text-teal-600 dark:text-teal-400">Pace</span>
            </span>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ color: 'var(--text-muted)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-0.5">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    isActive
                      ? 'text-teal-700 dark:text-teal-400 font-semibold'
                      : 'font-medium hover:opacity-80'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? undefined : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                })}
                onClick={() => setSidebarOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-teal-600 dark:bg-teal-400" />
                    )}
                    <item.icon className="w-[18px] h-[18px]" />
                    <span className="text-sm">{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom section: theme toggle + user */}
          <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>

            {/* User profile */}
            <div className="flex items-center space-x-3">
              {user?.profile ? (
                <img src={user.profile} alt={user?.firstName} className="w-10 h-10 rounded-full flex-shrink-0" />
              ) : (
                <InitialsAvatar user={user} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>@{user?.username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar (mobile) */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            My<span className="text-teal-600 dark:text-teal-400">Pace</span>
          </span>
          <div className="w-5" />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export { InitialsAvatar }
