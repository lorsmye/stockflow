import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  type Types,
} from "mongoose";

export interface BranchDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<BranchDocument>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

BranchSchema.index({ name: 1 }, { unique: true });

export const Branch =
  (models.Branch as Model<BranchDocument> | undefined) ??
  model<BranchDocument>("Branch", BranchSchema);
