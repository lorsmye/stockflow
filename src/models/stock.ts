import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  type Types,
} from "mongoose";

export interface StockDocument extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  branchId: Types.ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<StockDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

StockSchema.index({ productId: 1, branchId: 1 }, { unique: true });

export const Stock =
  (models.Stock as Model<StockDocument> | undefined) ??
  model<StockDocument>("Stock", StockSchema);
