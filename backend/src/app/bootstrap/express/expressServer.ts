import path from "path";
import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Response,
  type Request,
} from "express";
import { handleExpressError } from "../exceptions/handleEpressError";
import passport from "passport";
import session from "express-session";
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from "passport-google-oauth20";
import { UserRepository } from "@/app/http/controllers/auth/repository/userRespository";
import { GoogleUserType } from "@/types/user-types";
import { apiV1 } from "@/routes/apiV1";

export function ExpressServer(app: Express, PORT: number) {
  const isProduction = process.env.NODE_ENV === "production";

  const sessionSecret =
    process.env.COOKIE_KEY ?? (isProduction ? undefined : "dev_cookie_key");

  if (!sessionSecret) {
    throw new Error(
      "Missing COOKIE_KEY env var (required for sessions). Add COOKIE_KEY to backend/.env",
    );
  }

  if (!process.env.JWT_TOKEN_KEY || process.env.JWT_TOKEN_KEY.includes("your_jwt")) {
    throw new Error(
      "Missing or placeholder JWT_TOKEN_KEY. Set a strong secret in backend/.env",
    );
  }

  if (!process.env.REFRESH_TOKEN_KEY || process.env.REFRESH_TOKEN_KEY.includes("your_refresh")) {
    throw new Error(
      "Missing or placeholder REFRESH_TOKEN_KEY. Set a strong secret in backend/.env",
    );
  }

  const callbackURL =
    process.env.CALL_BACK_URL ??
    (isProduction ? undefined : `http://localhost:${PORT}/auth/google/callback`);

  if (!callbackURL) {
    throw new Error(
      "Missing CALL_BACK_URL env var (required for Google OAuth). Add CALL_BACK_URL to backend/.env",
    );
  }

  const frontendUrl = process.env.REACT_APP_URL ?? "http://localhost:5173";

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/public", express.static(path.join(process.cwd(), "public")));

  app.get("/", (_req: Request, res: Response) => {
    res.json({ message: "express server is up" });
  });

  const sess: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  };

  if (isProduction) {
    app.set("trust proxy", 1);
    sess.cookie = { ...sess.cookie, secure: true };
  }

  app.use(session(sess));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
      ) => {
        try {
          const { authData } =
            await UserRepository.getInstance().createOrUpdateUser(
              profile as unknown as GoogleUserType,
              { accessToken, refreshToken: refreshToken || undefined },
            );
          done(null, authData as Express.User);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user);
  });

  passport.deserializeUser((obj: Express.User, done) => {
    done(null, obj);
  });

  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      accessType: "offline",
      prompt: "consent",
    }),
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${frontendUrl}?auth=failed`,
      session: true,
    }),
    (req: Request, res: Response) => {
      const authData = req.user as unknown as Express.User;

      const redirectUrl = new URL(frontendUrl);
      redirectUrl.searchParams.set("accessToken", authData.token.accessToken);
      redirectUrl.searchParams.set("refreshToken", authData.token.refreshToken);
      res.redirect(redirectUrl.toString());
    },
  );

  apiV1(app);

  app.use(
    (err: Error, _req: Request, res: Response, next: NextFunction) => {
      handleExpressError(err, _req, res, next);
    },
  );

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
