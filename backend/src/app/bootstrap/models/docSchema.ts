import mongoose from "mongoose";

const docSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    summary: { type: String },
    studyGuide: { type: String },
    briefingDoc: { type: String },
    FAQ: { type: String },
    mindMap: { type: String }, // store JSON as string
    // Which flavour of briefingDoc was generated. Kept separately so the
    // source document's own title never has to encode it.
    briefingType: { type: String, enum: ["audio", "briefing-doc"] },

    noteId: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

export const Doc = mongoose.model("Doc", docSchema);