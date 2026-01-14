'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar, { ToolbarGroup } from '@/components/ui/Toolbar'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import ExportButtonGroup from '@/components/export/ExportButtonGroup'
import { Plus, X, Edit, Trash2, Settings } from 'lucide-react'

interface Expense {
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
  dateIncurred: string
  branchId?: string
  salaryRecord?: {
    _id: string
    month: number
    year: number
    staffUser?: {
      name: string
    }
  }
  investorPayout?: {
    _id: string
    periodFrom: string
    periodTo: string
    investor?: {
      user?: {
        name: string
      }
    }
  }
  investor?: {
    _id: string
    user: {
      name: string
      email: string
    }
    companyName?: string
  }
  createdBy: {
    name: string
    email: string
  }
}

interface ExpenseCategory {
  _id: string
  name: string
  code: string
  type: 'COGS' | 'OPEX'
  isActive: boolean
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [categoryId, setCategoryId] = useState<string>('')
  const [branchId, setBranchId] = useState<string>('')

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [investors, setInvestors] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    currency: 'AED',
    dateIncurred: format(new Date(), 'yyyy-MM-dd'),
    branchId: '',
    investor: '',
    vehicle: '',
  })

  useEffect(() => {
    fetchExpenses()
    fetchCategories()
    fetchInvestors()
    fetchVehicles()
  }, [dateFrom, dateTo, categoryId, branchId])

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (categoryId) params.append('categoryId', categoryId)
      if (branchId) params.append('branchId', branchId)

      const response = await fetch(`/api/expenses?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch expenses')

      const data = await response.json()
      setExpenses(data.expenses || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load expenses')
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

  const fetchInvestors = async () => {
    try {
      const response = await fetch('/api/investors')
      if (response.ok) {
        const data = await response.json()
        setInvestors(data.investors || [])
      }
    } catch (err) {
      console.error('Failed to load investors:', err)
    }
  }

  const fetchVehicles = async () => {
    try {
      const response = await fetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles || [])
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingExpense
        ? `/api/expenses/${editingExpense._id}`
        : '/api/expenses'
      const method = editingExpense ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save expense')
      }

      setShowForm(false)
      setEditingExpense(null)
      setFormData({
        category: '',
        description: '',
        amount: '',
        currency: 'AED',
        dateIncurred: format(new Date(), 'yyyy-MM-dd'),
        branchId: '',
        investor: '',
        vehicle: '',
      })
      fetchExpenses()
    } catch (err: any) {
      alert(err.message || 'Failed to save expense')
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      category: expense.category._id,
      description: expense.description,
      amount: expense.amount.toString(),
      currency: expense.currency,
      dateIncurred: format(new Date(expense.dateIncurred), 'yyyy-MM-dd'),
      branchId: expense.branchId || '',
      investor: (expense as any).investor?._id || '',
      vehicle: (expense as any).vehicle?._id || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return

    try {
      const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete expense')

      fetchExpenses()
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense')
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <PageHeader
        title="Expenses"
        subtitle="Manage operational expenses"
        actions={
          <Toolbar>
            <ToolbarGroup>
              <ExportButtonGroup
                module="EXPENSES"
                filters={{
                  dateFrom,
                  dateTo,
                  categoryId,
                  branchId,
                }}
              />
              <button
                onClick={() => setShowCategoryModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10"
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm sm:text-base">Manage Categories</span>
              </button>
              <button
                onClick={() => {
                  setEditingExpense(null)
                  setFormData({
                    category: '',
                    description: '',
                    amount: '',
                    currency: 'AED',
                    dateIncurred: format(new Date(), 'yyyy-MM-dd'),
                    branchId: '',
                    investor: '',
                    vehicle: '',
                  })
                  setShowForm(true)
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm sm:text-base">Add Expense</span>
              </button>
            </ToolbarGroup>
          </Toolbar>
        }
      />

      {/* Filters */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Categories</option>
              {categories
                .filter((cat) => cat.isActive)
                .map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
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

      {/* Expenses Table */}
      <SectionCard>
        {loading ? (
          <div className="py-12 text-center text-bodyText">Loading...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={['Date', 'Category', 'Description', 'Amount', 'Branch', 'Investor', 'Linked To', 'Created By', 'Actions']}
          >
            {expenses.map((expense) => {
              const isSalaryLinked = !!expense.salaryRecord
              const isInvestorPayoutLinked = !!expense.investorPayout
              const isSalariesCategory = expense.category.code === 'SALARIES'
              const isInvestorPayoutCategory = expense.category.code === 'INVESTOR_PAYOUTS'
              const isProtected = isSalaryLinked || isSalariesCategory || isInvestorPayoutLinked || isInvestorPayoutCategory

              return (
                <TableRow key={expense._id}>
                  <TableCell>{format(new Date(expense.dateIncurred), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    {expense.category.name} <span className="text-sidebarMuted">({expense.category.type})</span>
                  </TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>
                    {expense.currency} {expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{expense.branchId || 'N/A'}</TableCell>
                  <TableCell>
                    {(expense as any).investor ? (
                      <span className="text-bodyText">
                        {(expense as any).investor.user.name}
                        {(expense as any).investor.companyName ? ` (${(expense as any).investor.companyName})` : ''}
                      </span>
                    ) : (
                      <span className="text-sidebarMuted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isSalaryLinked && expense.salaryRecord ? (
                      <a
                        href={`/financials/management/salaries`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100"
                      >
                        Salary • {expense.salaryRecord.month}/{expense.salaryRecord.year}
                      </a>
                    ) : isInvestorPayoutLinked && expense.investorPayout ? (
                      <a
                        href={`/financials/management/investor-payouts/${expense.investorPayout._id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100"
                      >
                        Payout • {format(new Date(expense.investorPayout.periodFrom), 'MMM yyyy')}
                      </a>
                    ) : (
                      <span className="text-sidebarMuted">—</span>
                    )}
                  </TableCell>
                  <TableCell>{expense.createdBy.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {isProtected ? (
                        <span className="text-xs text-sidebarMuted italic">
                          {isSalaryLinked || isSalariesCategory
                            ? 'Managed via Salaries'
                            : isInvestorPayoutLinked || isInvestorPayoutCategory
                            ? 'Managed via Investor Payouts'
                            : 'Protected'}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(expense)}
                            className="p-1 text-sidebarActiveBg hover:bg-sidebarMuted/10 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense._id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </Table>
        )}
      </SectionCard>

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg rounded-lg shadow-lg w-full max-w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-borderSoft flex items-center justify-between gap-4">
              <h2 className="text-lg sm:text-xl font-semibold text-headingText break-words min-w-0 flex-1">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingExpense(null)
                }}
                className="text-bodyText hover:text-headingText p-1 flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                >
                  <option value="">Select Category</option>
                  {categories
                    .filter((cat) => cat.isActive && cat.code !== 'SALARIES' && cat.code !== 'INVESTOR_PAYOUTS')
                    .map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name} ({cat.type})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Description *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    min="0"
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Date Incurred *</label>
                  <input
                    type="date"
                    value={formData.dateIncurred}
                    onChange={(e) => setFormData({ ...formData, dateIncurred: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bodyText mb-1">Branch</label>
                  <input
                    type="text"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
              {(() => {
                const selectedCategory = categories.find(cat => cat._id === formData.category)
                const isVehiclePurchase = selectedCategory?.code === 'VEHICLE_PURCHASE'
                
                return (
                  <>
                    {isVehiclePurchase && (
                      <div>
                        <label className="block text-sm font-medium text-bodyText mb-1">Vehicle *</label>
                        <select
                          value={formData.vehicle}
                          onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                          required={isVehiclePurchase}
                          className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                        >
                          <option value="">Select Vehicle</option>
                          {vehicles.map((vehicle) => (
                            <option key={vehicle._id} value={vehicle._id}>
                              {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-sidebarMuted mt-1">
                          Select the vehicle this purchase expense is for
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-bodyText mb-1">Investor (Optional)</label>
                      <select
                        value={formData.investor}
                        onChange={(e) => setFormData({ ...formData, investor: e.target.value })}
                        className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                      >
                        <option value="">Select Investor (Optional)</option>
                        {investors.map((investor) => (
                          <option key={investor._id} value={investor._id}>
                            {investor.user.name} {investor.companyName ? `(${investor.companyName})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )
              })()}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingExpense(null)
                  }}
                  className="px-4 py-2 bg-cardBg border border-borderSoft rounded text-bodyText hover:bg-sidebarMuted/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sidebarActiveBg text-white rounded hover:opacity-90"
                >
                  {editingExpense ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <CategoryManagementModal
          categories={categories}
          onClose={() => {
            setShowCategoryModal(false)
            fetchCategories()
          }}
        />
      )}
    </div>
  )
}

function CategoryManagementModal({
  categories,
  onClose,
}: {
  categories: ExpenseCategory[]
  onClose: () => void
}) {
  const [formData, setFormData] = useState({ name: '', code: '', type: 'OPEX' as 'COGS' | 'OPEX' })
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingCategory
        ? `/api/expense-categories/${editingCategory._id}`
        : '/api/expense-categories'
      const method = editingCategory ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save category')
      }

      setFormData({ name: '', code: '', type: 'OPEX' })
      setEditingCategory(null)
      onClose()
    } catch (err: any) {
      alert(err.message || 'Failed to save category')
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this category?')) return
    try {
      await fetch(`/api/expense-categories/${id}`, { method: 'DELETE' })
      onClose()
    } catch (err) {
      alert('Failed to deactivate category')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cardBg rounded-lg shadow-lg w-full max-w-[calc(100vw-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-borderSoft flex items-center justify-between gap-4">
          <h2 className="text-lg sm:text-xl font-semibold text-headingText break-words min-w-0 flex-1">Manage Categories</h2>
          <button onClick={onClose} className="text-bodyText hover:text-headingText p-1 flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                placeholder="e.g., RENT, FUEL"
                disabled={!!editingCategory}
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText disabled:opacity-50"
              />
              {editingCategory && (
                <p className="text-xs text-sidebarMuted mt-1">Code cannot be changed after creation</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'COGS' | 'OPEX' })}
                required
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              >
                <option value="COGS">COGS (Cost of Goods Sold)</option>
                <option value="OPEX">OPEX (Operating Expense)</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded hover:opacity-90"
            >
              {editingCategory ? 'Update' : 'Create'} Category
            </button>
          </form>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat._id}
                className="flex items-center justify-between p-3 bg-sidebarMuted/5 rounded border border-borderSoft"
              >
                <div>
                  <span className="font-medium text-headingText">{cat.name}</span>
                  <span className="ml-2 text-sm text-sidebarMuted">({cat.type})</span>
                  {!cat.isActive && <span className="ml-2 text-sm text-red-600">(Inactive)</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(cat)
                      setFormData({ name: cat.name, code: cat.code, type: cat.type })
                    }}
                    className="p-1 text-sidebarActiveBg hover:bg-sidebarMuted/10 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {cat.isActive && (
                    <button
                      onClick={() => handleDeactivate(cat._id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

