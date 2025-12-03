'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { Plus, Edit, Trash2, Shield, Loader2 } from 'lucide-react'
import RoleFormModal from '@/components/roles/RoleFormModal'
import { PermissionModule, PermissionAction } from '@/lib/models/Role'

interface Role {
  _id: string
  name: string
  description?: string
  isSystemRole: boolean
  permissions: Array<{
    module: PermissionModule
    actions: PermissionAction[]
    conditions?: {
      branchRestricted?: boolean
      ownDataOnly?: boolean
    }
  }>
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
}

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles')
      if (response.ok) {
        const data = await response.json()
        setRoles(data.roles || [])
      } else {
        alert('Failed to fetch roles')
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
      alert('Failed to fetch roles')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingRole(null)
    setShowFormModal(true)
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setShowFormModal(true)
  }

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchRoles()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete role')
      }
    } catch (error) {
      console.error('Error deleting role:', error)
      alert('Failed to delete role')
    }
  }

  const handleFormSuccess = () => {
    setShowFormModal(false)
    setEditingRole(null)
    fetchRoles()
  }

  const getPermissionSummary = (permissions: Role['permissions']) => {
    const moduleCount = permissions.length
    const totalActions = permissions.reduce((sum, p) => sum + p.actions.length, 0)
    return `${moduleCount} module(s), ${totalActions} permission(s)`
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
          <h1 className="text-3xl font-bold text-headingText">Role Management</h1>
          <p className="text-bodyText mt-2">Create and manage custom roles with granular permissions</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Role
        </button>
      </div>

      <SectionCard>
        <Table
          headers={['Role Name', 'Description', 'Type', 'Permissions', 'Created By', 'Actions']}
        >
          {roles.map((role) => (
            <TableRow key={role._id}>
              <TableCell className="font-semibold text-headingText">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {role.name}
                </div>
              </TableCell>
              <TableCell className="text-bodyText">
                {role.description || '—'}
              </TableCell>
              <TableCell>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    role.isSystemRole
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {role.isSystemRole ? 'System' : 'Custom'}
                </span>
              </TableCell>
              <TableCell className="text-sm text-sidebarMuted">
                {getPermissionSummary(role.permissions)}
              </TableCell>
              <TableCell className="text-sm">
                {role.createdBy?.name || '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {!role.isSystemRole && (
                    <>
                      <button
                        onClick={() => handleEdit(role)}
                        className="p-2 text-sidebarActiveBg hover:bg-sidebarActiveBg/10 rounded"
                        title="Edit role"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(role._id, role.name)}
                        className="p-2 text-danger hover:bg-danger/10 rounded"
                        title="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {role.isSystemRole && (
                    <span className="text-xs text-sidebarMuted">System role</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </SectionCard>

      {showFormModal && (
        <RoleFormModal
          role={editingRole}
          onClose={() => {
            setShowFormModal(false)
            setEditingRole(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}

