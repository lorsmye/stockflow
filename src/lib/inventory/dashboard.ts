import { Branch, Product, Stock } from "@/models";

export async function getInventoryDashboard() {
  const [products, branches, stocks] = await Promise.all([
    Product.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean(),
    Branch.find().sort({ name: 1 }).lean(),
    Stock.find().lean(),
  ]);

  const stockByProductBranch = new Map<string, number>();

  for (const stock of stocks) {
    stockByProductBranch.set(
      `${stock.productId.toString()}:${stock.branchId.toString()}`,
      stock.quantity,
    );
  }

  const rows = products.map((product) => {
    const byBranch = branches.map((branch) => ({
      branchId: branch._id.toString(),
      branchName: branch.name,
      quantity:
        stockByProductBranch.get(`${product._id.toString()}:${branch._id.toString()}`) ?? 0,
    }));

    const total = byBranch.reduce((sum, item) => sum + item.quantity, 0);

    return {
      product,
      total,
      byBranch,
    };
  });

  return {
    products,
    branches,
    rows,
  };
}
