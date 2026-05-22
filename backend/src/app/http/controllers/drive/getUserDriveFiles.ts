import { NextFunction, Response, Request } from "express";
import { User } from "@/app/bootstrap/models/userSchema";
import { createDriveClient } from "@/app/helpers/googleOAuth";

export async function getUserDriveFiles(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user?.googleAccessToken) {
      return res.status(401).json({ message: "No Google access token found" });
    }

    const drive = createDriveClient(user);

    const response = await drive.files.list({
      pageSize: 25,
      fields: "files(id, name, mimeType, modifiedTime, size)",
      orderBy: "modifiedTime desc",
    });

    return res.json({ files: response.data.files ?? [] });
  } catch (err) {
    next(err);
  }
}
