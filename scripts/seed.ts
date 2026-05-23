import { connectToDatabase } from "../src/lib/db";
import { Branch, Product, Stock } from "../src/models";
import type { Types } from "mongoose";

async function main() {
  const db = await connectToDatabase();

  const [keyboard, mouse, monitor] = await Promise.all([
    Product.findOneAndUpdate(
      { sku: "TEC-001" },
      {
        sku: "TEC-001",
        name: "Teclado mecanico",
        price: 1299,
        category: "Perifericos",
      },
      { upsert: true, new: true, runValidators: true },
    ),
    Product.findOneAndUpdate(
      { sku: "MOU-002" },
      {
        sku: "MOU-002",
        name: "Mouse inalambrico",
        price: 649,
        category: "Perifericos",
      },
      { upsert: true, new: true, runValidators: true },
    ),
    Product.findOneAndUpdate(
      { sku: "MON-003" },
      {
        sku: "MON-003",
        name: "Monitor 27 pulgadas",
        price: 4599,
        category: "Pantallas",
      },
      { upsert: true, new: true, runValidators: true },
    ),
  ]);

  const [centro, norte, online] = await Promise.all([
    Branch.findOneAndUpdate(
      { name: "Centro" },
      { name: "Centro", location: "CDMX Centro" },
      { upsert: true, new: true, runValidators: true },
    ),
    Branch.findOneAndUpdate(
      { name: "Norte" },
      { name: "Norte", location: "Monterrey" },
      { upsert: true, new: true, runValidators: true },
    ),
    Branch.findOneAndUpdate(
      { name: "Online" },
      { name: "Online", location: "Ecommerce" },
      { upsert: true, new: true, runValidators: true },
    ),
  ]);

  await Stock.bulkWrite([
    stockUpsert(keyboard._id, centro._id, 18),
    stockUpsert(keyboard._id, norte._id, 7),
    stockUpsert(keyboard._id, online._id, 12),
    stockUpsert(mouse._id, centro._id, 24),
    stockUpsert(mouse._id, norte._id, 10),
    stockUpsert(mouse._id, online._id, 30),
    stockUpsert(monitor._id, centro._id, 5),
    stockUpsert(monitor._id, norte._id, 3),
    stockUpsert(monitor._id, online._id, 8),
  ]);

  console.log("Seed completado: productos, sucursales y stock inicial listos.");
  await db.disconnect();
}

function stockUpsert(productId: Types.ObjectId, branchId: Types.ObjectId, quantity: number) {
  return {
    updateOne: {
      filter: { productId, branchId },
      update: {
        $set: { quantity },
        $setOnInsert: { productId, branchId },
      },
      upsert: true,
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
