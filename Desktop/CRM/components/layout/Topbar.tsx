'use client'

import { Search } from 'lucide-react'
import NotificationDropdown from '@/components/notifications/NotificationDropdown'
import UserProfileDropdown from './UserProfileDropdown'

export default function Topbar() {
  return (
    <header className="h-20 bg-cardBg border-b border-borderSoft flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm backdrop-blur-sm bg-cardBg/95">
      {/* Search Bar */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-bodyText" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-12 pr-4 py-2.5 bg-pageBg border border-borderSoft rounded-xl text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 transition-all"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-5">
        {/* Notifications Dropdown */}
        <NotificationDropdown />

        {/* User Profile Dropdown */}
        <UserProfileDropdown />
      </div>
    </header>
  )
}

