import { ApiError, handleApiError, readJson, requireId } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { productUpdateSchema } from "@/lib/validation";
import { Product } from "@/models";

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
    const normalizedId = requireId(id);

    if (payload.sku) {
      const existingProduct = await Product.findOne({
        _id: { $ne: normalizedId },
        sku: payload.sku,
      }).lean();

      if (existingProduct) {
        throw new ApiError(
          409,
          existingProduct.isActive === false
            ? "Este SKU ya esta asignado a un producto inactivo. Usa otro SKU."
            : "Este SKU ya esta asignado a un producto activo. Usa otro SKU.",
        );
      }
    }

    const product = await Product.findByIdAndUpdate(normalizedId, payload, {
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
    const product = await Product.findByIdAndUpdate(
      requireId(id),
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!product) {
      throw new ApiError(404, "Producto no encontrado.");
    }

    return Response.json({ data: serialize(product) });
  } catch (error) {
    return handleApiError(error);
  }
}
