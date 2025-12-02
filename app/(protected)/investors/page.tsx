'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { Search, Plus, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

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
  taxId: string
  bankName: string
  payoutFrequency: 'MONTHLY' | 'QUARTERLY'
  createdAt: string
}

export default function InvestorsPage() {
  const router = useRouter()
  const [investors, setInvestors] = useState<Investor[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchInvestors()
  }, [])

  const fetchInvestors = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/investors')
      if (response.ok) {
        const data = await response.json()
        setInvestors(data.investors || [])
      }
    } catch (error) {
      console.error('Error fetching investors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (investorId: string) => {
    if (!confirm('Are you sure you want to delete this investor?')) {
      return
    }

    try {
      const response = await fetch(`/api/investors/${investorId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchInvestors()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete investor')
      }
    } catch (error) {
      console.error('Error deleting investor:', error)
      alert('Failed to delete investor')
    }
  }

  const filteredInvestors = investors.filter((investor) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      investor.user.name.toLowerCase().includes(searchLower) ||
      investor.user.email.toLowerCase().includes(searchLower) ||
      investor.taxId.toLowerCase().includes(searchLower) ||
      (investor.companyName && investor.companyName.toLowerCase().includes(searchLower))
    )
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Investors</h1>
          <p className="text-bodyText mt-2">Manage investor profiles</p>
        </div>
        <Link
          href="/investors/new"
          className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Investor
        </Link>
      </div>

      {/* Investors List */}
      <SectionCard
        title="All Investors"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sidebarMuted" />
              <input
                type="text"
                placeholder="Search investors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg"
              />
            </div>
          </div>
        }
      >
        {isLoading ? (
          <div className="text-center py-8 text-bodyText">Loading investors...</div>
        ) : filteredInvestors.length === 0 ? (
          <div className="text-center py-8 text-sidebarMuted">
            {search ? 'No investors found matching your search' : 'No investors found. Create your first investor.'}
          </div>
        ) : (
          <Table
            headers={['Name', 'Type', 'Company', 'Tax ID', 'Bank', 'Payout Frequency', 'Actions']}
          >
            {filteredInvestors.map((investor) => (
              <TableRow key={investor._id}>
                <TableCell>
                  <div>
                    <div className="font-medium text-headingText">{investor.user.name}</div>
                    <div className="text-sm text-sidebarMuted">{investor.user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-cardBg border border-borderSoft rounded text-sm text-bodyText">
                    {investor.type}
                  </span>
                </TableCell>
                <TableCell className="text-bodyText">
                  {investor.companyName || 'N/A'}
                </TableCell>
                <TableCell className="text-bodyText font-mono text-sm">
                  {investor.taxId}
                </TableCell>
                <TableCell className="text-bodyText">{investor.bankName}</TableCell>
                <TableCell className="text-bodyText">
                  <span className="px-2 py-1 bg-cardBg border border-borderSoft rounded text-sm">
                    {investor.payoutFrequency}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/investors/${investor._id}`}
                      className="p-1.5 hover:bg-sidebarMuted/10 rounded transition-colors"
                      title="View/Edit"
                    >
                      <Edit className="w-4 h-4 text-bodyText" />
                    </Link>
                    <button
                      onClick={() => handleDelete(investor._id)}
                      className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </SectionCard>
    </div>
  )
}

