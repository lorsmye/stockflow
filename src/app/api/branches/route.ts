import { ApiError, handleApiError, readJson } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { branchInputSchema } from "@/lib/validation";
import { Branch } from "@/models";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();
    const branches = await Branch.find().sort({ name: 1 }).lean();

    return Response.json({ data: serialize(branches) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = branchInputSchema.parse(await readJson(request));
    const existingBranch = await Branch.findOne({ name: payload.name }).lean();

    if (existingBranch) {
      throw new ApiError(
        409,
        existingBranch.isActive === false
          ? "Ya existe una sucursal inactiva con ese nombre. Puedes reactivarla."
          : "Ya existe una sucursal activa con ese nombre.",
      );
    }

    const branch = await Branch.create(payload);

    return Response.json({ data: serialize(branch) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
