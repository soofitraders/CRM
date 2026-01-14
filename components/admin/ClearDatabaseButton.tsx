'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'

export default function ClearDatabaseButton() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; deleted?: any } | null>(null)

  const userRole = (session?.user as any)?.role || 'CUSTOMER'
  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  if (!isSuperAdmin) {
    return null
  }

  const handleClearDatabase = async () => {
    setIsClearing(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/clear-database', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || 'Database cleared successfully',
          deleted: data.deleted,
        })
        setShowConfirm(false)
        
        // Invalidate all queries to refresh the dashboard
        queryClient.invalidateQueries()
        
        // Reload the page after a short delay to show the result
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to clear database',
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'An error occurred while clearing the database',
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="relative w-full sm:w-auto">
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full sm:w-auto px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        disabled={isClearing}
      >
        <Trash2 className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm sm:text-base whitespace-nowrap">Clear Database</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg rounded-lg p-4 sm:p-6 max-w-[calc(100vw-32px)] sm:max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-headingText">Clear Database</h3>
                <p className="text-sm text-bodyText">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-bodyText mb-2">
                <strong className="text-warning">Warning:</strong> This will permanently delete:
              </p>
              <ul className="text-xs text-bodyText list-disc list-inside space-y-1">
                <li>All users (except super admin)</li>
                <li>All vehicles, bookings, and invoices</li>
                <li>All customers, investors, and payments</li>
                <li>All expenses, maintenance records, and documents</li>
                <li>All notifications, logs, and settings</li>
              </ul>
              <p className="text-sm text-bodyText mt-3">
                <strong>Only the super admin user will be preserved.</strong>
              </p>
            </div>

            {result && (
              <div
                className={`p-3 rounded-lg mb-4 ${
                  result.success
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-danger/10 border border-danger/20'
                }`}
              >
                <p className={`text-sm ${result.success ? 'text-success' : 'text-danger'}`}>
                  {result.message}
                </p>
                {result.success && result.deleted && (
                  <div className="mt-2 text-xs text-bodyText">
                    <p>Deleted items:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Users: {result.deleted.users}</li>
                      <li>Vehicles: {result.deleted.vehicles}</li>
                      <li>Bookings: {result.deleted.bookings}</li>
                      <li>Invoices: {result.deleted.invoices}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false)
                  setResult(null)
                }}
                className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={handleClearDatabase}
                className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirm Clear
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

