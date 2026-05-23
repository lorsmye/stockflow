import { z } from "zod";

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Debe ser un ObjectId valido.");

const optionalObjectId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  objectId.optional(),
);

export const productInputSchema = z.object({
  sku: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(140),
  price: z.coerce.number().min(0),
  category: z.string().trim().min(1).max(90),
});

export const productUpdateSchema = productInputSchema.partial();

export const branchInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(180),
});

export const branchUpdateSchema = branchInputSchema.partial();

export const movementInputSchema = z
  .object({
    type: z.enum(["IN", "OUT", "TRANSFER"]),
    productId: objectId,
    quantity: z.coerce.number().int().positive(),
    fromBranchId: optionalObjectId,
    toBranchId: optionalObjectId,
  })
  .superRefine((value, ctx) => {
    if ((value.type === "OUT" || value.type === "TRANSFER") && !value.fromBranchId) {
      ctx.addIssue({
        code: "custom",
        path: ["fromBranchId"],
        message: "La sucursal origen es requerida.",
      });
    }

    if ((value.type === "IN" || value.type === "TRANSFER") && !value.toBranchId) {
      ctx.addIssue({
        code: "custom",
        path: ["toBranchId"],
        message: "La sucursal destino es requerida.",
      });
    }

    if (
      value.type === "TRANSFER" &&
      value.fromBranchId &&
      value.toBranchId &&
      value.fromBranchId === value.toBranchId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toBranchId"],
        message: "La sucursal destino debe ser distinta a la origen.",
      });
    }
  });

export const movementFilterSchema = z.object({
  status: z.enum(["pending", "processed", "failed"]).optional(),
  branchId: objectId.optional(),
});

export const reportQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type MovementInput = z.infer<typeof movementInputSchema>;
