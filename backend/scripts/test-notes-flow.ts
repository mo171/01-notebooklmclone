import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { dbConnection, closeDbConnection } from "@/app/bootstrap/mongoose/dbConnection";
import { User } from "@/app/bootstrap/models/userSchema";
import { Note } from "@/app/bootstrap/models/notesScchema";
import { startAgenda, stopAgenda } from "@/app/bootstrap/agenda/agenda";
import { processNoteJob } from "@/app/services/notes/processNote";

async function main() {
  await dbConnection();
  // Don't start agenda server here, we'll just run the job inline to test the pipeline

  const email = "testuser@example.com";
  let user = await User.findOne({ email });

  if (!user) {
    console.log("Please run seed-test-user.ts first!");
    process.exit(1);
  }

  // Create a dummy text file to upload
  const tmpFilePath = path.join(process.cwd(), "tmp", "test-upload.txt");
  await fs.mkdir(path.dirname(tmpFilePath), { recursive: true });
  await fs.writeFile(
    tmpFilePath,
    "The history of agriculture is the story of humankind's development and cultivation of processes for producing food, feed, fiber, fuel, and other goods by the systematic raising of plants and animals. Automation and AI in agriculture represent the next major shift."
  );

  console.log("Creating processing note...");
  const note = await Note.create({
    name: "Processing...",
    status: "processing",
    sourceType: "upload",
    sourceRef: "test-upload.txt",
    userId: user._id,
  });

  console.log("Running processNoteJob pipeline...");
  try {
    await processNoteJob({
      noteId: note._id.toString(),
      userId: user._id.toString(),
      source: {
        type: "upload",
        uploadPath: tmpFilePath,
        originalName: "test-upload.txt",
      },
    });

    const updatedNote = await Note.findById(note._id);
    console.log("\n✅ Pipeline completed successfully!");
    console.log("Resulting Note:", JSON.stringify(updatedNote, null, 2));
  } catch (err) {
    console.error("❌ Pipeline failed:", err);
    const updatedNote = await Note.findById(note._id);
    console.log("Resulting Note (Failed):", updatedNote);
  } finally {
    await closeDbConnection();
    await fs.unlink(tmpFilePath).catch(() => {});
  }
}

main().catch(console.error);
