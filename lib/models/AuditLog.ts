import mongoose, { Schema, Document, Model } from 'mongoose'

export type AuditType =
  | 'FINANCIAL_TRANSACTION'
  | 'PAYMENT_PROCESSED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_PAID'
  | 'INVOICE_DELETED'
  | 'BULK_DELETE'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_MODIFIED'
  | 'INVESTOR_PAYOUT'
  | 'SALARY_PAYMENT'
  | 'REFUND_PROCESSED'
  | 'PERMISSION_CHANGE'
  | 'ROLE_MODIFIED'
  | 'USER_ACCESS_CHANGE'
  | 'DATA_EXPORT'
  | 'SENSITIVE_DATA_ACCESS'
  | 'SYSTEM_CONFIG_CHANGE'

export interface IAuditLog extends Document {
  user: mongoose.Types.ObjectId
  auditType: AuditType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  entityType?: string
  entityId?: mongoose.Types.ObjectId
  financialAmount?: number
  currency?: string
  beforeState?: any
  afterState?: any
  metadata?: {
    ipAddress?: string
    userAgent?: string
    branchId?: string
    transactionId?: string
    referenceNumber?: string
    [key: string]: any
  }
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    auditType: {
      type: String,
      enum: [
        'FINANCIAL_TRANSACTION',
        'PAYMENT_PROCESSED',
        'INVOICE_ISSUED',
        'INVOICE_PAID',
        'INVOICE_DELETED',
        'BULK_DELETE',
        'EXPENSE_CREATED',
        'EXPENSE_MODIFIED',
        'INVESTOR_PAYOUT',
        'SALARY_PAYMENT',
        'REFUND_PROCESSED',
        'PERMISSION_CHANGE',
        'ROLE_MODIFIED',
        'USER_ACCESS_CHANGE',
        'DATA_EXPORT',
        'SENSITIVE_DATA_ACCESS',
        'SYSTEM_CONFIG_CHANGE',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      default: 'MEDIUM',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    financialAmount: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    beforeState: {
      type: Schema.Types.Mixed,
    },
    afterState: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Create indexes
AuditLogSchema.index({ user: 1, createdAt: -1 })
AuditLogSchema.index({ auditType: 1, createdAt: -1 })
AuditLogSchema.index({ severity: 1, createdAt: -1 })
AuditLogSchema.index({ entityType: 1, entityId: 1 })
AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ financialAmount: 1 })
AuditLogSchema.index({ 'metadata.transactionId': 1 })

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)

export default AuditLog

