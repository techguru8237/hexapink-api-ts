import mongoose, { Document, Model } from 'mongoose';

export interface IMessage extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  read: boolean;
  agreeToEmails: boolean;
}

interface IMessageModel extends Model<IMessage> {}

const messageSchema = new mongoose.Schema<IMessage>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [/.+@.+\..+/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"],
    },
    company: { type: String, required: true },
    message: { type: String, required: true },
    read: {type: Boolean, default: false},
    agreeToEmails: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

export const Message: IMessageModel = mongoose.model<IMessage, IMessageModel>('Message', messageSchema);
