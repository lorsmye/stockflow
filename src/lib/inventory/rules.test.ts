import { describe, expect, it } from "vitest";
import {
  applyMovementToSnapshot,
  shouldFailPermanently,
  stockKey,
} from "./rules";

describe("inventory rules", () => {
  it("applies a transfer by decrementing origin and incrementing destination", () => {
    const result = applyMovementToSnapshot(
      {
        [stockKey("product-1", "branch-a")]: 10,
        [stockKey("product-1", "branch-b")]: 2,
      },
      {
        type: "TRANSFER",
        productId: "product-1",
        fromBranchId: "branch-a",
        toBranchId: "branch-b",
        quantity: 4,
      },
    );

    expect(result[stockKey("product-1", "branch-a")]).toBe(6);
    expect(result[stockKey("product-1", "branch-b")]).toBe(6);
  });

  it("rejects an outbound movement when available stock is not enough", () => {
    expect(() =>
      applyMovementToSnapshot(
        {
          [stockKey("product-1", "branch-a")]: 3,
        },
        {
          type: "OUT",
          productId: "product-1",
          fromBranchId: "branch-a",
          quantity: 5,
        },
      ),
    ).toThrow("Stock insuficiente. Disponible: 3. Requerido: 5.");
  });

  it("marks the second failed attempt as permanent when maxAttempts is two", () => {
    expect(shouldFailPermanently(1, 2)).toBe(false);
    expect(shouldFailPermanently(2, 2)).toBe(true);
  });
});
