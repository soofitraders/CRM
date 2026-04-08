export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { getCurrentUser, hasRole } from '@/lib/auth'
import ExcelJS from 'exceljs'

const LEDGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'] as const

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    if (!hasRole(user, [...LEDGER_ROLES])) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    await connectDB()
    const entries = await LedgerEntry.find({ isVoided: { $ne: true } })
      .sort({ date: 1, createdAt: 1 })
      .lean()

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('General Ledger')
    ws.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 24 },
      { header: 'Description', key: 'desc', width: 36 },
      { header: 'Category', key: 'cat', width: 20 },
      { header: 'Account', key: 'account', width: 16 },
      { header: 'Debit (AED)', key: 'debit', width: 14 },
      { header: 'Credit (AED)', key: 'credit', width: 14 },
      { header: 'Balance (AED)', key: 'balance', width: 15 },
      { header: 'Reconciled', key: 'reconciled', width: 12 },
      { header: 'Note', key: 'note', width: 28 },
    ]
    const hRow = ws.getRow(1)
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    hRow.alignment = { vertical: 'middle' }

    entries.forEach((e, i) => {
      const row = ws.addRow({
        num: i + 1,
        date: e.date ? new Date(e.date as Date).toLocaleDateString('en-AE') : '',
        type: String(e.entryType ?? '').replace(/_/g, ' '),
        desc: e.description ?? '',
        cat: e.category ?? '',
        account: e.accountLabel ?? 'Cash',
        debit: e.direction === 'DEBIT' ? Number(e.amount) : '',
        credit: e.direction === 'CREDIT' ? Number(e.amount) : '',
        balance: Number(e.runningBalance ?? 0),
        reconciled: e.isReconciled ? 'Yes' : 'No',
        note: e.note ?? '',
      })
      if (e.direction === 'DEBIT') {
        row.getCell('debit').font = { color: { argb: 'FFDC2626' }, bold: true }
      }
      if (e.direction === 'CREDIT') {
        row.getCell('credit').font = { color: { argb: 'FF16A34A' }, bold: true }
      }
      const bal = Number(e.runningBalance ?? 0)
      row.getCell('balance').font = {
        bold: true,
        color: { argb: bal >= 0 ? 'FF166534' : 'FF991B1B' },
      }
    })

    const totalDebit = entries
      .filter((e) => e.direction === 'DEBIT')
      .reduce((a, e) => a + Number(e.amount ?? 0), 0)
    const totalCredit = entries
      .filter((e) => e.direction === 'CREDIT')
      .reduce((a, e) => a + Number(e.amount ?? 0), 0)
    const lastBal =
      entries.length > 0 ? Number(entries[entries.length - 1].runningBalance ?? 0) : 0

    const totalRow = ws.addRow({
      num: '',
      date: 'TOTALS',
      type: '',
      desc: '',
      cat: '',
      account: '',
      debit: totalDebit,
      credit: totalCredit,
      balance: lastBal,
      reconciled: '',
      note: '',
    })
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

    const buffer = await wb.xlsx.writeBuffer()
    const today = new Date().toISOString().split('T')[0]
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ledger-${today}.xlsx"`,
      },
    })
  } catch (error) {
    return new NextResponse(String(error), { status: 500 })
  }
}
