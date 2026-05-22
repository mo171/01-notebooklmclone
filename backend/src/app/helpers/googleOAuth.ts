import { google } from "googleapis";
import { User } from "@/app/bootstrap/models/userSchema";

export function createGoogleOAuthClient(user: InstanceType<typeof User>) {
  if (!user.googleAccessToken) {
    throw new Error("No Google access token found for user");
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

  return oauth2Client;
}

export function createDriveClient(user: InstanceType<typeof User>) {
  const auth = createGoogleOAuthClient(user);
  return google.drive({ version: "v3", auth });
}
