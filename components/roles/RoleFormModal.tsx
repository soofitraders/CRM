'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { logger } from '@/lib/utils/logger'
import { PermissionModule, PermissionAction } from '@/lib/models/Role'
import {
  getAvailableModules,
  getAvailableActions,
} from '@/lib/services/permissionService'

interface Role {
  _id: string
  name: string
  description?: string
  permissions: Array<{
    module: PermissionModule
    actions: PermissionAction[]
    conditions?: {
      branchRestricted?: boolean
      ownDataOnly?: boolean
    }
  }>
}

interface RoleFormModalProps {
  role: Role | null
  onClose: () => void
  onSuccess: () => void
}

const MODULES = [
  'BOOKINGS',
  'INVOICES',
  'VEHICLES',
  'CUSTOMERS',
  'FINANCIALS',
  'INVESTORS',
  'EXPENSES',
  'REPORTS',
  'USERS',
  'ROLES',
  'MAINTENANCE',
  'DASHBOARD',
] as PermissionModule[]

const ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'EXPORT',
  'APPROVE',
  'MANAGE',
] as PermissionAction[]

export default function RoleFormModal({ role, onClose, onSuccess }: RoleFormModalProps) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
    permissions: role?.permissions || [],
  })
  const [saving, setSaving] = useState(false)

  const handlePermissionChange = (
    module: PermissionModule,
    action: PermissionAction,
    checked: boolean
  ) => {
    setFormData((prev) => {
      const existingPermission = prev.permissions.find((p) => p.module === module)
      const newPermissions = [...prev.permissions]

      if (checked) {
        if (existingPermission) {
          // Add action to existing permission
          existingPermission.actions = [...existingPermission.actions, action]
        } else {
          // Create new permission
          newPermissions.push({
            module,
            actions: [action],
            conditions: {},
          })
        }
      } else {
        if (existingPermission) {
          // Remove action from existing permission
          existingPermission.actions = existingPermission.actions.filter((a) => a !== action)
          // Remove permission if no actions left
          if (existingPermission.actions.length === 0) {
            return {
              ...prev,
              permissions: newPermissions.filter((p) => p.module !== module),
            }
          }
        }
      }

      return {
        ...prev,
        permissions: newPermissions,
      }
    })
  }

  const handleConditionChange = (
    module: PermissionModule,
    condition: 'branchRestricted' | 'ownDataOnly',
    checked: boolean
  ) => {
    setFormData((prev) => {
      const existingPermission = prev.permissions.find((p) => p.module === module)
      const newPermissions = [...prev.permissions]

      if (existingPermission) {
        if (!existingPermission.conditions) {
          existingPermission.conditions = {}
        }
        existingPermission.conditions[condition] = checked
      } else {
        // Create permission with condition
        newPermissions.push({
          module,
          actions: [],
          conditions: { [condition]: checked },
        })
      }

      return {
        ...prev,
        permissions: newPermissions,
      }
    })
  }

  const hasAction = (module: PermissionModule, action: PermissionAction) => {
    const permission = formData.permissions.find((p) => p.module === module)
    return permission?.actions.includes(action) || false
  }

  const hasCondition = (module: PermissionModule, condition: 'branchRestricted' | 'ownDataOnly') => {
    const permission = formData.permissions.find((p) => p.module === module)
    return permission?.conditions?.[condition] || false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = role ? `/api/roles/${role._id}` : '/api/roles'
      const method = role ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions.filter((p) => p.actions.length > 0), // Only include permissions with actions
        }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save role')
      }
    } catch (error) {
      logger.error('Error saving role:', error)
      alert('Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cardBg rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-borderSoft">
          <h2 className="text-2xl font-bold text-headingText">
            {role ? 'Edit Role' : 'Create Role'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-borderSoft rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-headingText mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  required
                  className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText"
                  disabled={!!role}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-headingText mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText"
                />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-semibold text-headingText mb-4">Permissions</h3>
              <div className="space-y-4">
                {MODULES.map((module) => (
                  <div key={module} className="border border-borderSoft rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-headingText">{module}</h4>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={hasCondition(module, 'branchRestricted')}
                            onChange={(e) =>
                              handleConditionChange(module, 'branchRestricted', e.target.checked)
                            }
                            className="rounded"
                          />
                          <span className="text-sidebarMuted">Branch Restricted</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={hasCondition(module, 'ownDataOnly')}
                            onChange={(e) =>
                              handleConditionChange(module, 'ownDataOnly', e.target.checked)
                            }
                            className="rounded"
                          />
                          <span className="text-sidebarMuted">Own Data Only</span>
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {ACTIONS.map((action) => (
                        <label key={action} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasAction(module, action)}
                            onChange={(e) =>
                              handlePermissionChange(module, action, e.target.checked)
                            }
                            className="rounded"
                          />
                          <span className="text-sm text-bodyText">{action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-4 p-6 border-t border-borderSoft">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.name}
            className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Role
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

