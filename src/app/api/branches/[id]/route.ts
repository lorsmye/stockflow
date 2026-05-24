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
    const branch = await Branch.findByIdAndUpdate(requireId(id), payload, {
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
    const branch = await Branch.findByIdAndDelete(requireId(id)).lean();

    if (!branch) {
      throw new ApiError(404, "Sucursal no encontrada.");
    }

    await Stock.deleteMany({ branchId: id });

    return Response.json({ data: serialize(branch) });
  } catch (error) {
    return handleApiError(error);
  }
}
