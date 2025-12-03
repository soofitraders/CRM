import mongoose, { Schema, Document as MongooseDocument, Model } from 'mongoose'

export type DocumentOwnerType = 'VEHICLE' | 'CUSTOMER' | 'INVESTOR' | 'BOOKING' | 'OTHER'

export interface IDocument extends MongooseDocument {
  ownerType: DocumentOwnerType
  ownerId: mongoose.Types.ObjectId
  label: string
  fileUrl: string
  mimeType: string
  uploadedBy: mongoose.Types.ObjectId
  uploadedAt: Date
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

const DocumentSchema = new Schema<IDocument>(
  {
    ownerType: {
      type: String,
      enum: ['VEHICLE', 'CUSTOMER', 'INVESTOR', 'BOOKING', 'OTHER'],
      required: [true, 'Owner type is required'],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Owner ID is required'],
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by user is required'],
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
DocumentSchema.index({ ownerType: 1, ownerId: 1 })
DocumentSchema.index({ uploadedBy: 1 })
DocumentSchema.index({ uploadedAt: -1 })
DocumentSchema.index({ expiresAt: 1 })

const Document: Model<IDocument> = mongoose.models.Document || mongoose.model<IDocument>('Document', DocumentSchema)

export default Document

