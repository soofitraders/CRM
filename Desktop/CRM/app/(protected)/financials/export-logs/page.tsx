import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { format } from 'date-fns'
import connectDB from '@/lib/db'
import ExportLog from '@/lib/models/ExportLog'

async function ExportLogsList() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = await getCurrentUser()
  if (!user || !hasRole(user, ['SUPER_ADMIN'])) {
    redirect('/dashboard')
  }

  await connectDB()

  const exportLogs = await ExportLog.find({})
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  return (
    <SectionCard title="Export Logs">
      {exportLogs.length === 0 ? (
        <div className="text-center py-8 text-bodyText">No export logs found</div>
      ) : (
        <Table
          headers={['Date', 'User', 'Module', 'Format', 'Row Count', 'Filters']}
        >
          {exportLogs.map((log: any) => (
            <TableRow key={String(log._id)}>
              <TableCell>
                {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium text-headingText">
                    {log.user?.name || 'N/A'}
                  </div>
                  <div className="text-xs text-sidebarMuted">
                    {log.user?.email || ''}
                  </div>
                </div>
              </TableCell>
              <TableCell>{log.module}</TableCell>
              <TableCell>{log.format}</TableCell>
              <TableCell>{log.rowCount}</TableCell>
              <TableCell>
                <div className="max-w-xs truncate text-xs text-sidebarMuted">
                  {JSON.stringify(log.filters || {})}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
    </SectionCard>
  )
}

export default async function ExportLogsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = await getCurrentUser()
  if (!user || !hasRole(user, ['SUPER_ADMIN'])) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-headingText">Export Logs</h1>
        <p className="text-bodyText mt-2">View all data export activities</p>
      </div>

      {/* Export Logs List */}
      <Suspense fallback={<div className="text-bodyText">Loading...</div>}>
        <ExportLogsList />
      </Suspense>
    </div>
  )
}

