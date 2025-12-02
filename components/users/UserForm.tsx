'use client'

import { useState, useEffect } from 'react'

interface User {
  _id: string
  name: string
  email: string
  role: string
  status: string
}

interface UserFormProps {
  user?: User | null
  onSuccess: () => void
  onCancel: () => void
}

export default function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'MANAGER',
    status: 'ACTIVE',
    tempPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        tempPassword: '',
      })
    }
  }, [user])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({ ...prev, tempPassword: password }))
    setGeneratedPassword(password)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const url = user ? `/api/users/${user._id}` : '/api/users'
      const method = user ? 'PATCH' : 'POST'

      // For updates, only send changed fields
      const payload = user
        ? {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            status: formData.status,
          }
        : {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            status: formData.status,
            tempPassword: formData.tempPassword || undefined,
          }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        // If password was generated, show it
        if (data.user?.tempPassword) {
          setGeneratedPassword(data.user.tempPassword)
          alert(
            `User ${user ? 'updated' : 'created'} successfully!\n\nGenerated Password: ${data.user.tempPassword}\n\nPlease save this password and share it with the user securely.`
          )
        }
        onSuccess()
      } else {
        setError(data.error || 'Failed to save user')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to save user')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {generatedPassword && !user && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-500 font-medium mb-2">Password Generated:</p>
          <p className="text-bodyText font-mono text-sm break-all">{generatedPassword}</p>
          <p className="text-sm text-sidebarMuted mt-2">
            Please save this password and share it with the user securely.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-headingText mb-2">
          Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-headingText mb-2">
          Email *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-headingText mb-2">
          Role *
        </label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
        >
          <option value="MANAGER">Manager</option>
          <option value="SALES_AGENT">Sales Agent</option>
          <option value="FINANCE">Finance</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <p className="text-xs text-sidebarMuted mt-1">
          Note: CUSTOMER and INVESTOR roles cannot be created through this form
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-headingText mb-2">
          Status *
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {!user && (
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Temporary Password
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="tempPassword"
              value={formData.tempPassword}
              onChange={handleChange}
              placeholder="Leave blank to auto-generate"
              minLength={8}
              className="flex-1 px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            <button
              type="button"
              onClick={generatePassword}
              className="px-4 py-2 bg-borderSoft hover:bg-borderSoft/80 rounded-lg text-bodyText text-sm font-medium transition-colors"
            >
              Generate
            </button>
          </div>
          <p className="text-xs text-sidebarMuted mt-1">
            Leave blank to auto-generate a secure password, or enter a custom password (min 8 characters)
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-borderSoft">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText font-medium hover:bg-borderSoft transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : user ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

