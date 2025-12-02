'use client'

import { useState, useEffect } from 'react'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { User, Shield, Eye, Loader2, Filter } from 'lucide-react'
import { format } from 'date-fns'

interface User {
  _id: string
  name: string
  email: string
  role: string
  customRole?: {
    _id: string
    name: string
    permissions: Array<{
      module: string
      actions: string[]
    }>
  }
  branchId?: string
  status: string
}

interface ActivityLog {
  _id: string
  user: {
    name: string
    email: string
  }
  activityType: string
  module: string
  action: string
  description: string
  entityType?: string
  createdAt: string
}

interface AuditLog {
  _id: string
  user: {
    name: string
    email: string
  }
  auditType: string
  severity: string
  title: string
  description: string
  financialAmount?: number
  currency?: string
  createdAt: string
}

export default function PermissionsDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'audit'>('users')

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'users') {
        const response = await fetch('/api/users')
        if (response.ok) {
          const data = await response.json()
          setUsers(data.users || [])
        }
      } else if (activeTab === 'activity') {
        const response = await fetch('/api/activity-logs?limit=50')
        if (response.ok) {
          const data = await response.json()
          setActivityLogs(data.logs || [])
        }
      } else if (activeTab === 'audit') {
        const response = await fetch('/api/audit-logs?limit=50')
        if (response.ok) {
          const data = await response.json()
          setAuditLogs(data.logs || [])
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'LOW':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
      <div>
        <h1 className="text-3xl font-bold text-headingText">Permissions Dashboard</h1>
        <p className="text-bodyText mt-2">View user permissions, activity logs, and audit trails</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-borderSoft">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'users'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Users & Permissions
          </div>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'activity'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Activity Logs
          </div>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'audit'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Audit Logs
          </div>
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <SectionCard>
          <Table
            headers={['User', 'System Role', 'Custom Role', 'Branch', 'Status', 'Permissions']}
          >
            {users.map((user) => (
              <TableRow key={user._id}>
                <TableCell>
                  <div>
                    <div className="font-semibold text-headingText">{user.name}</div>
                    <div className="text-sm text-sidebarMuted">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-sidebarMuted/20 rounded text-xs">
                    {user.role}
                  </span>
                </TableCell>
                <TableCell>
                  {user.customRole ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {user.customRole.name}
                    </span>
                  ) : (
                    <span className="text-sidebarMuted text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.branchId ? (
                    <span className="text-sm">{user.branchId}</span>
                  ) : (
                    <span className="text-sidebarMuted text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      user.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-sidebarMuted">
                  {user.customRole
                    ? `${user.customRole.permissions.length} module(s)`
                    : 'System default'}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'activity' && (
        <SectionCard>
          <Table
            headers={['User', 'Activity', 'Module', 'Description', 'Date']}
          >
            {activityLogs.map((log) => (
              <TableRow key={log._id}>
                <TableCell>
                  <div>
                    <div className="font-semibold text-headingText">{log.user.name}</div>
                    <div className="text-sm text-sidebarMuted">{log.user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-sidebarMuted/20 rounded text-xs">
                    {log.activityType}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{log.module}</TableCell>
                <TableCell className="text-sm text-bodyText">{log.description}</TableCell>
                <TableCell className="text-sm text-sidebarMuted">
                  {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <SectionCard>
          <Table
            headers={['User', 'Type', 'Severity', 'Title', 'Amount', 'Date']}
          >
            {auditLogs.map((log) => (
              <TableRow key={log._id}>
                <TableCell>
                  <div>
                    <div className="font-semibold text-headingText">{log.user.name}</div>
                    <div className="text-sm text-sidebarMuted">{log.user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-sidebarMuted/20 rounded text-xs">
                    {log.auditType}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(log.severity)}`}>
                    {log.severity}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-bodyText">{log.title}</TableCell>
                <TableCell className="text-sm">
                  {log.financialAmount
                    ? `${log.currency || 'AED'} ${log.financialAmount.toLocaleString()}`
                    : '—'}
                </TableCell>
                <TableCell className="text-sm text-sidebarMuted">
                  {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}
    </div>
  )
}

