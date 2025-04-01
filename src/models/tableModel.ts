import mongoose, { Document, Model } from 'mongoose';

export interface ITable extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  tableName: string;
  columns: string[];
  leads: number;
  tags: string[];
  file: string;
  delimiter: 'comma' | 'tab' | 'semicolon' | 'pipe';
}

interface ITableModel extends Model<ITable> {}

const TableSchema = new mongoose.Schema<ITable>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tableName: {
      type: String,
      required: [true, "Table name is required"],
      trim: true,
      maxlength: [100, "Table name cannot exceed 100 characters"],
      index: true,
    },
    columns: [
      {
        type: String,
        required: [true, "Column name is required"],
        trim: true,
      },
    ],
    leads: {
      type: Number,
      required: true,
      index: true,
    },
    tags: [
      {
        type: String,
        index: true,
      },
    ],
    file: {
      type: String,
      required: true,
    },
    delimiter: {
      type: String,
      enum: ["comma", "tab", "semicolon", "pipe"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

TableSchema.index({ userId: 1, tableName: 1 });

export const Table: ITableModel = mongoose.model<ITable, ITableModel>('Table', TableSchema);
