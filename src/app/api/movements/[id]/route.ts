import { ApiError, handleApiError, requireId } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { Movement } from "@/models";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const movement = await Movement.findById(requireId(id))
      .populate("productId")
      .populate("fromBranchId")
      .populate("toBranchId")
      .lean();

    if (!movement) {
      throw new ApiError(404, "Movimiento no encontrado.");
    }

    return Response.json({ data: serialize(movement) });
  } catch (error) {
    return handleApiError(error);
  }
}
