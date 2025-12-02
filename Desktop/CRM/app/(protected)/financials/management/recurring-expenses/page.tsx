'use client'

import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import ReportExportButton from '@/components/export/ReportExportButton'
import { Plus, X, Edit, Trash2, Calendar, Bell, History, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface RecurringExpense {
  _id: string
  category: {
    _id: string
    name: string
    type: 'COGS' | 'OPEX'
    code?: string
  }
  description: string
  amount: number
  currency: string
  interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  startDate: string
  nextDueDate: string
  endDate?: string
  branchId?: string
  isActive: boolean
  reminderDaysBefore: number
  lastProcessedDate?: string
  totalOccurrences?: number
  currentOccurrence: number
  notes?: string
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
}

interface ExpenseCategory {
  _id: string
  name: string
  code: string
  type: 'COGS' | 'OPEX'
  isActive: boolean
}

export default function RecurringExpensesPage() {
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upcomingExpenses, setUpcomingExpenses] = useState<RecurringExpense[]>([])

  // Filters
  const [isActiveFilter, setIsActiveFilter] = useState<string>('true')
  const [branchId, setBranchId] = useState<string>('')

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null)
  const [viewingHistory, setViewingHistory] = useState<string | null>(null)
  const [expenseHistory, setExpenseHistory] = useState<any[]>([])
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    currency: 'AED',
    interval: 'MONTHLY' as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    branchId: '',
    reminderDaysBefore: '3',
    totalOccurrences: '',
    notes: '',
  })

  useEffect(() => {
    fetchRecurringExpenses()
    fetchCategories()
    fetchUpcomingExpenses()
  }, [isActiveFilter, branchId])

  const fetchRecurringExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (isActiveFilter !== '') params.append('isActive', isActiveFilter)
      if (branchId) params.append('branchId', branchId)

      const response = await fetch(`/api/recurring-expenses?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch recurring expenses')

      const data = await response.json()
      setRecurringExpenses(data.recurringExpenses || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load recurring expenses')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/expense-categories')
      if (!response.ok) throw new Error('Failed to fetch categories')

      const data = await response.json()
      setCategories(data.categories || [])
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  const fetchUpcomingExpenses = async () => {
    try {
      const response = await fetch('/api/recurring-expenses/upcoming?daysAhead=7')
      if (response.ok) {
        const data = await response.json()
        setUpcomingExpenses(data.upcomingExpenses || [])
      }
    } catch (err) {
      console.error('Failed to load upcoming expenses:', err)
    }
  }

  const fetchExpenseHistory = async (id: string) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${id}/history`)
      if (!response.ok) throw new Error('Failed to fetch history')

      const data = await response.json()
      setExpenseHistory(data.history || [])
    } catch (err: any) {
      alert(err.message || 'Failed to load expense history')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingExpense
        ? `/api/recurring-expenses/${editingExpense._id}`
        : '/api/recurring-expenses'
      const method = editingExpense ? 'PATCH' : 'POST'

      const payload: any = {
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        interval: formData.interval,
        startDate: formData.startDate,
        reminderDaysBefore: parseInt(formData.reminderDaysBefore),
      }

      if (formData.endDate) payload.endDate = formData.endDate
      if (formData.branchId) payload.branchId = formData.branchId
      if (formData.totalOccurrences) payload.totalOccurrences = parseInt(formData.totalOccurrences)
      if (formData.notes) payload.notes = formData.notes

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save recurring expense')
      }

      setShowForm(false)
      setEditingExpense(null)
      resetForm()
      fetchRecurringExpenses()
      fetchUpcomingExpenses()
    } catch (err: any) {
      alert(err.message || 'Failed to save recurring expense')
    }
  }

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense)
    setFormData({
      category: expense.category._id,
      description: expense.description,
      amount: expense.amount.toString(),
      currency: expense.currency,
      interval: expense.interval,
      startDate: format(new Date(expense.startDate), 'yyyy-MM-dd'),
      endDate: expense.endDate ? format(new Date(expense.endDate), 'yyyy-MM-dd') : '',
      branchId: expense.branchId || '',
      reminderDaysBefore: expense.reminderDaysBefore.toString(),
      totalOccurrences: expense.totalOccurrences?.toString() || '',
      notes: expense.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring expense?')) return

    try {
      const response = await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete recurring expense')

      fetchRecurringExpenses()
    } catch (err: any) {
      alert(err.message || 'Failed to delete recurring expense')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/recurring-expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (!response.ok) throw new Error('Failed to update status')

      fetchRecurringExpenses()
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    }
  }

  const resetForm = () => {
    setFormData({
      category: '',
      description: '',
      amount: '',
      currency: 'AED',
      interval: 'MONTHLY',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      branchId: '',
      reminderDaysBefore: '3',
      totalOccurrences: '',
      notes: '',
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getDaysUntilDue = (nextDueDate: string) => {
    const due = new Date(nextDueDate)
    const today = new Date()
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sidebarActiveBg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Recurring Expenses</h1>
          <p className="text-bodyText mt-2">Manage automated recurring expenses</p>
        </div>
        <div className="flex gap-2">
          <ReportExportButton
            module="recurring-expenses"
            filters={{
              isActive: isActiveFilter,
              ...(branchId && { branchId }),
            }}
          />
          <button
            onClick={() => {
              resetForm()
              setEditingExpense(null)
              setShowForm(true)
            }}
            className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Recurring Expense
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Upcoming Expenses Alert */}
      {upcomingExpenses.length > 0 && (
        <SectionCard>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-headingText">Upcoming Expenses (Next 7 Days)</h3>
          </div>
          <div className="space-y-2">
            {upcomingExpenses.map((expense) => {
              const daysUntil = getDaysUntilDue(expense.nextDueDate)
              return (
                <div
                  key={expense._id}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-headingText">{expense.description}</p>
                    <p className="text-sm text-bodyText">
                      {formatCurrency(expense.amount, expense.currency)} • Due in {daysUntil} day{daysUntil !== 1 ? 's' : ''} • {format(new Date(expense.nextDueDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-headingText">{formatCurrency(expense.amount, expense.currency)}</p>
                    <p className="text-xs text-sidebarMuted">{expense.interval}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Filters */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Status</label>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Branch</label>
            <input
              type="text"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="All branches"
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
        </div>
      </SectionCard>

      {/* Recurring Expenses Table */}
      <SectionCard>
        <Table
          headers={[
            'Description',
            'Category',
            'Amount',
            'Interval',
            'Next Due',
            'Occurrences',
            'Status',
            'Actions',
          ]}
        >
          {recurringExpenses.map((expense) => {
            const daysUntil = getDaysUntilDue(expense.nextDueDate)
            return (
              <TableRow key={expense._id}>
                <TableCell>
                  <div>
                    <div className="font-medium text-headingText">{expense.description}</div>
                    {expense.notes && (
                      <div className="text-xs text-sidebarMuted mt-1">{expense.notes}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{expense.category.name}</div>
                    <div className="text-xs text-sidebarMuted">{expense.category.type}</div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(expense.amount, expense.currency)}
                </TableCell>
                <TableCell>{expense.interval}</TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{format(new Date(expense.nextDueDate), 'MMM dd, yyyy')}</div>
                    <div className={`text-xs ${daysUntil <= 3 ? 'text-red-600 font-medium' : daysUntil <= 7 ? 'text-yellow-600' : 'text-sidebarMuted'}`}>
                      {daysUntil > 0 ? `${daysUntil} days` : daysUntil === 0 ? 'Due today' : 'Overdue'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {expense.currentOccurrence}
                  {expense.totalOccurrences ? ` / ${expense.totalOccurrences}` : ' / ∞'}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleActive(expense._id, expense.isActive)}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                      expense.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {expense.isActive ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Inactive
                      </>
                    )}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setViewingHistory(expense._id)
                        fetchExpenseHistory(expense._id)
                      }}
                      className="p-1 text-sidebarMuted hover:text-sidebarActiveBg"
                      title="View History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(expense)}
                      className="p-1 text-sidebarMuted hover:text-sidebarActiveBg"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense._id)}
                      className="p-1 text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </Table>
      </SectionCard>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-pageBg rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-headingText">
                {editingExpense ? 'Edit' : 'Add'} Recurring Expense
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingExpense(null)
                  resetForm()
                }}
                className="text-sidebarMuted hover:text-headingText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name} ({cat.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Interval *
                  </label>
                  <select
                    value={formData.interval}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interval: e.target.value as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
                      })
                    }
                    required
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Reminder Days Before
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reminderDaysBefore}
                    onChange={(e) =>
                      setFormData({ ...formData, reminderDaysBefore: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">
                    Total Occurrences (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalOccurrences}
                    onChange={(e) =>
                      setFormData({ ...formData, totalOccurrences: e.target.value })
                    }
                    placeholder="Unlimited if empty"
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Branch ID</label>
                <input
                  type="text"
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
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

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingExpense(null)
                    resetForm()
                  }}
                  className="px-4 py-2 bg-cardBg border border-borderSoft rounded text-bodyText hover:bg-borderSoft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sidebarActiveBg text-white rounded hover:bg-sidebarActiveBg/90"
                >
                  {editingExpense ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-pageBg rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-headingText">Expense History</h2>
              <button
                onClick={() => {
                  setViewingHistory(null)
                  setExpenseHistory([])
                }}
                className="text-sidebarMuted hover:text-headingText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Table headers={['Date', 'Amount', 'Category', 'Status']}>
              {expenseHistory.map((expense: any) => (
                <TableRow key={expense._id}>
                  <TableCell>
                    {format(new Date(expense.dateIncurred), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(expense.amount, expense.currency)}
                  </TableCell>
                  <TableCell>{expense.category?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      Processed
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {expenseHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sidebarMuted">
                    No expense history found
                  </TableCell>
                </TableRow>
              )}
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}

