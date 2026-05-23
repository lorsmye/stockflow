import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  type Types,
} from "mongoose";

export interface ProductDocument extends Document {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  price: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<ProductDocument>(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const Product =
  (models.Product as Model<ProductDocument> | undefined) ??
  model<ProductDocument>("Product", ProductSchema);
