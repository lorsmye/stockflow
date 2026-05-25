import { ApiError, handleApiError, readJson, requireId } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { branchUpdateSchema } from "@/lib/validation";
import { Branch, Stock } from "@/models";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const branch = await Branch.findById(requireId(id)).lean();

    if (!branch) {
      throw new ApiError(404, "Sucursal no encontrada.");
    }

    return Response.json({ data: serialize(branch) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const payload = branchUpdateSchema.parse(await readJson(request));
    const normalizedId = requireId(id);

    if (payload.name) {
      const existingBranch = await Branch.findOne({
        _id: { $ne: normalizedId },
        name: payload.name,
      }).lean();

      if (existingBranch) {
        throw new ApiError(
          409,
          existingBranch.isActive === false
            ? "Ya existe una sucursal inactiva con ese nombre. Puedes reactivarla."
            : "Ya existe una sucursal activa con ese nombre.",
        );
      }
    }

    const branch = await Branch.findByIdAndUpdate(normalizedId, payload, {
      returnDocument: "after",
      runValidators: true,
    }).lean();

    if (!branch) {
      throw new ApiError(404, "Sucursal no encontrada.");
    }

    return Response.json({ data: serialize(branch) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const normalizedId = requireId(id);
    const stockWithInventory = await Stock.exists({
      branchId: normalizedId,
      quantity: { $gt: 0 },
    });

    if (stockWithInventory) {
      throw new ApiError(
        409,
        "No se puede desactivar la sucursal porque aun tiene stock asignado.",
      );
    }

    const branch = await Branch.findByIdAndUpdate(
      normalizedId,
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!branch) {
      throw new ApiError(404, "Sucursal no encontrada.");
    }

    return Response.json({ data: serialize(branch) });
  } catch (error) {
    return handleApiError(error);
  }
}
