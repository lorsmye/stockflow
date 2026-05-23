import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  type Types,
} from "mongoose";

export type MovementType = "IN" | "OUT" | "TRANSFER";
export type MovementStatus = "pending" | "processed" | "failed";

export interface MovementDocument extends Document {
  _id: Types.ObjectId;
  type: MovementType;
  productId: Types.ObjectId;
  quantity: number;
  fromBranchId?: Types.ObjectId;
  toBranchId?: Types.ObjectId;
  status: MovementStatus;
  attempts: number;
  maxAttempts: number;
  failureReason?: string;
  lockedUntil?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MovementSchema = new Schema<MovementDocument>(
  {
    type: {
      type: String,
      enum: ["IN", "OUT", "TRANSFER"],
      required: true,
      index: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    fromBranchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    toBranchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 2, min: 1 },
    failureReason: String,
    lockedUntil: Date,
    processedAt: Date,
  },
  { timestamps: true },
);

MovementSchema.index({ status: 1, createdAt: 1 });
MovementSchema.index({ fromBranchId: 1, createdAt: -1 });
MovementSchema.index({ toBranchId: 1, createdAt: -1 });

export const Movement =
  (models.Movement as Model<MovementDocument> | undefined) ??
  model<MovementDocument>("Movement", MovementSchema);
