import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Role, { IPermission } from '@/lib/models/Role'
import { z } from 'zod'
import { logActivity } from '@/lib/services/activityLogService'
import { logAudit } from '@/lib/services/auditLogService'
import { logger } from '@/lib/utils/performance'

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(50),
  description: z.string().optional(),
  permissions: z.array(
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
  ),
})

// GET - List all roles
export async function GET(request: NextRequest) {
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

    const roles = await Role.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ roles })
  } catch (error: any) {
    logger.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

// POST - Create new role
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validationResult = createRoleSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Check if role name already exists
    const existingRole = await Role.findOne({ name: data.name.toUpperCase() })
    if (existingRole) {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 400 })
    }

    const role = await Role.create({
      name: data.name.toUpperCase(),
      description: data.description,
      permissions: data.permissions,
      isSystemRole: false,
      createdBy: user._id,
    })

    // Log activity and audit
    await logActivity({
      activityType: 'ROLE_CREATED',
      module: 'ROLES',
      action: 'CREATE',
      description: `Created new role: ${role.name}`,
      entityType: 'Role',
      entityId: role._id.toString(),
      userId: user._id.toString(),
    })

    await logAudit({
      auditType: 'ROLE_MODIFIED',
      severity: 'HIGH',
      title: 'Role Created',
      description: `Role "${role.name}" was created by ${user.name}`,
      entityType: 'Role',
      entityId: role._id.toString(),
      userId: user._id.toString(),
    })

    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'name email')
      .lean()

    return NextResponse.json({ role: populatedRole }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating role:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create role' },
      { status: 500 }
    )
  }
}

