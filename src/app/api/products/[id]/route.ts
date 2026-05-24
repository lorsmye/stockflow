import { ApiError, handleApiError, readJson, requireId } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { productUpdateSchema } from "@/lib/validation";
import { Product, Stock } from "@/models";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const product = await Product.findById(requireId(id)).lean();

    if (!product) {
      throw new ApiError(404, "Producto no encontrado.");
    }

    return Response.json({ data: serialize(product) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const payload = productUpdateSchema.parse(await readJson(request));
    const product = await Product.findByIdAndUpdate(requireId(id), payload, {
      returnDocument: "after",
      runValidators: true,
    }).lean();

    if (!product) {
      throw new ApiError(404, "Producto no encontrado.");
    }

    return Response.json({ data: serialize(product) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const product = await Product.findByIdAndDelete(requireId(id)).lean();

    if (!product) {
      throw new ApiError(404, "Producto no encontrado.");
    }

    await Stock.deleteMany({ productId: id });

    return Response.json({ data: serialize(product) });
  } catch (error) {
    return handleApiError(error);
  }
}
