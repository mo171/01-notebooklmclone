export type AuthSessionUser = {
  _id?: unknown;
  email: string;
  googleId: string;
  name?: string | null;
  image?: string | null;
  token: {
    accessToken: string;
    refreshToken: string;
  };
};
