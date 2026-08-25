import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodError, ZodTypeAny, z } from "zod";
import { ApiError } from "../utils/errors.js";

type Source = "body" | "query" | "params";

/** Détaille les erreurs zod champ par champ, sans jamais exposer d'objet interne. */
function toDetails(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

const MESSAGES: Record<Source, string> = {
  body: "Les données transmises sont invalides.",
  query: "Les paramètres de la requête sont invalides.",
  params: "L'adresse demandée est invalide.",
};

/**
 * Valide une partie de la requête et remplace sa valeur par la donnée typée.
 * Les schémas `.strict()` rejettent les champs inconnus (§11).
 */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = "body"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(ApiError.badRequest(MESSAGES[source], toDetails(result.error)));
      return;
    }
    // `req.query` et `req.params` sont en lecture seule sous Express 5 ; on
    // stocke la valeur validée à part pour rester compatible.
    if (source === "body") {
      req.body = result.data;
    } else if (source === "query") {
      req.validatedQuery = result.data;
    } else {
      req.validatedParams = result.data;
    }
    next();
  };
}

/** Récupère la query validée avec son type, après `validate(schema, "query")`. */
export function validatedQuery<T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> {
  return req.validatedQuery as z.infer<T>;
}

export function validatedParams<T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> {
  return req.validatedParams as z.infer<T>;
}
