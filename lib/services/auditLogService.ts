import connectDB from '@/lib/db'
import AuditLog, { AuditType, IAuditLog } from '@/lib/models/AuditLog'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { logger } from '@/lib/utils/performance'

export interface LogAuditParams {
  auditType: AuditType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  entityType?: string
  entityId?: string
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
  userId?: string // Optional - if not provided, will get from session
}

/**
 * Log audit event (for financial transactions and sensitive operations)
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await connectDB()

    let userId = params.userId

    // If userId not provided, try to get from session
    if (!userId) {
      try {
        const session = await getServerSession(authOptions)
        userId = session?.user?.id
      } catch (error) {
        logger.error('Error getting session for audit log:', error)
      }
    }

    if (!userId) {
      logger.warn('Cannot log audit: No user ID available')
      return
    }

    await AuditLog.create({
      user: userId,
      auditType: params.auditType,
      severity: params.severity,
      title: params.title,
      description: params.description,
      entityType: params.entityType,
      entityId: params.entityId,
      financialAmount: params.financialAmount,
      currency: params.currency || 'AED',
      beforeState: params.beforeState,
      afterState: params.afterState,
      metadata: params.metadata || {},
    })
  } catch (error) {
    // Don't throw - logging should not break the application
    logger.error('Error logging audit:', error)
  }
}

/**
 * Get audit logs
 */
export async function getAuditLogs(
  options?: {
    limit?: number
    userId?: string
    auditType?: AuditType
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    dateFrom?: Date
    dateTo?: Date
    financialOnly?: boolean
  }
): Promise<IAuditLog[]> {
  await connectDB()

  const filter: any = {}

  if (options?.userId) {
    filter.user = options.userId
  }

  if (options?.auditType) {
    filter.auditType = options.auditType
  }

  if (options?.severity) {
    filter.severity = options.severity
  }

  if (options?.financialOnly) {
    filter.financialAmount = { $exists: true, $ne: null }
  }

  if (options?.dateFrom || options?.dateTo) {
    filter.createdAt = {}
    if (options.dateFrom) {
      filter.createdAt.$gte = options.dateFrom
    }
    if (options.dateTo) {
      filter.createdAt.$lte = options.dateTo
    }
  }

  const limit = options?.limit || 100

  return AuditLog.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
}

/**
 * Get financial audit logs
 */
export async function getFinancialAuditLogs(
  options?: {
    limit?: number
    dateFrom?: Date
    dateTo?: Date
    minAmount?: number
  }
): Promise<IAuditLog[]> {
  const filter: any = {
    financialAmount: { $exists: true, $ne: null },
  }

  if (options?.minAmount) {
    filter.financialAmount.$gte = options.minAmount
  }

  return getAuditLogs({
    ...options,
    financialOnly: true,
  })
}

