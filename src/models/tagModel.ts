import mongoose, { Document, Model } from 'mongoose';

export interface ITag extends Document {
  name: string;
  createdAt: Date;
}

interface ITagModel extends Model<ITag> {}

const tagSchema = new mongoose.Schema<ITag>({
  name: {
    type: String,
    required: [true, "Tag name is required"],
    unique: true,
    trim: true,
    maxlength: [50, "Tag name cannot exceed 50 characters"],
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Tag: ITagModel = mongoose.model<ITag, ITagModel>('Tag', tagSchema);
