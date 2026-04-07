'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { manualLedgerSchema, MANUAL_ENTRY_TYPES } from '@/lib/validation/ledger'
import { z } from 'zod'

type FormValues = z.infer<typeof manualLedgerSchema>

const defaultValues: FormValues = {
  date: new Date().toISOString().slice(0, 10),
  entryType: 'BANK_DEPOSIT',
  direction: 'CREDIT',
  amount: 0.01,
  description: 'Manual entry',
  accountType: 'BANK',
  accountLabel: 'Main account',
  note: '',
  transferFromAccount: '',
  transferToAccount: '',
}

export default function ManualEntryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(manualLedgerSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      form.reset({
        ...defaultValues,
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [open, form])

  const submit = async (values: FormValues) => {
    try {
      const body: FormValues = {
        ...values,
        accountLabel:
          values.entryType === 'BANK_TRANSFER_INTERNAL'
            ? values.transferFromAccount || values.accountLabel
            : values.accountLabel,
      }
      const res = await fetch('/api/ledger/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || 'Failed to create')
      await onCreated()
      onClose()
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Failed to create manual entry',
      })
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-cardBg w-full max-w-2xl rounded-xl border border-borderSoft shadow-lg">
        <div className="px-5 py-4 border-b border-borderSoft flex items-center justify-between">
          <h3 className="text-lg font-semibold text-headingText">Manual ledger entry</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-pageBg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="date"
            className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg"
            {...form.register('date')}
          />
          <select className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg" {...form.register('entryType')}>
            {MANUAL_ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg" {...form.register('direction')}>
            <option value="CREDIT">CREDIT</option>
            <option value="DEBIT">DEBIT</option>
            <option value="INTERNAL">INTERNAL</option>
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg"
            {...form.register('amount', { valueAsNumber: true })}
          />
          <select className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg" {...form.register('accountType')}>
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
            <option value="MOBILE_WALLET">MOBILE_WALLET</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input
            className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg"
            placeholder="Account Label"
            {...form.register('accountLabel')}
          />
          {form.watch('entryType') === 'BANK_TRANSFER_INTERNAL' && (
            <>
              <input
                className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg"
                placeholder="Transfer From"
                {...form.register('transferFromAccount')}
              />
              <input
                className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg"
                placeholder="Transfer To"
                {...form.register('transferToAccount')}
              />
            </>
          )}
          <input
            className="md:col-span-2 px-3 py-2 rounded-lg border border-borderSoft bg-pageBg"
            placeholder="Description"
            {...form.register('description')}
          />
          <textarea
            className="md:col-span-2 px-3 py-2 rounded-lg border border-borderSoft bg-pageBg min-h-24"
            placeholder="Note (required for BALANCE_ADJUSTMENT)"
            {...form.register('note')}
          />
        </div>
        {form.formState.errors.root?.message && (
          <p className="px-5 text-sm text-red-600">{String(form.formState.errors.root.message)}</p>
        )}
        <div className="px-5 py-4 border-t border-borderSoft flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-borderSoft">
            Cancel
          </button>
          <button
            type="button"
            disabled={form.formState.isSubmitting}
            onClick={() => void form.handleSubmit(submit)()}
            className="px-4 py-2 rounded-lg bg-sidebarActiveBg text-white disabled:opacity-50"
          >
            {form.formState.isSubmitting ? 'Saving...' : 'Create Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
