'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'

type DataType = 'sales' | 'invoices' | 'payments' | 'bookings' | 'expenses' | 'maintenance'

interface DataTypeOption {
  value: DataType
  label: string
  description: string
  warning?: string
}

const dataTypeOptions: DataTypeOption[] = [
  {
    value: 'sales',
    label: 'Sales Data',
    description: 'Delete all invoices and payments (this will reset Total Sales to 0)',
    warning: 'This will delete all invoices and payments, affecting sales metrics',
  },
  {
    value: 'invoices',
    label: 'Invoices Only',
    description: 'Delete all invoices (DRAFT, ISSUED, PAID, VOID)',
  },
  {
    value: 'payments',
    label: 'Payments Only',
    description: 'Delete all payment records',
  },
  {
    value: 'bookings',
    label: 'Bookings',
    description: 'Delete all booking records',
    warning: 'This will also delete related invoices and payments',
  },
  {
    value: 'expenses',
    label: 'Expenses',
    description: 'Delete all expense records',
  },
  {
    value: 'maintenance',
    label: 'Maintenance Records',
    description: 'Delete all maintenance records',
  },
]

export default function SelectiveDataDeletion() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<DataType[]>([])
  const [result, setResult] = useState<{ success: boolean; message: string; deleted?: any } | null>(null)

  const userRole = (session?.user as any)?.role || 'CUSTOMER'
  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  if (!isSuperAdmin) {
    return null
  }

  const handleTypeToggle = (type: DataType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleDelete = async () => {
    if (selectedTypes.length === 0) {
      alert('Please select at least one data type to delete')
      return
    }

    setIsDeleting(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/delete-selective-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataTypes: selectedTypes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || 'Selected data deleted successfully',
          deleted: data.deleted,
        })
        setShowConfirm(false)
        setSelectedTypes([])

        // Invalidate all queries to refresh the dashboard
        queryClient.invalidateQueries()

        // Reload the page after a short delay to show the result
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to delete selected data',
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'An error occurred while deleting data',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getSelectedLabels = () => {
    return selectedTypes
      .map((type) => dataTypeOptions.find((opt) => opt.value === type)?.label)
      .filter(Boolean)
      .join(', ')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowConfirm(true)}
        className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
        disabled={isDeleting}
      >
        <Trash2 className="w-4 h-4" />
        Delete Selective Data
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-cardBg rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-headingText">Delete Selective Data</h3>
                <p className="text-sm text-bodyText">Select the data types you want to delete</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {dataTypeOptions.map((option) => (
                <div
                  key={option.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTypes.includes(option.value)
                      ? 'border-sidebarActiveBg bg-sidebarActiveBg/5'
                      : 'border-borderSoft hover:border-sidebarActiveBg/50'
                  }`}
                  onClick={() => handleTypeToggle(option.value)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(option.value)}
                      onChange={() => handleTypeToggle(option.value)}
                      className="mt-1 w-4 h-4 text-sidebarActiveBg border-borderSoft rounded focus:ring-sidebarActiveBg"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-headingText">{option.label}</h4>
                        {option.warning && (
                          <span className="text-xs text-warning">⚠️</span>
                        )}
                      </div>
                      <p className="text-sm text-bodyText mt-1">{option.description}</p>
                      {option.warning && (
                        <p className="text-xs text-warning mt-1">{option.warning}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTypes.length > 0 && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-bodyText mb-2">
                  <strong className="text-warning">Warning:</strong> You are about to delete:
                </p>
                <p className="text-sm font-medium text-headingText">{getSelectedLabels()}</p>
                <p className="text-sm text-bodyText mt-2">
                  <strong>This action cannot be undone.</strong>
                </p>
              </div>
            )}

            {result && (
              <div
                className={`p-3 rounded-lg mb-4 ${
                  result.success
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-danger/10 border border-danger/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.success && <CheckCircle2 className="w-5 h-5 text-success" />}
                  <p className={`text-sm ${result.success ? 'text-success' : 'text-danger'}`}>
                    {result.message}
                  </p>
                </div>
                {result.success && result.deleted && (
                  <div className="mt-2 text-xs text-bodyText">
                    <p className="font-medium mt-2">Deleted items:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {result.deleted.invoices !== undefined && (
                        <li>Invoices: {result.deleted.invoices}</li>
                      )}
                      {result.deleted.payments !== undefined && (
                        <li>Payments: {result.deleted.payments}</li>
                      )}
                      {result.deleted.bookings !== undefined && (
                        <li>Bookings: {result.deleted.bookings}</li>
                      )}
                      {result.deleted.expenses !== undefined && (
                        <li>Expenses: {result.deleted.expenses}</li>
                      )}
                      {result.deleted.maintenance !== undefined && (
                        <li>Maintenance Records: {result.deleted.maintenance}</li>
                      )}
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
                  setSelectedTypes([])
                }}
                className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                disabled={isDeleting || selectedTypes.length === 0}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirm Delete
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
