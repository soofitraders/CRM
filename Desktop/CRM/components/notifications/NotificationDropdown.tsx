'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, X, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Notification {
  _id: string
  type: string
  title: string
  message: string
  read: boolean
  readAt?: string
  createdAt: string
  data?: any
}

interface NotificationResponse {
  notifications: Notification[]
  unreadCount: number
}

const fetchNotifications = async (): Promise<NotificationResponse> => {
  const response = await fetch('/api/notifications?limit=50')
  if (!response.ok) throw new Error('Failed to fetch notifications')
  return response.json()
}

const markAsRead = async (notificationIds: string[]): Promise<void> => {
  const response = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationIds, read: true }),
  })
  if (!response.ok) throw new Error('Failed to mark as read')
}

const markAllAsRead = async (): Promise<void> => {
  const response = await fetch('/api/notifications/mark-all-read', {
    method: 'POST',
  })
  if (!response.ok) throw new Error('Failed to mark all as read')
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()

  // Fetch notifications
  const { data, isLoading, error } = useQuery<NotificationResponse>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Poll every 30 seconds
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

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

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0
  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read)

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate([notification._id])
    }
    setIsOpen(false)
  }

  const handleMarkAllAsRead = () => {
    if (unreadNotifications.length > 0) {
      markAllAsReadMutation.mutate()
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MILEAGE_WARNING':
        return '🚗'
      case 'MAINTENANCE_REQUIRED':
        return '🔧'
      case 'BOOKING_REMINDER':
        return '📅'
      case 'PAYMENT_DUE':
        return '💰'
      case 'SYSTEM_ALERT':
        return '⚠️'
      default:
        return '🔔'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-bodyText hover:bg-pageBg rounded-xl transition-all hover:scale-105"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full ring-2 ring-cardBg"></span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-cardBg border border-borderSoft rounded-xl shadow-2xl z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-borderSoft flex items-center justify-between">
            <h3 className="text-lg font-semibold text-headingText">Notifications</h3>
            {unreadNotifications.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
                className="text-sm text-sidebarActiveBg hover:text-sidebarActiveBg/80 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                {markAllAsReadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    Mark all as read
                  </>
                )}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-sidebarMuted" />
                <p className="text-sm text-sidebarMuted mt-2">Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <p className="text-sm text-danger">Failed to load notifications</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto text-sidebarMuted/30 mb-3" />
                <p className="text-sm text-sidebarMuted">No notifications</p>
              </div>
            ) : (
              <div>
                {/* Unread Notifications */}
                {unreadNotifications.length > 0 && (
                  <div className="border-b border-borderSoft">
                    {unreadNotifications.map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className="p-4 hover:bg-pageBg cursor-pointer border-l-4 border-sidebarActiveBg transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-semibold text-headingText">
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-sidebarActiveBg rounded-full flex-shrink-0 mt-1.5"></div>
                              )}
                            </div>
                            <p className="text-sm text-bodyText mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-sidebarMuted mt-2">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsReadMutation.mutate([notification._id])
                            }}
                            className="p-1 hover:bg-pageBg rounded transition-colors flex-shrink-0"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4 text-sidebarMuted" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Read Notifications */}
                {readNotifications.length > 0 && (
                  <div>
                    {readNotifications.map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className="p-4 hover:bg-pageBg cursor-pointer transition-colors opacity-75"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-headingText">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-bodyText mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-sidebarMuted mt-2">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-borderSoft text-center">
              <a
                href="/notifications"
                className="text-sm text-sidebarActiveBg hover:text-sidebarActiveBg/80 font-medium"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

