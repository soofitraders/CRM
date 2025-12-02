import connectDB from '@/lib/db'
import User from '@/lib/models/User'
import Role, { IPermission, PermissionModule, PermissionAction } from '@/lib/models/Role'
import { UserRole } from '@/lib/models/User'

// System role permissions (default permissions for system roles)
const SYSTEM_ROLE_PERMISSIONS: Record<UserRole, IPermission[]> = {
  SUPER_ADMIN: [
    // SUPER_ADMIN has all permissions
    { module: 'BOOKINGS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'INVOICES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'VEHICLES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'CUSTOMERS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'FINANCIALS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'INVESTORS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'EXPENSES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'REPORTS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'USERS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'ROLES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'MAINTENANCE', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
    { module: 'DASHBOARD', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'] },
  ],
  ADMIN: [
    { module: 'BOOKINGS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE'] },
    { module: 'INVOICES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE'] },
    { module: 'VEHICLES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'] },
    { module: 'CUSTOMERS', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'] },
    { module: 'FINANCIALS', actions: ['CREATE', 'READ', 'UPDATE', 'EXPORT'] },
    { module: 'INVESTORS', actions: ['CREATE', 'READ', 'UPDATE', 'EXPORT'] },
    { module: 'EXPENSES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'] },
    { module: 'REPORTS', actions: ['READ', 'EXPORT'] },
    { module: 'USERS', actions: ['CREATE', 'READ', 'UPDATE'] },
    { module: 'MAINTENANCE', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'] },
    { module: 'DASHBOARD', actions: ['READ'] },
  ],
  MANAGER: [
    { module: 'BOOKINGS', actions: ['CREATE', 'READ', 'UPDATE', 'EXPORT'], conditions: { branchRestricted: true } },
    { module: 'INVOICES', actions: ['CREATE', 'READ', 'UPDATE', 'EXPORT'], conditions: { branchRestricted: true } },
    { module: 'VEHICLES', actions: ['READ', 'UPDATE'], conditions: { branchRestricted: true } },
    { module: 'CUSTOMERS', actions: ['CREATE', 'READ', 'UPDATE'], conditions: { branchRestricted: true } },
    { module: 'FINANCIALS', actions: ['READ', 'EXPORT'], conditions: { branchRestricted: true } },
    { module: 'REPORTS', actions: ['READ', 'EXPORT'], conditions: { branchRestricted: true } },
    { module: 'MAINTENANCE', actions: ['CREATE', 'READ', 'UPDATE'], conditions: { branchRestricted: true } },
    { module: 'DASHBOARD', actions: ['READ'] },
  ],
  SALES_AGENT: [
    { module: 'BOOKINGS', actions: ['CREATE', 'READ', 'UPDATE'], conditions: { ownDataOnly: true } },
    { module: 'INVOICES', actions: ['CREATE', 'READ'], conditions: { ownDataOnly: true } },
    { module: 'VEHICLES', actions: ['READ'] },
    { module: 'CUSTOMERS', actions: ['CREATE', 'READ', 'UPDATE'], conditions: { ownDataOnly: true } },
    { module: 'DASHBOARD', actions: ['READ'] },
  ],
  FINANCE: [
    { module: 'INVOICES', actions: ['CREATE', 'READ', 'UPDATE', 'EXPORT', 'APPROVE'] },
    { module: 'FINANCIALS', actions: ['CREATE', 'READ', 'UPDATE', 'EXPORT'] },
    { module: 'EXPENSES', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'] },
    { module: 'INVESTORS', actions: ['READ', 'UPDATE', 'EXPORT'] },
    { module: 'REPORTS', actions: ['READ', 'EXPORT'] },
    { module: 'DASHBOARD', actions: ['READ'] },
  ],
  INVESTOR: [
    { module: 'INVESTORS', actions: ['READ'], conditions: { ownDataOnly: true } },
    { module: 'DASHBOARD', actions: ['READ'] },
  ],
  CUSTOMER: [
    { module: 'BOOKINGS', actions: ['READ'], conditions: { ownDataOnly: true } },
    { module: 'INVOICES', actions: ['READ'], conditions: { ownDataOnly: true } },
    { module: 'DASHBOARD', actions: ['READ'] },
  ],
}

/**
 * Get user permissions (combines system role and custom role permissions)
 */
export async function getUserPermissions(userId: string): Promise<IPermission[]> {
  await connectDB()

  const user = await User.findById(userId).populate('customRole').lean()
  if (!user) {
    return []
  }

  // If user has a custom role, use its permissions
  if (user.customRole) {
    const customRole = user.customRole as any
    return customRole.permissions || []
  }

  // Otherwise, use system role permissions
  return SYSTEM_ROLE_PERMISSIONS[user.role] || []
}

/**
 * Check if user has permission for a specific action on a module
 */
export async function hasPermission(
  userId: string,
  module: PermissionModule,
  action: PermissionAction,
  context?: {
    branchId?: string
    entityUserId?: string
    [key: string]: any
  }
): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  const user = await User.findById(userId).lean()
  if (!user) return false

  // SUPER_ADMIN always has all permissions
  if (user.role === 'SUPER_ADMIN') {
    return true
  }

  // Find permission for the module
  const modulePermission = permissions.find((p) => p.module === module)
  if (!modulePermission) {
    return false
  }

  // Check if action is allowed
  if (!modulePermission.actions.includes(action)) {
    return false
  }

  // Check conditions
  if (modulePermission.conditions) {
    // Branch restriction
    if (modulePermission.conditions.branchRestricted && context?.branchId) {
      if (user.branchId && user.branchId !== context.branchId) {
        return false
      }
    }

    // Own data only
    if (modulePermission.conditions.ownDataOnly && context?.entityUserId) {
      if (userId !== context.entityUserId.toString()) {
        return false
      }
    }
  }

  return true
}

/**
 * Check if user can access a specific resource
 */
export async function canAccessResource(
  userId: string,
  module: PermissionModule,
  action: PermissionAction,
  resource?: {
    branchId?: string
    userId?: string
    [key: string]: any
  }
): Promise<boolean> {
  return hasPermission(userId, module, action, {
    branchId: resource?.branchId,
    entityUserId: resource?.userId,
  })
}

/**
 * Get all available modules
 */
export function getAvailableModules(): PermissionModule[] {
  return [
    'BOOKINGS',
    'INVOICES',
    'VEHICLES',
    'CUSTOMERS',
    'FINANCIALS',
    'INVESTORS',
    'EXPENSES',
    'REPORTS',
    'USERS',
    'ROLES',
    'MAINTENANCE',
    'DASHBOARD',
  ]
}

/**
 * Get all available actions
 */
export function getAvailableActions(): PermissionAction[] {
  return ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE']
}

