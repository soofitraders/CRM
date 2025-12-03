'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface User {
  _id: string
  name: string
  email: string
  phone?: string
}

export default function NewInvestorPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    userId: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
    companyName: '',
    tradeLicenseNumber: '',
    taxId: '',
    bankAccountName: '',
    bankName: '',
    iban: '',
    swift: '',
    payoutFrequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY',
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      // Try to fetch all active users first
      const response = await fetch('/api/users?status=ACTIVE&limit=1000')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        // If that fails, try without status filter
        const fallbackResponse = await fetch('/api/users?limit=1000')
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          setUsers(fallbackData.users || [])
        } else {
          const errorText = await fallbackResponse.text()
          console.error('Failed to fetch users:', errorText)
          setError('Failed to load users. Please check your permissions or contact an administrator.')
        }
      }
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError('Failed to load users: ' + err.message)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create investor')
      }

      router.push('/investors')
    } catch (err: any) {
      setError(err.message || 'Failed to create investor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-sidebarMuted/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-bodyText" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">New Investor</h1>
          <p className="text-bodyText text-base">Create a new investor profile</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Investor Information">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">
                User *
              </label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
                disabled={loadingUsers}
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText disabled:opacity-50"
              >
                <option value="">
                  {loadingUsers ? 'Loading users...' : 'Select User'}
                </option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              {!loadingUsers && users.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  No users found. Please create a user first or check your permissions.
                </p>
              )}
              <p className="text-xs text-sidebarMuted mt-1">
                Select the user account for this investor. If the user doesn't exist, create one first.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'INDIVIDUAL' | 'COMPANY',
                  })
                }
                required
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>

            {formData.type === 'COMPANY' && (
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  required={formData.type === 'COMPANY'}
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Trade License Number
                </label>
                <input
                  type="text"
                  value={formData.tradeLicenseNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, tradeLicenseNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Tax ID *
                </label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) =>
                    setFormData({ ...formData, taxId: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">
                Payout Frequency *
              </label>
              <select
                value={formData.payoutFrequency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payoutFrequency: e.target.value as 'MONTHLY' | 'QUARTERLY',
                  })
                }
                required
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Banking Information">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">
                Bank Account Name *
              </label>
              <input
                type="text"
                value={formData.bankAccountName}
                onChange={(e) =>
                  setFormData({ ...formData, bankAccountName: e.target.value })
                }
                required
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">
                Bank Name *
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) =>
                  setFormData({ ...formData, bankName: e.target.value })
                }
                required
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  IBAN *
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) =>
                    setFormData({ ...formData, iban: e.target.value.toUpperCase() })
                  }
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  SWIFT Code *
                </label>
                <input
                  type="text"
                  value={formData.swift}
                  onChange={(e) =>
                    setFormData({ ...formData, swift: e.target.value.toUpperCase() })
                  }
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText font-mono"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Investor
          </button>
        </div>
      </form>
    </div>
  )
}

