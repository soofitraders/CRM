'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface Investor {
  _id: string
  user: {
    _id: string
    name: string
    email: string
    phone?: string
  }
  type: 'INDIVIDUAL' | 'COMPANY'
  companyName?: string
  tradeLicenseNumber?: string
  taxId: string
  bankAccountName: string
  bankName: string
  iban: string
  swift: string
  payoutFrequency: 'MONTHLY' | 'QUARTERLY'
}

export default function InvestorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const investorId = params.id as string

  const [investor, setInvestor] = useState<Investor | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
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
    fetchInvestor()
  }, [investorId])

  const fetchInvestor = async () => {
    try {
      const response = await fetch(`/api/investors/${investorId}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch investor')
      }
      const data = await response.json()
      setInvestor(data.investor)
      setFormData({
        type: data.investor.type,
        companyName: data.investor.companyName || '',
        tradeLicenseNumber: data.investor.tradeLicenseNumber || '',
        taxId: data.investor.taxId,
        bankAccountName: data.investor.bankAccountName,
        bankName: data.investor.bankName,
        iban: data.investor.iban,
        swift: data.investor.swift,
        payoutFrequency: data.investor.payoutFrequency,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load investor')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch(`/api/investors/${investorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update investor')
      }

      router.push('/investors')
    } catch (err: any) {
      setError(err.message || 'Failed to update investor')
    } finally {
      setLoading(false)
    }
  }

  if (!investor && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-sidebarActiveBg" />
      </div>
    )
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
          <h1 className="text-4xl font-bold text-headingText mb-2">Edit Investor</h1>
          <p className="text-bodyText text-base">Update investor information</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {investor && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Investor Information">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  User
                </label>
                <input
                  type="text"
                  value={investor.user.name}
                  disabled
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText opacity-60"
                />
                <p className="text-xs text-sidebarMuted mt-1">{investor.user.email}</p>
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
              Update Investor
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

