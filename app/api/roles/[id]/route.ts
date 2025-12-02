import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Role from '@/lib/models/Role'
import { z } from 'zod'
import { logActivity } from '@/lib/services/activityLogService'
import { logAudit } from '@/lib/services/auditLogService'
import { logger } from '@/lib/utils/performance'

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  permissions: z
    .array(
      z.object({
        module: z.enum([
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
        ]),
        actions: z.array(
          z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'])
        ),
        conditions: z
          .object({
            branchRestricted: z.boolean().optional(),
            ownDataOnly: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .optional(),
})

// GET - Get single role
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const role = await Role.findById(params.id).populate('createdBy', 'name email').lean()

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json({ role })
  } catch (error: any) {
    logger.error('Error fetching role:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch role' },
      { status: 500 }
    )
  }
}

// PATCH - Update role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const role = await Role.findById(params.id)
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Cannot modify system roles
    if (role.isSystemRole) {
      return NextResponse.json(
        { error: 'Cannot modify system roles' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validationResult = updateRoleSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const oldState = role.toObject()

    // Update role
    if (data.name) {
      // Check if new name conflicts with existing role
      const existingRole = await Role.findOne({
        name: data.name.toUpperCase(),
        _id: { $ne: params.id },
      })
      if (existingRole) {
        return NextResponse.json({ error: 'Role name already exists' }, { status: 400 })
      }
      role.name = data.name.toUpperCase()
    }

    if (data.description !== undefined) {
      role.description = data.description
    }

    if (data.permissions) {
      role.permissions = data.permissions
    }

    await role.save()

    // Log activity and audit
    await logActivity({
      activityType: 'ROLE_UPDATED',
      module: 'ROLES',
      action: 'UPDATE',
      description: `Updated role: ${role.name}`,
      entityType: 'Role',
      entityId: role._id.toString(),
      changes: [
        { field: 'name', oldValue: oldState.name, newValue: role.name },
        { field: 'permissions', oldValue: oldState.permissions, newValue: role.permissions },
      ],
      userId: user._id.toString(),
    })

    await logAudit({
      auditType: 'ROLE_MODIFIED',
      severity: 'HIGH',
      title: 'Role Updated',
      description: `Role "${role.name}" was updated by ${user.name}`,
      entityType: 'Role',
      entityId: role._id.toString(),
      beforeState: oldState,
      afterState: role.toObject(),
      userId: user._id.toString(),
    })

    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'name email')
      .lean()

    return NextResponse.json({ role: populatedRole })
  } catch (error: any) {
    logger.error('Error updating role:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update role' },
      { status: 500 }
    )
  }
}

// DELETE - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const role = await Role.findById(params.id)
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Cannot delete system roles
    if (role.isSystemRole) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 400 }
      )
    }

    // Check if role is assigned to any users
    const User = (await import('@/lib/models/User')).default
    const usersWithRole = await User.countDocuments({ customRole: params.id })
    if (usersWithRole > 0) {
      return NextResponse.json(
        { error: `Cannot delete role: ${usersWithRole} user(s) are assigned this role` },
        { status: 400 }
      )
    }

    const roleName = role.name
    await role.deleteOne()

    // Log activity and audit
    await logActivity({
      activityType: 'ROLE_DELETED',
      module: 'ROLES',
      action: 'DELETE',
      description: `Deleted role: ${roleName}`,
      entityType: 'Role',
      entityId: params.id,
      userId: user._id.toString(),
    })

    await logAudit({
      auditType: 'ROLE_MODIFIED',
      severity: 'HIGH',
      title: 'Role Deleted',
      description: `Role "${roleName}" was deleted by ${user.name}`,
      entityType: 'Role',
      entityId: params.id,
      userId: user._id.toString(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error deleting role:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete role' },
      { status: 500 }
    )
  }
}

