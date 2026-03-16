import { Request, Response, NextFunction } from "express";

/**
 * Capture raw body BEFORE JSON parsing
 * Required for webhook signature verification
 *
 * Note: In production, rawBody is captured via express.json verify callback
 * in app.ts. This middleware is kept as a standalone alternative.
 */
export function captureRawBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    (req as any).rawBody = Buffer.concat(chunks).toString("utf8");
    next();
  });
}
