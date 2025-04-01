import mongoose, { Document, Model } from 'mongoose';

export interface IReview extends Document {
  name: string;
  company: string;
  role: string;
  review: string;
  rating: number;
}

interface IReviewModel extends Model<IReview> {}

const reviewSchema = new mongoose.Schema<IReview>({
  name: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  review: {
    type: String,
    required: [true, "Review is required"],
    maxlength: [1000, "Review cannot exceed 1000 characters"],
  },
  rating: {
    type: Number,
    required: [true, "Rating is required"],
    min: [1, "Rating must be at least 1"],
    max: [5, "Rating cannot exceed 5"],
  },
}, {
  timestamps: true,
});

export const Review: IReviewModel = mongoose.model<IReview, IReviewModel>('Review', reviewSchema);
