import cors from "cors";
import express, { type Express, type NextFunction, type Response, type Request } from "express";
import { handleExpressError } from "../exceptions/handleEpressError";

export function ExpressServer(app: Express, PORT: number) {
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

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
