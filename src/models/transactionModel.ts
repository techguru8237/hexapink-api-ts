import mongoose, { Document, Model } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  price: number;
  type: 'Topup' | 'Order' | 'Lookup';
  description?: string;
  paymentmethod: 'Credit Card' | 'Bank Transfer' | 'Balance';
  paymentId?: mongoose.Schema.Types.ObjectId;
  status: 'Completed' | 'Waiting' | 'Free';
  receipts: string[];
}

interface ITransactionModel extends Model<ITransaction> {}

const TransactionSchema = new mongoose.Schema<ITransaction>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model
      required: true,
      index: true, // Add index to userId
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be a positive number"],
      index: true, // Add index to price
    },
    type: {
      type: String,
      enum: ['Topup', 'Order', 'Lookup'], // Transaction types
      default: 'Topup',
      required: true,
      index: true, // Add index to type
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    paymentmethod: {
      type: String,
      enum: ['Credit Card', 'Bank Transfer', 'Balance'], // Payment methods
      default: 'Credit Card',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment', // Reference to the Payment model
    },
    status: {
      type: String,
      enum: ['Completed', 'Waiting', 'Free'], // Transaction status
      default: 'Completed',
      index: true, // Add index to status
    },
    receipts: {
      type: [String], // Array of strings to store file paths
      default: [],
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

TransactionSchema.index({ userId: 1, type: 1 });

export const Transaction: ITransactionModel = mongoose.model<ITransaction, ITransactionModel>(
  'Transaction',
  TransactionSchema
);
