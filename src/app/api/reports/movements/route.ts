import { handleApiError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { reportQuerySchema } from "@/lib/validation";
import { Branch, Movement } from "@/models";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const query = reportQuerySchema.parse({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    const match: Record<string, unknown> = {};

    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};

      if (query.from) {
        createdAt.$gte = new Date(`${query.from}T00:00:00.000Z`);
      }

      if (query.to) {
        createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
      }

      match.createdAt = createdAt;
    }

    const [movements, branches] = await Promise.all([
      Movement.find(match).sort({ createdAt: -1 }).lean(),
      Branch.find().sort({ name: 1 }).lean(),
    ]);
    const branchNames = new Map(branches.map((branch) => [branch._id.toString(), branch.name]));
    const byType = new Map<string, number>();
    const byBranch = new Map<string, { branchId: string; branchName: string; count: number }>();

    for (const movement of movements) {
      byType.set(movement.type, (byType.get(movement.type) ?? 0) + 1);

      for (const branchId of [movement.fromBranchId, movement.toBranchId]) {
        if (!branchId) {
          continue;
        }

        const id = branchId.toString();
        const current = byBranch.get(id);

        byBranch.set(id, {
          branchId: id,
          branchName: branchNames.get(id) ?? "Sucursal eliminada",
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    return Response.json({
      data: serialize({
        from: query.from ?? null,
        to: query.to ?? null,
        total: movements.length,
        byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
        byBranch: Array.from(byBranch.values()).sort((a, b) =>
          a.branchName.localeCompare(b.branchName),
        ),
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
