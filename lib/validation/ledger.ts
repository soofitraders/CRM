import { z } from 'zod'

export const MANUAL_ENTRY_TYPES = [
  'BANK_DEPOSIT',
  'BANK_WITHDRAWAL',
  'BANK_TRANSFER_INTERNAL',
  'LOAN_RECEIVED',
  'LOAN_REPAYMENT',
  'VENDOR_PAYMENT',
  'FUEL_EXPENSE',
  'INSURANCE_PREMIUM',
  'REGISTRATION_FEE',
  'MISCELLANEOUS_INCOME',
  'MISCELLANEOUS_EXPENSE',
  'OPENING_BALANCE',
  'BALANCE_ADJUSTMENT',
] as const

export const manualLedgerSchema = z
  .object({
    date: z.string().min(1),
    valueDate: z.string().optional(),
    entryType: z.enum(MANUAL_ENTRY_TYPES),
    direction: z.enum(['CREDIT', 'DEBIT', 'INTERNAL']),
    amount: z.number().positive(),
    description: z.string().min(3),
    accountType: z.enum(['CASH', 'BANK', 'MOBILE_WALLET', 'OTHER']),
    accountLabel: z.string().min(1),
    bankName: z.string().optional(),
    transferToAccount: z.string().optional(),
    transferFromAccount: z.string().optional(),
    note: z.string().optional(),
    tags: z.array(z.string()).optional(),
    bookingId: z.string().optional(),
    customerId: z.string().optional(),
    vehicleId: z.string().optional(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.entryType === 'BALANCE_ADJUSTMENT' && !val.note?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'note is required for BALANCE_ADJUSTMENT' })
    }
    if (val.entryType === 'BANK_TRANSFER_INTERNAL') {
      if (!val.transferFromAccount) {
        ctx.addIssue({ code: 'custom', path: ['transferFromAccount'], message: 'transferFromAccount is required' })
      }
      if (!val.transferToAccount) {
        ctx.addIssue({ code: 'custom', path: ['transferToAccount'], message: 'transferToAccount is required' })
      }
    }
  })

export const ledgerVoidSchema = z.object({
  voidReason: z.string().min(3),
})

export const ledgerReconcileSchema = z.object({
  isReconciled: z.boolean().optional().default(true),
})

