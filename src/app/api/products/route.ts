import { handleApiError, readJson } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { productInputSchema } from "@/lib/validation";
import { Product } from "@/models";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();
    const products = await Product.find().sort({ name: 1 }).lean();

    return Response.json({ data: serialize(products) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = productInputSchema.parse(await readJson(request));
    const product = await Product.create(payload);

    return Response.json({ data: serialize(product) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
