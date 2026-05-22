import { NextFunction, Response, Request } from "express";
import { google } from "googleapis";
import { User } from "@/app/bootstrap/models/userSchema";

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

    const oauth2Client = new google.auth.OAuth2({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    });

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken ?? undefined,
    });

    oauth2Client.on("tokens", async (tokens) => {
      if (tokens.access_token) {
        user.googleAccessToken = tokens.access_token;
      }
      if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
      }
      await user.save();
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

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
