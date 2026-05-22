import mongoose from "mongoose";

export async function dbConnection() {
  const uri =
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/notebooklm";

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}
