import mongoose, { Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  country?: string;
  phone?: string;
  industry?: string;
  company?: string;
  role: 'user' | 'manager' | 'admin';
  status: 'Active' | 'Suspended';
  balance: number;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  is_verified: boolean;
  otp?: string;
  otp_expiration?: Date;
  fullName: string; // Virtual field
}

interface IUserModel extends Model<IUser> {}

const UserSchema = new mongoose.Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please enter a valid email address"],
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    firstName: {
      type: String,
      trim: true,
      required: [true, "First name is required"],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, "Last name is required"],
    },
    country: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'manager', 'admin'], // You can add more roles if needed
      default: 'user',
      index: true, // Add index to role
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended'], // Possible statuses
      default: 'Active',
      index: true, // Add index to status
    },
    balance: {
      type: Number,
      default: 0,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otp_expiration: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

UserSchema.index({ email: 1, status: 1 });

export const User: IUserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);
