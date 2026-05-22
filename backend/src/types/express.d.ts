import { Document } from "mongoose";

declare global {
  namespace Express {
    interface User extends Document {
      name?: string;
      email: string;
      image?: string;
      googleAccessToken?: string;
      googleRefreshToken?: string;
      googleId: string;
      token?: {
        accessToken: string;
        refreshToken: string;
      };
    }
  }
}

export {};
