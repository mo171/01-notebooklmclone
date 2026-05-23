import type { NextFunction, Request, Response } from "express";

/** Logs every API request and response status for debugging. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl } = req;

  console.log(`[API] → ${method} ${originalUrl}`);

  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[API] ← ${method} ${originalUrl} ${res.statusCode} (${ms}ms)`);
  });

  next();
}
