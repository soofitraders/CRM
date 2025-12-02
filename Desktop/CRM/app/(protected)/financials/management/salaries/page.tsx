'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Plus, X, Edit, Check, Loader2 } from 'lucide-react'

interface SalaryRecord {
  _id: string
  staffUser: {
    _id: string
    name: string
    email: string
    role: string
  }
  month: number
  year: number
  grossSalary: number
  allowances: number
  deductions: number
  netSalary: number
  status: 'PENDING' | 'PAID'
  paidAt?: string
  notes?: string
  createdBy: {
    name: string
    email: string
  }
}

interface User {
  _id: string
  name: string
  email: string
  role: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([])
  const [staffUsers, setStaffUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<number | ''>('')
  const [staffUser, setStaffUser] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [editingSalary, setEditingSalary] = useState<SalaryRecord | null>(null)
  const [formData, setFormData] = useState({
    staffUser: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    grossSalary: '',
    allowances: '',
    deductions: '',
    netSalary: '',
    branchId: '',
    notes: '',
  })

  useEffect(() => {
    fetchSalaries()
    fetchStaffUsers()
  }, [year, month, staffUser, status])

  const fetchSalaries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('year', year.toString())
      if (month) params.append('month', month.toString())
      if (staffUser) params.append('staffUser', staffUser)
      if (status) params.append('status', status)

      const response = await fetch(`/api/salaries?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch salaries')

      const data = await response.json()
      setSalaries(data.salaries || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load salaries')
    } finally {
      setLoading(false)
    }
  }

  const fetchStaffUsers = async () => {
    try {
      // Fetch users excluding CUSTOMER and INVESTOR roles
      const response = await fetch('/api/users')
      if (!response.ok) return

      const data = await response.json()
      const staff = (data.users || []).filter(
        (u: User) => !['CUSTOMER', 'INVESTOR'].includes(u.role)
      )
      setStaffUsers(staff)
    } catch (err) {
      console.error('Failed to load staff users:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingSalary
        ? `/api/salaries/${editingSalary._id}`
        : '/api/salaries'
      const method = editingSalary ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          grossSalary: parseFloat(formData.grossSalary),
          allowances: parseFloat(formData.allowances || '0'),
          deductions: parseFloat(formData.deductions || '0'),
          netSalary: parseFloat(formData.netSalary),
          branchId: formData.branchId || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save salary record')
      }

      setShowForm(false)
      setEditingSalary(null)
      setFormData({
        staffUser: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        grossSalary: '',
        allowances: '',
        deductions: '',
        netSalary: '',
        branchId: '',
        notes: '',
      })
      fetchSalaries()
    } catch (err: any) {
      alert(err.message || 'Failed to save salary record')
    }
  }

  const handleEdit = (salary: SalaryRecord) => {
    setEditingSalary(salary)
    setFormData({
      staffUser: salary.staffUser._id,
      month: salary.month,
      year: salary.year,
      grossSalary: salary.grossSalary.toString(),
      allowances: salary.allowances?.toString() || '0',
      deductions: salary.deductions?.toString() || '0',
      netSalary: salary.netSalary.toString(),
      branchId: (salary as any).branchId || '',
      notes: salary.notes || '',
    })
    setShowForm(true)
  }

  const handleMarkAsPaid = async (id: string) => {
    try {
      const response = await fetch(`/api/salaries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      })

      if (!response.ok) throw new Error('Failed to mark as paid')

      fetchSalaries()
    } catch (err: any) {
      alert(err.message || 'Failed to mark as paid')
    }
  }

  const calculateNetSalary = () => {
    const gross = parseFloat(formData.grossSalary || '0')
    const allowances = parseFloat(formData.allowances || '0')
    const deductions = parseFloat(formData.deductions || '0')
    const net = gross + allowances - deductions
    setFormData({ ...formData, netSalary: net > 0 ? net.toString() : '0' })
  }

  useEffect(() => {
    if (formData.grossSalary || formData.allowances || formData.deductions) {
      calculateNetSalary()
    }
  }, [formData.grossSalary, formData.allowances, formData.deductions])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Salaries</h1>
          <p className="text-bodyText mt-2">Manage staff salary records</p>
        </div>
        <button
          onClick={() => {
            setEditingSalary(null)
            setFormData({
              staffUser: '',
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              grossSalary: '',
              allowances: '',
              deductions: '',
              netSalary: '',
              notes: '',
            })
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Add Salary Record
        </button>
      </div>

      {/* Filters */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Months</option>
              {MONTHS.map((m, idx) => (
                <option key={idx} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Staff Member</label>
            <select
              value={staffUser}
              onChange={(e) => setStaffUser(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Staff</option>
              {staffUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Salaries Table */}
      <SectionCard>
        {loading ? (
          <div className="py-12 text-center text-bodyText">Loading...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={[
              'Staff',
              'Month',
              'Gross',
              'Allowances',
              'Deductions',
              'Net',
              'Status',
              'Paid At',
              'Actions',
            ]}
          >
            {salaries.map((salary) => (
              <TableRow key={salary._id}>
                <TableCell>
                  {salary.staffUser.name}
                  <div className="text-xs text-sidebarMuted">{salary.staffUser.role}</div>
                </TableCell>
                <TableCell>
                  {MONTHS[salary.month - 1]} {salary.year}
                </TableCell>
                <TableCell>
                  AED {salary.grossSalary.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>
                  AED {salary.allowances?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || '0.00'}
                </TableCell>
                <TableCell>
                  AED {salary.deductions?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || '0.00'}
                </TableCell>
                <TableCell>
                  AED {salary.netSalary.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>
                  <StatusChip
                    status={salary.status}
                    variant={salary.status === 'PAID' ? 'green' : 'yellow'}
                  />
                </TableCell>
                <TableCell>
                  {salary.paidAt
                    ? format(new Date(salary.paidAt), 'MMM dd, yyyy')
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {salary.status === 'PENDING' && (
                      <button
                        onClick={() => handleMarkAsPaid(salary._id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Mark as Paid"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(salary)}
                      className="p-1 text-sidebarActiveBg hover:bg-sidebarMuted/10 rounded"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </SectionCard>

      {/* Salary Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cardBg rounded-lg shadow-lg w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-borderSoft flex items-center justify-between">
              <h2 className="text-xl font-semibold text-headingText">
                {editingSalary ? 'Edit Salary Record' : 'Add Salary Record'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingSalary(null)
                }}
                className="text-bodyText hover:text-headingText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Staff Member *</label>
                  <select
                    value={formData.staffUser}
                    onChange={(e) => setFormData({ ...formData, staffUser: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  >
                    <option value="">Select Staff</option>
                    {staffUsers.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Year *</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    required
                    min="2000"
                    max="2100"
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Month *</label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={idx} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Gross Salary *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.grossSalary}
                    onChange={(e) => setFormData({ ...formData, grossSalary: e.target.value })}
                    required
                    min="0"
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Allowances</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.allowances}
                    onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Deductions</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Net Salary *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netSalary}
                    onChange={(e) => setFormData({ ...formData, netSalary: e.target.value })}
                    required
                    min="0"
                    readOnly
                    className="w-full px-3 py-2 bg-sidebarMuted/10 border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Branch</label>
                <input
                  type="text"
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSalary(null)
                  }}
                  className="px-4 py-2 bg-cardBg border border-borderSoft rounded text-bodyText hover:bg-sidebarMuted/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sidebarActiveBg text-white rounded hover:opacity-90"
                >
                  {editingSalary ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

