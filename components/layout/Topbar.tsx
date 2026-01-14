'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, User, Settings, HelpCircle, LogOut, X, Menu } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'

interface Notification {
  _id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

interface TopbarProps {
  onMenuClick?: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const userName = session?.user?.name || 'Admin User'
  const userEmail = session?.user?.email || 'admin@misterwheels.com'
  
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications?limit=10')
      if (!response.ok) throw new Error('Failed to fetch notifications')
      return response.json()
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const notifications = notificationsData?.notifications || []
  const unreadCount = notificationsData?.unreadCount || 0

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationIds: [notificationId],
          read: true,
        }),
      })
      refetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/login' })
  }

  return (
    <header className="h-16 lg:h-20 bg-cardBg border-b border-borderSoft flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40 shadow-sm backdrop-blur-sm bg-cardBg/95">
      {/* Left: Hamburger (mobile) + Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        {/* Hamburger Button - Mobile Only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-bodyText hover:bg-pageBg rounded-lg transition-colors flex-shrink-0"
          aria-label="Toggle menu"
          aria-expanded={false}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Search Bar */}
        <div className="flex-1 min-w-0 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-bodyText" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-pageBg border border-borderSoft rounded-xl text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 transition-all text-sm sm:text-base"
            />
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-5 flex-shrink-0">
        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowProfile(false)
            }}
            className="relative p-2.5 text-bodyText hover:bg-pageBg rounded-xl transition-all hover:scale-105"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-danger rounded-full ring-2 ring-cardBg flex items-center justify-center text-xs text-white font-semibold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown - Responsive */}
          {showNotifications && (
            <>
              {/* Mobile: Full-screen overlay */}
              <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setShowNotifications(false)} />
              
              {/* Notifications Panel */}
              <div className="fixed lg:absolute inset-y-0 right-0 lg:right-0 lg:top-auto lg:mt-2 lg:inset-y-auto w-full sm:w-96 lg:w-80 max-w-[calc(100vw-24px)] lg:max-w-none bg-cardBg border border-borderSoft rounded-lg lg:rounded-lg shadow-xl lg:shadow-xl max-h-[calc(100vh-120px)] lg:max-h-96 overflow-hidden flex flex-col z-50">
                <div className="p-4 border-b border-borderSoft flex items-center justify-between flex-shrink-0">
                  <h3 className="text-lg font-semibold text-headingText">Notifications</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-bodyText hover:text-headingText p-1"
                    aria-label="Close notifications"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-bodyText">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-borderSoft">
                    {notifications.map((notification: Notification) => (
                      <div
                        key={notification._id}
                        className={`p-4 hover:bg-pageBg cursor-pointer transition-colors ${
                          !notification.read ? 'bg-pageBg/50' : ''
                        }`}
                        onClick={() => {
                          if (!notification.read) {
                            handleMarkAsRead(notification._id)
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            !notification.read ? 'bg-sidebarActiveBg' : 'bg-transparent'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-headingText break-words">
                              {notification.title}
                            </p>
                            <p className="text-xs text-bodyText mt-1 line-clamp-2 break-words">
                              {notification.message}
                            </p>
                            <p className="text-xs text-sidebarMuted mt-2">
                              {format(new Date(notification.createdAt), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
              </>
            )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setShowProfile(!showProfile)
              setShowNotifications(false)
            }}
            className="flex items-center gap-3 pl-5 border-l border-borderSoft hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-sidebarActiveBg rounded-full flex items-center justify-center shadow-sm overflow-hidden">
              <img 
                src="/logo.png?v=2"
                alt="MisterWheels" 
                className="w-full h-full object-contain p-1.5"
                style={{ imageRendering: 'auto' }}
                loading="eager"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent && !parent.querySelector('.avatar-fallback')) {
                    const fallback = document.createElement('div')
                    fallback.className = 'avatar-fallback'
                    fallback.innerHTML = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
                    parent.appendChild(fallback)
                  }
                }}
              />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-headingText">{userName}</p>
              <p className="text-xs text-bodyText">{userEmail}</p>
            </div>
          </button>

          {/* Profile Dropdown - Responsive */}
          {showProfile && (
            <>
              {/* Mobile overlay */}
              <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setShowProfile(false)} />
              
              <div className="fixed lg:absolute right-0 lg:right-0 top-auto lg:top-auto lg:mt-2 mt-16 lg:mt-2 w-56 max-w-[calc(100vw-24px)] lg:max-w-none bg-cardBg border border-borderSoft rounded-lg shadow-xl overflow-hidden z-50">
                <div className="p-2">
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setShowProfile(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-bodyText hover:bg-pageBg rounded-lg transition-colors text-left"
                  >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    <span className="break-words">Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowNotifications(true)
                      setShowProfile(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-bodyText hover:bg-pageBg rounded-lg transition-colors text-left"
                  >
                    <Bell className="w-5 h-5 flex-shrink-0" />
                    <span className="break-words flex-1 min-w-0">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-danger text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      router.push('/support')
                      setShowProfile(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-bodyText hover:bg-pageBg rounded-lg transition-colors text-left"
                  >
                    <HelpCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="break-words">Support</span>
                  </button>
                  <div className="border-t border-borderSoft my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    <span className="break-words">Logout</span>
                  </button>
                </div>
              </div>
              </>
            )}
        </div>
      </div>
    </header>
  )
}

