import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 n'attrape pas les rejets de promesses : ce wrapper les renvoie au
 * gestionnaire d'erreurs centralisé.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
