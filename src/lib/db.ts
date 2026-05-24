import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var stockflowMongoose: MongooseCache | undefined;
}

const globalCache = globalThis.stockflowMongoose ?? {
  conn: null,
  promise: null,
};

globalThis.stockflowMongoose = globalCache;

export async function connectToDatabase() {
  if (globalCache.conn) {
    return globalCache.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI no esta configurada.");
  }

  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    globalCache.conn = await globalCache.promise;
    return globalCache.conn;
  } catch (error) {
    globalCache.promise = null;
    globalCache.conn = null;
    throw error;
  }
}
