'use client'

import { Bell, Search, User } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function Topbar() {
  const { data: session } = useSession()
  const userName = session?.user?.name || 'Admin User'
  const userEmail = session?.user?.email || 'admin@misterwheels.com'

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
        {/* Notifications */}
        <button className="relative p-2.5 text-bodyText hover:bg-pageBg rounded-xl transition-all hover:scale-105">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full ring-2 ring-cardBg"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-5 border-l border-borderSoft">
          <div className="w-10 h-10 bg-sidebarActiveBg rounded-full flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-headingText">{userName}</p>
            <p className="text-xs text-bodyText">{userEmail}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

