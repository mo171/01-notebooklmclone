import { NextFunction, Request, Response } from "express";
import { User } from "@/app/bootstrap/models/userSchema";
import { NotesRepository } from "./repository/Notesrepository";

export async function getAllNotes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notes = await NotesRepository.getInstance().findByUser(user._id);
    return res.json({ notes });
  } catch (err) {
    next(err);
  }
}
