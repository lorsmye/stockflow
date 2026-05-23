import { ApiError, handleApiError } from "@/lib/api";
import { processPendingMovements } from "@/lib/inventory/processor";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
  return runWorker(request);
}

export async function POST(request: Request) {
  return runWorker(request);
}

async function runWorker(request: Request) {
  try {
    authorizeWorker(request);
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 10);
    const summary = await processPendingMovements({
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 25) : 10,
    });

    return Response.json({ data: summary });
  } catch (error) {
    return handleApiError(error);
  }
}

function authorizeWorker(request: Request) {
  const secret = process.env.WORKER_SECRET;

  if (!secret) {
    return;
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new ApiError(401, "No autorizado para ejecutar el worker.");
  }
}
