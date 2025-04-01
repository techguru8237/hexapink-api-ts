import mongoose, { Document, Model } from 'mongoose';

export interface ICollectionColumn {
  id: number;
  name: string;
  type: string;
  showToClient: boolean;
  isAdditionalFee: boolean;
  additionalFee?: number;
  tableColumns?: {
    tableId?: string;
    tableName?: string;
    tableColumn?: string;
  }[];
  optional?: boolean;
  stepName?: string;
}

export interface ICollection extends Document {
  title: string;
  image?: string;
  type?: string;
  description?: string;
  countries?: string[];
  fee: number;
  discount: number;
  columns: ICollectionColumn[];
  status: 'Active' | 'Inactive';
  featured: boolean;
}

interface ICollectionModel extends Model<ICollection> {}

const CollectionSchema = new mongoose.Schema<ICollection>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
      index: true,
    },
    image: { type: String }, // path or URL
    type: { type: String, index: true }, // Add index to type
    description: { type: String },
    countries: { type: [String], index: true }, // Add index to countries
    fee: {
      type: Number,
      min: [0, "Fee must be a positive number"],
      default: 0,
    },
    discount: { type: Number, default: 0 },
    columns: {
      type: [
        {
          id: { type: Number, required: true },
          name: { type: String, required: true },
          type: { type: String, required: true },
          showToClient: { type: Boolean, default: true },
          isAdditionalFee: { type: Boolean, default: false },
          additionalFee: { type: Number },
          tableColumns: [
            {
              tableId: {
                type: String,
              },
              tableName: {
                type: String,
              },
              tableColumn: {
                type: String,
              },
            },
          ],
          optional: { type: Boolean },
          stepName: { type: String },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true, // Add index to status
    },
    featured: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

CollectionSchema.index({ title: 1, type: 1 });

export const Collection: ICollectionModel = mongoose.model<ICollection, ICollectionModel>(
  'Collection',
  CollectionSchema
);
