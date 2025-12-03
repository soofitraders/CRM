import connectDB from '@/lib/db'
import ActivityLog, { ActivityType, IActivityLog } from '@/lib/models/ActivityLog'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { logger } from '@/lib/utils/performance'

export interface LogActivityParams {
  activityType: ActivityType
  module: string
  action: string
  description: string
  entityType?: string
  entityId?: string
  changes?: {
    field: string
    oldValue: any
    newValue: any
  }[]
  metadata?: {
    ipAddress?: string
    userAgent?: string
    branchId?: string
    [key: string]: any
  }
  userId?: string // Optional - if not provided, will get from session
}

/**
 * Log user activity
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await connectDB()

    let userId = params.userId

    // If userId not provided, try to get from session
    if (!userId) {
      try {
        const session = await getServerSession(authOptions)
        userId = session?.user?.id
      } catch (error) {
        logger.error('Error getting session for activity log:', error)
      }
    }

    if (!userId) {
      logger.warn('Cannot log activity: No user ID available')
      return
    }

    await ActivityLog.create({
      user: userId,
      activityType: params.activityType,
      module: params.module,
      action: params.action,
      description: params.description,
      entityType: params.entityType,
      entityId: params.entityId,
      changes: params.changes || [],
      metadata: params.metadata || {},
    })
  } catch (error) {
    // Don't throw - logging should not break the application
    logger.error('Error logging activity:', error)
  }
}

/**
 * Get activity logs for a user
 */
export async function getUserActivityLogs(
  userId: string,
  options?: {
    limit?: number
    module?: string
    activityType?: ActivityType
    dateFrom?: Date
    dateTo?: Date
  }
): Promise<IActivityLog[]> {
  await connectDB()

  const filter: any = { user: userId }

  if (options?.module) {
    filter.module = options.module
  }

  if (options?.activityType) {
    filter.activityType = options.activityType
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

  const limit = options?.limit || 50

  return ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean() as unknown as IActivityLog[]
}

/**
 * Get all activity logs (for admins)
 */
export async function getAllActivityLogs(
  options?: {
    limit?: number
    userId?: string
    module?: string
    activityType?: ActivityType
    dateFrom?: Date
    dateTo?: Date
  }
): Promise<IActivityLog[]> {
  await connectDB()

  const filter: any = {}

  if (options?.userId) {
    filter.user = options.userId
  }

  if (options?.module) {
    filter.module = options.module
  }

  if (options?.activityType) {
    filter.activityType = options.activityType
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

  return ActivityLog.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean() as unknown as IActivityLog[]
}

