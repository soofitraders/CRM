'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { User, Bell, HelpCircle, LogOut, Settings, ChevronDown } from 'lucide-react'
import Link from 'next/link'

export default function UserProfileDropdown() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const userName = session?.user?.name || 'Admin User'
  const userEmail = session?.user?.email || 'admin@misterwheels.com'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = async () => {
    setIsOpen(false)
    await signOut({ callbackUrl: '/login' })
  }

  const menuItems = [
    {
      icon: Bell,
      label: 'Notifications',
      href: '/notifications',
      onClick: () => setIsOpen(false),
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/settings',
      onClick: () => setIsOpen(false),
    },
    {
      icon: HelpCircle,
      label: 'Support',
      href: '/support',
      onClick: () => setIsOpen(false),
    },
    {
      icon: LogOut,
      label: 'Logout',
      href: '#',
      onClick: handleLogout,
      danger: true,
    },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-5 border-l border-borderSoft hover:opacity-80 transition-opacity"
      >
        <div className="w-10 h-10 bg-sidebarActiveBg rounded-full flex items-center justify-center shadow-sm">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-headingText">{userName}</p>
          <p className="text-xs text-bodyText">{userEmail}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-bodyText transition-transform hidden md:block ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-cardBg border border-borderSoft rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="p-4 border-b border-borderSoft bg-pageBg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-sidebarActiveBg rounded-full flex items-center justify-center shadow-sm">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-headingText truncate">{userName}</p>
                <p className="text-xs text-bodyText truncate">{userEmail}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item, index) => {
              const ItemIcon = item.icon
              const isLink = item.href !== '#'

              if (isLink) {
                return (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={item.onClick}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                      item.danger
                        ? 'text-danger hover:bg-red-50'
                        : 'text-bodyText hover:bg-pageBg'
                    }`}
                  >
                    <ItemIcon className={`w-5 h-5 flex-shrink-0 ${
                      item.danger ? 'text-danger' : 'text-sidebarMuted'
                    }`} />
                    <span>{item.label}</span>
                  </Link>
                )
              }

              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    item.danger
                      ? 'text-danger hover:bg-red-50'
                      : 'text-bodyText hover:bg-pageBg'
                  }`}
                >
                  <ItemIcon className={`w-5 h-5 flex-shrink-0 ${
                    item.danger ? 'text-danger' : 'text-sidebarMuted'
                  }`} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

