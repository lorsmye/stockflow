export type MovementType = "IN" | "OUT" | "TRANSFER";

export type StockSnapshot = Record<string, number>;

export type StockPreviewMovement = {
  type: MovementType;
  productId: string;
  quantity: number;
  fromBranchId?: string;
  toBranchId?: string;
};

export function stockKey(productId: string, branchId: string) {
  return `${productId}:${branchId}`;
}

export function shouldFailPermanently(attempts: number, maxAttempts: number) {
  return attempts >= maxAttempts;
}

export function insufficientStockReason(available: number, required: number) {
  return `Stock insuficiente. Disponible: ${available}. Requerido: ${required}.`;
}

export function applyMovementToSnapshot(
  snapshot: StockSnapshot,
  movement: StockPreviewMovement,
) {
  const next = { ...snapshot };

  if (movement.type === "IN") {
    requireTargetBranch(movement);
    increment(next, movement.productId, movement.toBranchId, movement.quantity);
    return next;
  }

  if (movement.type === "OUT") {
    requireSourceBranch(movement);
    decrement(next, movement.productId, movement.fromBranchId, movement.quantity);
    return next;
  }

  requireSourceBranch(movement);
  requireTargetBranch(movement);
  decrement(next, movement.productId, movement.fromBranchId, movement.quantity);
  increment(next, movement.productId, movement.toBranchId, movement.quantity);
  return next;
}

function increment(
  snapshot: StockSnapshot,
  productId: string,
  branchId: string,
  quantity: number,
) {
  const key = stockKey(productId, branchId);
  snapshot[key] = (snapshot[key] ?? 0) + quantity;
}

function decrement(
  snapshot: StockSnapshot,
  productId: string,
  branchId: string,
  quantity: number,
) {
  const key = stockKey(productId, branchId);
  const available = snapshot[key] ?? 0;

  if (available < quantity) {
    throw new Error(insufficientStockReason(available, quantity));
  }

  snapshot[key] = available - quantity;
}

function requireSourceBranch(
  movement: StockPreviewMovement,
): asserts movement is StockPreviewMovement & { fromBranchId: string } {
  if (!movement.fromBranchId) {
    throw new Error("La sucursal origen es requerida.");
  }
}

function requireTargetBranch(
  movement: StockPreviewMovement,
): asserts movement is StockPreviewMovement & { toBranchId: string } {
  if (!movement.toBranchId) {
    throw new Error("La sucursal destino es requerida.");
  }
}
