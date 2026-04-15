import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Shield, Search, Sun, Moon, ChevronDown, User, LogOut, BarChart3, Users, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUITheme } from '../hooks/useUITheme'
import { cn } from '../lib/utils'
import { NotificationCenter } from './NotificationCenter'

interface NavbarProps {
  onSearch: (q: string) => void
  searchQuery: string
  isDark: boolean
  onToggleDark: () => void
}

export function Navbar({ onSearch, searchQuery, isDark, onToggleDark }: NavbarProps) {
  const { user, logout } = useAuth()
  const { isMaterial } = useUITheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'
  const isAnalytics = location.pathname === '/analytics'
  const isShared = location.pathname === '/shared'
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <nav className="sticky top-0 z-40 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 flex-shrink-0 mr-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-gray-100 hidden sm:block">
              PurchaseVault
            </span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4',
                isMaterial ? 'text-gray-500' : 'text-gray-400',
              )} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                className={cn(
                  'w-full pl-9 pr-4 py-2 text-sm',
                  isMaterial ? 'rounded-full' : 'rounded-lg',
                  'bg-gray-100 dark:bg-gray-800',
                  'border border-transparent',
                  'text-gray-900 dark:text-gray-100',
                  'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-gray-900',
                )}
              />
            </div>
          </div>

          {/* Dashboard button */}
          <Link
            to="/dashboard"
            title="Dashboard"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
              isDashboard
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          {/* Analytics button */}
          <Link
            to="/analytics"
            title="Purchase Analytics"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
              isAnalytics
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </Link>

          {/* Shared with me */}
          <Link
            to="/shared"
            title="Shared with Me"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
              isShared
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Shared</span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Dark mode toggle */}
            <button
              onClick={onToggleDark}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notification Center */}
            <NotificationCenter />

            {/* User avatar + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {initials}
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {user?.name}
                </span>
                {user && (
                  <Link
                    to={user.subscriptionTier === 'free' ? '/pricing' : '/profile#subscription'}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'hidden md:inline-flex px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wide transition-colors',
                      user.subscriptionTier === 'business'
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                        : user.subscriptionTier === 'pro'
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-primary-50 hover:text-primary-600'
                    )}
                  >
                    {user.subscriptionTier}
                  </Link>
                )}
                <ChevronDown className="h-4 w-4 text-gray-400 hidden md:block" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
