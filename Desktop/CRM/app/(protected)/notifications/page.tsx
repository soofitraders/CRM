'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'

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
  const response = await fetch('/api/notifications?limit=100')
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

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  const { data, isLoading, error } = useQuery<NotificationResponse>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  })

  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const filteredNotifications =
    filter === 'all'
      ? notifications
      : filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications.filter((n) => n.read)

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

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'MILEAGE_WARNING':
        return 'bg-yellow-100 text-yellow-800'
      case 'MAINTENANCE_REQUIRED':
        return 'bg-red-100 text-red-800'
      case 'BOOKING_REMINDER':
        return 'bg-blue-100 text-blue-800'
      case 'PAYMENT_DUE':
        return 'bg-green-100 text-green-800'
      case 'SYSTEM_ALERT':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Notifications</h1>
          <p className="text-bodyText mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2 disabled:opacity-50"
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

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-borderSoft">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'all'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'unread'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'read'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          Read ({notifications.length - unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <SectionCard>
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-sidebarMuted" />
            <p className="text-bodyText mt-4">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-sidebarMuted/30 mb-3" />
            <p className="text-danger">Failed to load notifications</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-sidebarMuted/30 mb-3" />
            <p className="text-bodyText">
              {filter === 'unread'
                ? 'No unread notifications'
                : filter === 'read'
                ? 'No read notifications'
                : 'No notifications'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-borderSoft">
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-4 hover:bg-pageBg transition-colors ${
                  !notification.read ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={`text-base font-semibold text-headingText ${
                              !notification.read ? 'font-bold' : ''
                            }`}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-sidebarActiveBg rounded-full"></span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${getNotificationColor(
                              notification.type
                            )}`}
                          >
                            {notification.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-bodyText mt-1">{notification.message}</p>
                        <p className="text-xs text-sidebarMuted mt-2">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => markAsReadMutation.mutate([notification._id])}
                          disabled={markAsReadMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

