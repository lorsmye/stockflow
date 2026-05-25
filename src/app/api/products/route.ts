import { ApiError, handleApiError, readJson } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { productInputSchema } from "@/lib/validation";
import { Product } from "@/models";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();
    const products = await Product.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();

    return Response.json({ data: serialize(products) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = productInputSchema.parse(await readJson(request));
    const existingProduct = await Product.findOne({ sku: payload.sku }).lean();

    if (existingProduct) {
      throw new ApiError(
        409,
        existingProduct.isActive === false
          ? "Este SKU ya esta asignado a un producto inactivo. Usa otro SKU."
          : "Este SKU ya esta asignado a un producto activo. Usa otro SKU.",
      );
    }

    const product = await Product.create(payload);

    return Response.json({ data: serialize(product) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
