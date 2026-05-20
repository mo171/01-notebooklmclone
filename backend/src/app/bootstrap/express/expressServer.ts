import cors from "cors";
import express, { type Express, type NextFunction, type Response, type Request } from "express";
import { handleExpressError } from "../exceptions/handleEpressError";
import passport from "passport"
import session from "express-session";
import { Strategy as GoogleStrategy } from "passport-google-oauth20"

export function ExpressServer(app: Express, PORT: number) {
    const isProduction = process.env.NODE_ENV === "production";

    const sessionSecret =
        process.env.COOKIE_KEY ?? (isProduction ? undefined : "dev_cookie_key");

    if (!sessionSecret) {
        throw new Error(
            "Missing COOKIE_KEY env var (required for sessions). Add COOKIE_KEY to backend/.env",
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

  app.use(
    cors({
      origin: "*",
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
 

  app.use(handleExpressError);

  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "express server is up" });
  });


  const sess = {
        secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess))
app.use(passport.initialize())
app.use(passport.session())

// --- GOOGLE STRATEGY ---
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            callbackURL,
            // passReqToCallback: true,
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {

            const user = {
                provider: profile?.provider,
                googleId: profile?.id,
                displayName: profile?.displayName,
                email: profile?.emails?.[0]?.value,
                photo: profile?.photos?.[0]?.value,
            };

            console.log('create user : ', user)
            return done(null, user)
        }
    )
)


passport.serializeUser((user: any, done) => {
    console.log('user in seri:::', user)
    done(null, user); // store only the user ID
});


// Called on every request that uses the session.
passport.deserializeUser(async (obj: any, done) => {
    try {
        // here check if user exist in db
        done(null, obj);
    } catch (err) {
        done(err);
    }
});

app.get(
    "/auth/google",
    passport.authenticate("google",
        {
            scope: [
                "profile",
                "email",
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/drive.file",
            ],
            accessType: "offline",
            prompt: "consent",
        }
    )
)

app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/auth/login",
        successRedirect: process.env.REACT_APP_URL, // frontend route
    })
)

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  
}
