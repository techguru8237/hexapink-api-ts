import mongoose, { Document, Model } from 'mongoose';

export interface IFile extends Document {
  user: mongoose.Schema.Types.ObjectId;
  title: string;
  type: string;
  countries: string[];
  collectionId?: mongoose.Schema.Types.ObjectId;
  image?: string;
  unitPrice?: number;
  volume?: number;
  columns?: Record<string, any>;
  status: 'Ready' | 'Waiting';
  path?: string;
  orderId?: mongoose.Schema.Types.ObjectId;
}

interface IFileModel extends Model<IFile> {}

const fileSchema = new mongoose.Schema<IFile>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
      index: true,
    },
    type: { type: String, required: true, index: true }, // Add index to type
    countries: { type: [String], required: true, index: true }, // Add index to countries
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    image: { type: String },
    unitPrice: {
      type: Number,
      min: [0, "Unit price must be a positive number"],
    },
    volume: { type: Number, index: true }, // Add index to volume
    columns: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['Ready', 'Waiting'], default: 'Waiting', index: true }, // Add index to status
    path: { type: String },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // Add orderId field
  },
  { timestamps: true }
);

// Compound index to improve performance on common query patterns
fileSchema.index({ user: 1, title: 1 });

export const File: IFileModel = mongoose.model<IFile, IFileModel>('File', fileSchema);
