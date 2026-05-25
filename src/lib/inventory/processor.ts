import { Types } from "mongoose";
import { ApiError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { Branch, Movement, Product, Stock, type MovementDocument } from "@/models";
import { insufficientStockReason, shouldFailPermanently } from "./rules";

type ProcessOptions = {
  limit?: number;
  lockMs?: number;
  retryDelayMs?: number;
  retryDepth?: number;
};

export type WorkerSummary = {
  processed: number;
  retried: number;
  failed: number;
  checked: number;
  details: Array<{
    movementId: string;
    status: "processed" | "pending" | "failed";
    reason?: string;
  }>;
};

export async function validateMovementCanBeCreated(input: {
  productId: string;
  quantity: number;
  fromBranchId?: string;
  toBranchId?: string;
}) {
  const productExists = await Product.exists({ _id: input.productId });

  if (!productExists) {
    throw new ApiError(404, "El producto seleccionado no existe.");
  }

  const branchIds = [input.fromBranchId, input.toBranchId].filter(
    (branchId): branchId is string => Boolean(branchId),
  );
  const uniqueBranchIds = [...new Set(branchIds)];

  if (uniqueBranchIds.length > 0) {
    const branchesCount = await Branch.countDocuments({ _id: { $in: uniqueBranchIds } });

    if (branchesCount !== uniqueBranchIds.length) {
      throw new ApiError(404, "Una de las sucursales seleccionadas no existe.");
    }
  }

  if (input.fromBranchId) {
    const stock = await Stock.findOne({
      productId: input.productId,
      branchId: input.fromBranchId,
    }).lean();

    if (!stock || stock.quantity < input.quantity) {
      throw new ApiError(409, insufficientStockReason(stock?.quantity ?? 0, input.quantity));
    }
  }
}

export async function processPendingMovements(options: ProcessOptions = {}) {
  await connectToDatabase();

  const limit = options.limit ?? 10;
  const lockMs = options.lockMs ?? 60_000;
  const retryDelayMs = options.retryDelayMs ?? 800;
  const retryDepth = options.retryDepth ?? 0;
  const touchedIds: Types.ObjectId[] = [];
  const summary: WorkerSummary = {
    processed: 0,
    retried: 0,
    failed: 0,
    checked: 0,
    details: [],
  };

  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const movement = await Movement.findOneAndUpdate(
      {
        _id: { $nin: touchedIds },
        status: "pending",
        $or: [
          { lockedUntil: { $exists: false } },
          { lockedUntil: null },
          { lockedUntil: { $lt: now } },
        ],
      },
      {
        $set: { lockedUntil: new Date(now.getTime() + lockMs) },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after", sort: { createdAt: 1 } },
    );

    if (!movement) {
      break;
    }

    touchedIds.push(movement._id);
    summary.checked += 1;

    try {
      await applyMovement(movement);
      await Movement.updateOne(
        { _id: movement._id },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
          },
          $unset: {
            failureReason: "",
            lockedUntil: "",
          },
        },
      );

      summary.processed += 1;
      summary.details.push({
        movementId: movement._id.toString(),
        status: "processed",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "No se pudo procesar.";
      const permanentFailure = shouldFailPermanently(movement.attempts, movement.maxAttempts);

      await Movement.updateOne(
        { _id: movement._id },
        permanentFailure
          ? {
              $set: {
                status: "failed",
                failureReason: reason,
              },
              $unset: { lockedUntil: "" },
            }
          : {
              $set: {
                status: "pending",
                failureReason: `Intento ${movement.attempts}/${movement.maxAttempts}: ${reason}`,
              },
              $unset: { lockedUntil: "" },
            },
      );

      if (permanentFailure) {
        summary.failed += 1;
        summary.details.push({
          movementId: movement._id.toString(),
          status: "failed",
          reason,
        });
      } else {
        summary.retried += 1;
        summary.details.push({
          movementId: movement._id.toString(),
          status: "pending",
          reason,
        });
      }
    }
  }

  if (summary.retried > 0 && retryDepth < 1) {
    await delay(retryDelayMs);
    const retrySummary = await processPendingMovements({
      limit,
      lockMs,
      retryDelayMs,
      retryDepth: retryDepth + 1,
    });

    mergeWorkerSummary(summary, retrySummary);
  }

  return summary;
}

function mergeWorkerSummary(summary: WorkerSummary, retrySummary: WorkerSummary) {
  summary.processed += retrySummary.processed;
  summary.retried += retrySummary.retried;
  summary.failed += retrySummary.failed;
  summary.checked += retrySummary.checked;
  summary.details.push(...retrySummary.details);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function applyMovement(movement: MovementDocument) {
  if (movement.type === "IN") {
    if (!movement.toBranchId) {
      throw new Error("La sucursal destino es requerida.");
    }

    await assertReferences(movement.productId, movement.toBranchId);
    await incrementStock(movement.productId, movement.toBranchId, movement.quantity);
    return;
  }

  if (movement.type === "OUT") {
    if (!movement.fromBranchId) {
      throw new Error("La sucursal origen es requerida.");
    }

    await assertReferences(movement.productId, movement.fromBranchId);
    await decrementStock(movement.productId, movement.fromBranchId, movement.quantity);
    return;
  }

  if (!movement.fromBranchId || !movement.toBranchId) {
    throw new Error("La transferencia requiere sucursal origen y destino.");
  }

  await assertReferences(movement.productId, movement.fromBranchId, movement.toBranchId);
  await decrementStock(movement.productId, movement.fromBranchId, movement.quantity);

  try {
    await incrementStock(movement.productId, movement.toBranchId, movement.quantity);
  } catch (error) {
    await incrementStock(movement.productId, movement.fromBranchId, movement.quantity);
    throw error;
  }
}

async function assertReferences(productId: Types.ObjectId, ...branchIds: Types.ObjectId[]) {
  const [product, branches] = await Promise.all([
    Product.exists({ _id: productId }),
    Branch.countDocuments({ _id: { $in: branchIds } }),
  ]);

  if (!product) {
    throw new Error("El producto ya no existe.");
  }

  if (branches !== branchIds.length) {
    throw new Error("Una sucursal del movimiento ya no existe.");
  }
}

async function incrementStock(
  productId: Types.ObjectId,
  branchId: Types.ObjectId,
  quantity: number,
) {
  await Stock.findOneAndUpdate(
    { productId, branchId },
    {
      $inc: { quantity },
      $setOnInsert: { productId, branchId },
    },
    { upsert: true, returnDocument: "after" },
  );
}

async function decrementStock(
  productId: Types.ObjectId,
  branchId: Types.ObjectId,
  quantity: number,
) {
  const updated = await Stock.findOneAndUpdate(
    {
      productId,
      branchId,
      quantity: { $gte: quantity },
    },
    { $inc: { quantity: -quantity } },
    { returnDocument: "after" },
  );

  if (!updated) {
    const current = await Stock.findOne({ productId, branchId }).lean();
    throw new Error(insufficientStockReason(current?.quantity ?? 0, quantity));
  }
}
