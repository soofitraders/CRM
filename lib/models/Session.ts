import mongoose, { Schema, Document, Model } from 'mongoose'

export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'LOGGED_OUT'

export interface ISession extends Document {
  _id: string
  userId: mongoose.Types.ObjectId
  sessionToken: string
  refreshToken?: string
  ipAddress?: string
  userAgent?: string
  deviceInfo?: {
    type?: string // 'desktop' | 'mobile' | 'tablet'
    os?: string
    browser?: string
  }
  location?: {
    country?: string
    city?: string
    region?: string
  }
  status: SessionStatus
  lastActivity: Date
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refreshToken: {
      type: String,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    deviceInfo: {
      type: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet'],
      },
      os: String,
      browser: String,
    },
    location: {
      country: String,
      city: String,
      region: String,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'LOGGED_OUT'],
      default: 'ACTIVE',
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for common queries
SessionSchema.index({ userId: 1, status: 1 })
SessionSchema.index({ userId: 1, expiresAt: 1 })
SessionSchema.index({ sessionToken: 1, status: 1 })

// TTL index to automatically delete expired sessions after 30 days
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema)

export default Session

