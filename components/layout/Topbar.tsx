'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, User, Settings, HelpCircle, LogOut, X } from 'lucide-react'
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

export default function Topbar() {
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

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-cardBg border border-borderSoft rounded-lg shadow-xl max-h-96 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-borderSoft flex items-center justify-between">
                <h3 className="text-lg font-semibold text-headingText">Notifications</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-bodyText hover:text-headingText"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-80">
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
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            !notification.read ? 'bg-sidebarActiveBg' : 'bg-transparent'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-headingText">
                              {notification.title}
                            </p>
                            <p className="text-xs text-bodyText mt-1 line-clamp-2">
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

          {/* Profile Dropdown */}
          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-cardBg border border-borderSoft rounded-lg shadow-xl overflow-hidden">
              <div className="p-2">
                <button
                  onClick={() => {
                    router.push('/settings')
                    setShowProfile(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-bodyText hover:bg-pageBg rounded-lg transition-colors text-left"
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => {
                    setShowNotifications(true)
                    setShowProfile(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-bodyText hover:bg-pageBg rounded-lg transition-colors text-left"
                >
                  <Bell className="w-5 h-5" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-danger text-white text-xs px-2 py-0.5 rounded-full">
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
                  <HelpCircle className="w-5 h-5" />
                  <span>Support</span>
                </button>
                <div className="border-t border-borderSoft my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

