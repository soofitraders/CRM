'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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

  const isItemVisible = useCallback((item: MenuItem): boolean => {
    if (!item.roles) return true
    return item.roles.includes(userRole)
  }, [userRole])

  const isSectionVisible = useCallback((section: MenuSection): boolean => {
    // Check if section has role restrictions
    if (section.roles && !section.roles.includes(userRole)) {
      return false
    }
    // Check if section has any visible items
    return section.items.some(isItemVisible)
  }, [userRole, isItemVisible])

  const isItemActive = useCallback((path: string): boolean => {
    if (pathname === path) return true
    if (pathname && pathname.startsWith(path + '/')) return true
    return false
  }, [pathname])

  const isSectionActive = useCallback((section: MenuSection): boolean => {
    return section.items.some((item) => isItemActive(item.path))
  }, [isItemActive])

  const filteredSections = useMemo(() => {
    return menuSections.filter(isSectionVisible)
  }, [isSectionVisible])

  // Auto-expand sections that contain active items
  useEffect(() => {
    const activeSections = new Set<string>()
    filteredSections.forEach((section) => {
      if (isSectionActive(section)) {
        activeSections.add(section.id)
      }
    })
    if (activeSections.size > 0) {
      setExpandedSections((prev) => {
        const newSet = new Set(prev)
        activeSections.forEach((id) => newSet.add(id))
        return newSet
      })
    }
  }, [pathname, filteredSections, isSectionActive])

  return (
    <aside className="w-64 bg-sidebarBg h-screen flex flex-col fixed left-0 top-0 z-50 shadow-lg overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-sidebarMuted/20 flex-shrink-0">
        <div className="flex items-center justify-center">
          <img 
            src="/logo.png?v=2"
            alt="MisterWheels Logo" 
            className="h-10 w-auto object-contain max-w-full"
            style={{ imageRendering: 'auto' }}
            loading="eager"
            onError={(e) => {
              // Fallback to text if logo not found
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent && !parent.querySelector('.logo-fallback')) {
                const fallback = document.createElement('div')
                fallback.className = 'logo-fallback'
                fallback.innerHTML = '<h1 class="text-sidebarText text-xl font-bold leading-tight tracking-tight">MISTERWHEELS</h1><p class="text-sidebarMuted text-xs mt-1.5 font-medium">RENT A CAR LLC</p>'
                parent.appendChild(fallback)
              }
            }}
          />
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
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

    </aside>
  )
}
