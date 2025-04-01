import mongoose, { Document, Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId | string;
  volume: number;
  prix: number;
  paid: string;
  paymentMethod: string;
  receipts: string[];
  files: string[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: String, ref: "User", required: true },
    volume: { type: Number, required: true },
    prix: { type: Number, required: true },
    paid: { type: String, enum: ["Paid", "Unpaid"], default: "Unpaid" },
    paymentMethod: { type: String, required: true },
    receipts: [{ type: String }],
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: "File" }],
  },
  { timestamps: true }
);

// Apply the pagination plugin
OrderSchema.plugin(mongoosePaginate);

// Export the model with the correct type
export const Order = mongoose.model<IOrder, mongoose.PaginateModel<IOrder>>(
  "Order",
  OrderSchema
);