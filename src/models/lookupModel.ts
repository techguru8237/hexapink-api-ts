import mongoose, { Document, PaginateModel } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface ILookup extends Document {
  user: mongoose.Schema.Types.ObjectId;
  phone: string;
  country?: string;
  result: 'Valid' | 'Unvalid';
}

interface ILookupModel extends PaginateModel<ILookup> {}

const LookupSchema = new mongoose.Schema<ILookup>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"],
      index: true,
    },
    country: {
      type: String,
      index: true,
    },
    result: {
      type: String,
      enum: ["Valid", "Unvalid"],
      required: [true, "Result is required"],
      index: true,
    },
  },
  { timestamps: true }
);

LookupSchema.index({ user: 1, phone: 1 });
LookupSchema.plugin(mongoosePaginate);
export const Lookup: ILookupModel = mongoose.model<ILookup, ILookupModel>('Lookup', LookupSchema);
