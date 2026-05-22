import mongoose from "mongoose";

let memoryServer: { stop: () => Promise<boolean> } | null = null;

export async function dbConnection() {
  let uri =
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/notebooklm";

  if (process.env.USE_MEMORY_MONGO === "true") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri("notebooklm");
    process.env.MONGODB_URI = uri;
    console.log("Using in-memory MongoDB");
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      family: 4,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `MongoDB connection failed (${uri}). Start MongoDB locally or set USE_MEMORY_MONGO=true in .env. ${message}`,
    );
  }
}

export async function closeDbConnection() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
