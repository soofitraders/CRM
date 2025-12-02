import connectDB from '@/lib/db'
import Notification, { NotificationType } from '@/lib/models/Notification'
import { sendNotificationEmail } from './emailService'

interface CreateNotificationParams {
  userId: string | string[]
  type: NotificationType
  title: string
  message: string
  data?: any
  sendEmail?: boolean
}

/**
 * Create a notification for one or more users
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  await connectDB()

  const userIds = Array.isArray(params.userId) ? params.userId : [params.userId]
  const sendEmail = params.sendEmail !== false // Default to true

  // Create notifications in bulk
  const notifications = userIds.map((userId) => ({
    user: userId,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data,
    read: false,
  }))

  await Notification.insertMany(notifications)

  // Send email notifications if enabled
  if (sendEmail) {
    for (const userId of userIds) {
      try {
        await sendNotificationEmail(userId, {
          title: params.title,
          message: params.message,
          type: params.type,
        })
      } catch (error) {
        console.error(`Failed to send email notification to user ${userId}:`, error)
        // Continue with other users even if one fails
      }
    }
  }
}

/**
 * Create a notification for admins/managers
 */
export async function createAdminNotification(
  params: Omit<CreateNotificationParams, 'userId'> & {
    roles?: string[]
  }
): Promise<void> {
  await connectDB()

  const { User } = await import('@/lib/models/User')
  const UserModel = User

  // Find admin users
  const adminRoles = params.roles || ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
  const adminUsers = await UserModel.find({
    role: { $in: adminRoles },
    status: 'ACTIVE',
  })
    .select('_id')
    .lean()

  if (adminUsers.length === 0) {
    console.warn('No admin users found for notification')
    return
  }

  const userIds = adminUsers.map((user) => user._id.toString())
  await createNotification({
    ...params,
    userId: userIds,
  })
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  await connectDB()
  return Notification.countDocuments({
    user: userId,
    read: false,
  })
}

