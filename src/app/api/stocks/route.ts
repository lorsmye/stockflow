import { handleApiError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { getInventoryDashboard } from "@/lib/inventory/dashboard";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();
    const dashboard = await getInventoryDashboard();

    return Response.json({ data: serialize(dashboard) });
  } catch (error) {
    return handleApiError(error);
  }
}
