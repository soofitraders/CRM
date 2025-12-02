import mongoose, { Schema, Document, Model } from 'mongoose'

export type PermissionAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE' | 'MANAGE'
export type PermissionModule =
  | 'BOOKINGS'
  | 'INVOICES'
  | 'VEHICLES'
  | 'CUSTOMERS'
  | 'FINANCIALS'
  | 'INVESTORS'
  | 'EXPENSES'
  | 'REPORTS'
  | 'USERS'
  | 'ROLES'
  | 'MAINTENANCE'
  | 'DASHBOARD'

export interface IPermission {
  module: PermissionModule
  actions: PermissionAction[]
  conditions?: {
    branchRestricted?: boolean
    ownDataOnly?: boolean
    [key: string]: any
  }
}

export interface IRole extends Document {
  name: string
  description?: string
  isSystemRole: boolean // System roles (SUPER_ADMIN, ADMIN, etc.) cannot be modified
  permissions: IPermission[]
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const PermissionSchema = new Schema<IPermission>(
  {
    module: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    actions: {
      type: [String],
      enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE'],
      required: true,
    },
    conditions: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
)

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [PermissionSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
RoleSchema.index({ name: 1 }, { unique: true })
RoleSchema.index({ isSystemRole: 1 })
RoleSchema.index({ createdBy: 1 })

const Role: Model<IRole> = mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema)

export default Role

