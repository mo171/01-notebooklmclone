import mongoose from "mongoose";

export type NoteStatus = "processing" | "ready" | "failed";
export type NoteSourceType = "drive" | "url" | "upload";

const noteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String, required: false },
    description: { type: String, required: false },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
    },
    error: { type: String, required: false },
    sourceType: {
      type: String,
      enum: ["drive", "url", "upload"],
      required: true,
    },
    sourceRef: { type: String, required: false },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export const Note = mongoose.model("Note", noteSchema);
