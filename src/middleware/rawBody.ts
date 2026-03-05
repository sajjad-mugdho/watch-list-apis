import { Request, Response, NextFunction } from 'express';

/**
 * Capture raw body BEFORE JSON parsing
 * Required for webhook signature verification
 */
export function captureRawBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    (req as any).rawBody = data;
    next();
  });
}
