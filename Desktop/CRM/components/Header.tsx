'use client'

import { Bell, User } from 'lucide-react'

export default function Header() {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
      <div className="flex items-center space-x-4">
        {/* Notification Bell */}
        <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-gray-800" />
          </div>
          <span className="text-sm font-medium text-gray-900">MisterWheels Admin</span>
        </div>
      </div>
    </div>
  )
}

