import { ApiError, handleApiError, requireId } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { Branch } from "@/models";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: Params) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const branch = await Branch.findByIdAndUpdate(
      requireId(id),
      {
        $set: { isActive: true },
        $unset: { deactivatedAt: "" },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (!branch) {
      throw new ApiError(404, "Sucursal no encontrada.");
    }

    return Response.json({ data: serialize(branch) });
  } catch (error) {
    return handleApiError(error);
  }
}
