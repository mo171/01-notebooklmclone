import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

chatSchema.index({ noteId: 1, userId: 1 }, { unique: true });

export const Chat = mongoose.model("Chat", chatSchema);
