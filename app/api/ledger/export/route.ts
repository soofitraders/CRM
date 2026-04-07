export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { buildLedgerMatch } from '@/lib/services/ledgerService'
import { exportToExcel } from '@/lib/services/exportService'
import { logger } from '@/lib/utils/performance'
import { format as formatDate } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const direction = searchParams.get('direction') || 'ALL'
    const entryTypeParam = searchParams.get('entryType')
    const entryTypes = entryTypeParam
      ? entryTypeParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined

    const match = buildLedgerMatch({
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      direction: direction === 'ALL' ? undefined : (direction as any),
      entryTypes,
      bookingId: searchParams.get('bookingId') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      vehicleId: searchParams.get('vehicleId') || undefined,
      accountLabel: searchParams.get('accountLabel') || undefined,
      accountType: searchParams.get('accountType') || undefined,
      isVoided: searchParams.get('isVoided') === 'true' ? true : false,
      search: searchParams.get('search') || undefined,
    })

    const entries = await LedgerEntry.find(match)
      .sort({ date: 1, _id: 1 })
      .limit(50000)
      .lean()

    const rows: any[] = entries.map((e) => ({
      date: formatDate(new Date(e.date), 'yyyy-MM-dd'),
      valueDate: e.valueDate ? formatDate(new Date(e.valueDate), 'yyyy-MM-dd') : '',
      type: e.entryType,
      direction: e.direction,
      description: e.description,
      account: e.accountLabel || '',
      amountCr: e.direction === 'CREDIT' ? e.amount : '',
      amountDr: e.direction === 'DEBIT' ? e.amount : '',
      runningBalance: e.runningBalance ?? '',
      reference: `${e.referenceModel ?? ''}:${e.referenceId != null ? String(e.referenceId) : ''}`,
      category: e.category || '',
      bookingId: e.bookingId ? String(e.bookingId) : '',
      customerId: e.customerId ? String(e.customerId) : '',
      vehicleId: e.vehicleId ? String(e.vehicleId) : '',
      reconciled: e.isReconciled ? 'Yes' : 'No',
      note: e.note || '',
    }))

    const columns = [
      { key: 'date' as const, label: 'Date' },
      { key: 'valueDate' as const, label: 'Value Date' },
      { key: 'type' as const, label: 'Type' },
      { key: 'direction' as const, label: 'Direction' },
      { key: 'description' as const, label: 'Description' },
      { key: 'account' as const, label: 'Account' },
      { key: 'amountCr' as const, label: 'Amount (CR)' },
      { key: 'amountDr' as const, label: 'Amount (DR)' },
      { key: 'runningBalance' as const, label: 'Running Balance' },
      { key: 'reference' as const, label: 'Reference' },
      { key: 'category' as const, label: 'Category' },
      { key: 'bookingId' as const, label: 'Booking ID' },
      { key: 'customerId' as const, label: 'Customer ID' },
      { key: 'vehicleId' as const, label: 'Vehicle ID' },
      { key: 'reconciled' as const, label: 'Reconciled' },
      { key: 'note' as const, label: 'Note' },
    ]

    const totalCr = rows.reduce((s, r) => s + (typeof r.amountCr === 'number' ? r.amountCr : 0), 0)
    const totalDr = rows.reduce((s, r) => s + (typeof r.amountDr === 'number' ? r.amountDr : 0), 0)
    rows.push({
      date: '',
      valueDate: '',
      type: '',
      direction: '',
      description: 'TOTAL',
      account: '',
      amountCr: totalCr,
      amountDr: totalDr,
      runningBalance: '',
      reference: '',
      category: '',
      bookingId: '',
      customerId: '',
      vehicleId: '',
      reconciled: '',
      note: '',
    })

    const fileBuffer = await exportToExcel(rows as any, columns as any)
    const filename = `ledger-export-${startDateStr || 'all'}-to-${endDateStr || 'all'}.xlsx`

    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as ArrayBuffer)
    const body = new Uint8Array(buffer)

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error: unknown) {
    console.error('[LEDGER_EXPORT] Error:', error)
    logger.error('Ledger export error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
