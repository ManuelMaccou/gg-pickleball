import mongoose from "mongoose";

import "../app/models/Match";
import "../app/models/User";
import "../app/models/Achievement";


const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not defined");
}

// Define a cached connection type
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Ensure the global object has a cache property (fixes "possibly undefined" error)
const globalWithCache = globalThis as unknown as { mongooseCache?: MongooseCache };

if (!globalWithCache.mongooseCache) {
  globalWithCache.mongooseCache = { conn: null, promise: null };
}

async function connectToDatabase(): Promise<typeof mongoose> {
  if (globalWithCache.mongooseCache!.conn) {
    return globalWithCache.mongooseCache!.conn;
  }

  if (!globalWithCache.mongooseCache!.promise) {
    const opts = {
      bufferCommands: false,
    };

    globalWithCache.mongooseCache!.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log("✅ Connected to MongoDB");
        return mongooseInstance;
      })
      .catch((error) => {
        console.error("Error connecting to MongoDB", error);
        throw error;
      });
  }

  globalWithCache.mongooseCache!.conn = await globalWithCache.mongooseCache!.promise;
  return globalWithCache.mongooseCache!.conn;
}

export default connectToDatabase;
