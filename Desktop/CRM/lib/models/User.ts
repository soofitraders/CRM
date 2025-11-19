import mongoose, { Schema, Document, Model } from 'mongoose'

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'SALES_AGENT' 
  | 'FINANCE' 
  | 'INVESTOR' 
  | 'CUSTOMER'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface IUser extends Document {
  _id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  status: UserStatus
  emailNotifications?: boolean
  smsNotifications?: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: [
        'SUPER_ADMIN',
        'ADMIN',
        'MANAGER',
        'SALES_AGENT',
        'FINANCE',
        'INVESTOR',
        'CUSTOMER',
      ],
      required: [true, 'Role is required'],
      default: 'CUSTOMER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      required: true,
      default: 'ACTIVE',
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
UserSchema.index({ email: 1 }, { unique: true })
UserSchema.index({ role: 1 })
UserSchema.index({ status: 1 })
UserSchema.index({ role: 1, status: 1 }) // Compound index for common queries

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User

