'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Calendar, 
  Car, 
  Users, 
  DollarSign, 
  User, 
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
  { icon: User, label: 'Manage Users', path: '/manage-users' },
  { icon: User, label: 'Role', path: '/role' },
]

const bottomMenuItems = [
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: HelpCircle, label: 'Support', path: '/support' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-[#1a1a1a] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-white text-xs font-bold leading-tight uppercase">
          MISTERWHEELS<br />
          <span className="text-gray-400 text-[10px] font-normal">RENT A CAR LLC</span>
        </h1>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#ff6b35] text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          )
        })}

        {/* Separator */}
        <div className="border-t border-gray-700 my-2"></div>

        {/* Bottom Menu Items */}
        {bottomMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#ff6b35] text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          )
        })}

        {/* Separator */}
        <div className="border-t border-gray-700 my-2"></div>

        {/* Logout */}
        <Link
          href="/login"
          className="flex items-center px-6 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Link>
      </nav>
    </div>
  )
}

