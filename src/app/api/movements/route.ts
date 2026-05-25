import { after } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import {
  processPendingMovements,
  validateMovementCanBeCreated,
} from "@/lib/inventory/processor";
import { serialize } from "@/lib/serialize";
import { movementFilterSchema, movementInputSchema } from "@/lib/validation";
import { Movement } from "@/models";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const filters = movementFilterSchema.parse({
      status: searchParams.get("status") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    });
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.branchId) {
      query.$or = [{ fromBranchId: filters.branchId }, { toBranchId: filters.branchId }];
    }

    const movements = await Movement.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("productId")
      .populate("fromBranchId")
      .populate("toBranchId")
      .lean();

    return Response.json({ data: serialize(movements) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = movementInputSchema.parse(await readJson(request));

    await validateMovementCanBeCreated(payload);

    const movement = await Movement.create({
      ...payload,
      status: "pending",
      attempts: 0,
      maxAttempts: 2,
    });

    after(async () => {
      try {
        await processPendingMovements({ limit: 3 });
      } catch (error) {
        console.error("Async worker failed", error);
      }
    });

    return Response.json({ data: serialize(movement) }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
