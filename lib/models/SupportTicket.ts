import mongoose, { Schema, Document, Model } from 'mongoose'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export interface ISupportTicket extends Document {
  user: mongoose.Types.ObjectId
  subject: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  createdAt: Date
  updatedAt: Date
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      required: true,
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      required: true,
      default: 'OPEN',
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
SupportTicketSchema.index({ user: 1 })
SupportTicketSchema.index({ status: 1 })
SupportTicketSchema.index({ priority: 1 })
SupportTicketSchema.index({ createdAt: -1 })

const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema)

export default SupportTicket

