'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

type UserRole = 'admin' | 'staff'

type NavItem = {
  href: string
  label: string
  roles: UserRole[] // Which roles can access this page
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: '營收報表', roles: ['admin'] },
  { href: '/pos', label: 'POS 收銀', roles: ['admin', 'staff'] },
  { href: '/products', label: '商品庫', roles: ['admin'] },
  { href: '/ichiban-kuji', label: '一番賞庫', roles: ['admin'] },
  { href: '/vendors', label: '廠商管理', roles: ['admin'] },
  { href: '/customers', label: '客戶管理', roles: ['admin'] },
  { href: '/purchases', label: '進貨管理', roles: ['admin', 'staff'] },
  { href: '/sales', label: '銷售記錄', roles: ['admin'] },
  { href: '/ar', label: '應收帳款', roles: ['admin'] },
  { href: '/ap', label: '應付帳款', roles: ['admin'] },
  { href: '/expenses', label: '會計記帳', roles: ['admin', 'staff'] },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<{ username: string; role: UserRole } | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setUser(data.data)
        }
      })
      .catch(() => {
        // Ignore error
      })
  }, [])

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return

    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (err) {
      alert('登出失敗')
      setLoggingOut(false)
    }
  }

  // Filter nav items based on user role
  const filteredNavItems = user
    ? navItems.filter(item => item.roles.includes(user.role))
    : navItems

  return (
    <nav className="border-b bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.jpg"
                alt="ToyFlow ERP Logo"
                width={40}
                height={40}
                className="rounded"
              />
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">失控 ERP</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden gap-1 lg:flex xl:gap-2">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded px-2 py-2 text-xs font-medium transition-colors xl:text-sm ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* User Info */}
            {user && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {user.username}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                }`}>
                  {user.role === 'admin' ? '管理員' : '員工'}
                </span>
              </div>
            )}

            {/* Logout Button */}
            {user && (
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="hidden md:block px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {loggingOut ? '登出中...' : '登出'}
              </button>
            )}

            <ThemeToggle />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 lg:hidden"
              aria-label="切換選單"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="border-t pb-4 pt-2 dark:border-gray-700 lg:hidden">
            {/* Mobile User Info */}
            {user && (
              <div className="flex items-center justify-between px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user.username}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  }`}>
                    {user.role === 'admin' ? '管理員' : '員工'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-sm font-medium text-red-600 dark:text-red-400 disabled:opacity-50"
                >
                  {loggingOut ? '登出中...' : '登出'}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
