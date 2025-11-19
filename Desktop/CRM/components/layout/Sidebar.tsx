'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Calendar, 
  Car, 
  Users, 
  DollarSign, 
  UserCog,
  Shield,
  Settings, 
  HelpCircle, 
  LogOut 
} from 'lucide-react'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Calendar, label: 'Bookings', path: '/bookings' },
  { icon: Car, label: 'Units', path: '/units' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: DollarSign, label: 'Financials', path: '/financials' },
  { icon: UserCog, label: 'Manage Users', path: '/users' },
  { icon: Shield, label: 'Role', path: '/roles' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: HelpCircle, label: 'Support', path: '/support' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-sidebarBg min-h-screen flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebarMuted/20">
        <h1 className="text-sidebarText text-lg font-bold leading-tight">
          MISTERWHEELS
        </h1>
        <p className="text-sidebarMuted text-xs mt-1">RENT A CAR LLC</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path || (pathname && pathname.startsWith(item.path + '/'))
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center px-6 py-3 mx-2 my-1 text-sm font-medium transition-all duration-200 rounded-lg ${
                isActive
                  ? 'bg-sidebarActiveBg text-white shadow-sm'
                  : 'text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText'
              }`}
            >
              <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebarMuted/20">
        <Link
          href="/login"
          className="flex items-center px-6 py-3 mx-2 text-sm font-medium text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText transition-all duration-200 rounded-lg"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Link>
      </div>
    </aside>
  )
}

