'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
  LogOut,
  BarChart3,
  Receipt,
  Wallet,
  TrendingUp,
  FileText,
  Building2,
  Calendar as CalendarIcon,
  Wrench,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  List,
  CreditCard,
  TrendingDown,
  User,
  Bell,
  Home,
  ClipboardList,
} from 'lucide-react'

interface MenuSection {
  id: string
  label: string
  icon: any
  items: MenuItem[]
  roles?: string[]
}

interface MenuItem {
  label: string
  path: string
  icon?: any
  roles?: string[]
}

const menuSections: MenuSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', path: '/dashboard', icon: Home },
    ],
  },
  {
    id: 'bookings',
    label: 'Bookings & Management',
    icon: Calendar,
    items: [
      { label: 'Bookings Overview', path: '/bookings', icon: List },
      { label: 'New Booking', path: '/bookings/new', icon: PlusCircle },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicle & Fleet',
    icon: Car,
    items: [
      { label: 'Vehicles Overview', path: '/units', icon: List },
      { label: 'Add New Vehicle', path: '/units/new', icon: PlusCircle },
      { label: 'Vehicle Maintenance', path: '/maintenance', icon: Wrench, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'] },
    ],
  },
  {
    id: 'financials',
    label: 'Financials',
    icon: DollarSign,
    items: [
      { label: 'Financial Overview', path: '/financials', icon: DollarSign },
      { label: 'Reports', path: '/financials/reports', icon: BarChart3 },
      { label: 'Expenses', path: '/financials/management/expenses', icon: Receipt, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
      { label: 'Recurring Expenses', path: '/financials/management/recurring-expenses', icon: CalendarIcon, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
      { label: 'Salaries', path: '/financials/management/salaries', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
      { label: 'Investor Payouts', path: '/financials/management/investor-payouts', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
      { label: 'P&L Reports', path: '/financials/management/profit-and-loss', icon: TrendingUp, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
      { label: 'Investor Reports', path: '/financials/management/investor-reports', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
    ],
  },
  {
    id: 'customers',
    label: 'Customer & Clients',
    icon: Users,
    items: [
      { label: 'Customer Profiles', path: '/clients', icon: User },
      { label: 'Manage Clients', path: '/clients', icon: ClipboardList },
    ],
  },
  {
    id: 'investors',
    label: 'Investor Management',
    icon: Building2,
    items: [
      { label: 'Investor Overview', path: '/investors', icon: List, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
      { label: 'New Investor', path: '/investors/new', icon: PlusCircle, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
    ],
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
  },
  {
    id: 'users',
    label: 'User & Role Management',
    icon: UserCog,
    items: [
      { label: 'User Profiles', path: '/users', icon: User },
      { label: 'Role Management', path: '/settings/roles', icon: Shield, roles: ['SUPER_ADMIN'] },
      { label: 'Permissions', path: '/settings/permissions', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'System Settings', path: '/settings', icon: Settings },
    ],
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || 'CUSTOMER'
  
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['dashboard', 'bookings']) // Default expanded sections
  )

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const isItemVisible = (item: MenuItem): boolean => {
    if (!item.roles) return true
    return item.roles.includes(userRole)
  }

  const isSectionVisible = (section: MenuSection): boolean => {
    // Check if section has role restrictions
    if (section.roles && !section.roles.includes(userRole)) {
      return false
    }
    // Check if section has any visible items
    return section.items.some(isItemVisible)
  }

  const isItemActive = (path: string): boolean => {
    if (pathname === path) return true
    if (pathname && pathname.startsWith(path + '/')) return true
    return false
  }

  const isSectionActive = (section: MenuSection): boolean => {
    return section.items.some((item) => isItemActive(item.path))
  }

  const filteredSections = menuSections.filter(isSectionVisible)

  return (
    <aside className="w-64 bg-sidebarBg min-h-screen flex flex-col fixed left-0 top-0 z-50 shadow-lg">
      {/* Logo */}
      <div className="p-6 border-b border-sidebarMuted/20">
        <h1 className="text-sidebarText text-xl font-bold leading-tight tracking-tight">
          MISTERWHEELS
        </h1>
        <p className="text-sidebarMuted text-xs mt-1.5 font-medium">RENT A CAR LLC</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        <div className="px-3 space-y-1">
          {filteredSections.map((section) => {
            const SectionIcon = section.icon
            const isExpanded = expandedSections.has(section.id)
            const isActive = isSectionActive(section)
            const visibleItems = section.items.filter(isItemVisible)

            if (visibleItems.length === 0) return null

            return (
              <div key={section.id} className="mb-2">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all duration-200 rounded-lg group ${
                    isActive
                      ? 'bg-sidebarActiveBg/20 text-sidebarActiveBg'
                      : 'text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText'
                  }`}
                >
                  <div className="flex items-center">
                    <SectionIcon className={`w-5 h-5 mr-3 flex-shrink-0 ${
                      isActive ? 'text-sidebarActiveBg' : 'text-sidebarMuted group-hover:text-sidebarText'
                    }`} />
                    <span className="truncate">{section.label}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  )}
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-sidebarMuted/20 pl-3">
                    {visibleItems.map((item) => {
                      const ItemIcon = item.icon || List
                      const active = isItemActive(item.path)

                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          className={`flex items-center px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg group ${
                            active
                              ? 'bg-sidebarActiveBg text-white shadow-md'
                              : 'text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText'
                          }`}
                        >
                          <ItemIcon className={`w-4 h-4 mr-2 flex-shrink-0 ${
                            active ? 'text-white' : 'text-sidebarMuted group-hover:text-sidebarText'
                          }`} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Fixed Bottom Section */}
      <div className="p-4 border-t border-sidebarMuted/20 space-y-1">
        <Link
          href="/notifications"
          className="flex items-center px-4 py-2.5 text-sm font-medium text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText transition-all duration-200 rounded-lg group"
        >
          <Bell className="w-5 h-5 mr-3 flex-shrink-0 text-sidebarMuted group-hover:text-sidebarText" />
          <span>Notifications</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center px-4 py-2.5 text-sm font-medium text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText transition-all duration-200 rounded-lg group"
        >
          <HelpCircle className="w-5 h-5 mr-3 flex-shrink-0 text-sidebarMuted group-hover:text-sidebarText" />
          <span>Support</span>
        </Link>
        <Link
          href="/login"
          className="flex items-center px-4 py-2.5 text-sm font-medium text-sidebarMuted hover:bg-sidebarMuted/10 hover:text-sidebarText transition-all duration-200 rounded-lg group"
        >
          <LogOut className="w-5 h-5 mr-3 flex-shrink-0 text-sidebarMuted group-hover:text-sidebarText" />
          <span>Logout</span>
        </Link>
      </div>
    </aside>
  )
}
