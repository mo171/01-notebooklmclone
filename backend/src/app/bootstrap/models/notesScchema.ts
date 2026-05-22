import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: false },
    description: { type: String, required: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

export const Note = mongoose.model("Note", noteSchema);