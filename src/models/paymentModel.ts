import mongoose, { Document, Model } from "mongoose";

export interface IPayment extends Document {
  paymentType: "bank" | "stripe";
  bankName?: string;
  accountOwner?: string;
  accountNumber?: string;
  iban?: string;
  rib?: string;
  swift?: string;
  bankLogo?: string;
  qrCode?: string;
  publicKey?: string;
  secretKey?: string;
  status: "Active" | "Inactive";
  featured?: boolean;
}

interface IPaymentModel extends Model<IPayment> {}

const PaymentSchema = new mongoose.Schema<IPayment>(
  {
    paymentType: {
      type: String,
      enum: ["bank", "stripe"],
      required: true,
    },
    bankName: {
      type: String,
    },
    accountOwner: {
      type: String,
    },
    accountNumber: {
      type: String,
      match: [/^\d+$/, "Account number must contain only digits"],
    },
    iban: {
      type: String,
      match: [
        /^[A-Z0-9]+$/,
        "IBAN must contain only uppercase letters and digits",
      ],
    },
    rib: {
      type: String,
    },
    swift: {
      type: String,
    },
    bankLogo: {
      type: String,
    },
    qrCode: {
      type: String,
    },
    publicKey: {
      type: String,
    },
    secretKey: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

export const Payment: IPaymentModel = mongoose.model<IPayment, IPaymentModel>(
  "Payment",
  PaymentSchema
);
