import type { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@belezma/shared";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Aucune ressource à l'adresse ${req.method} ${req.originalUrl}.`));
}

/** Traduit toute exception en réponse `{ error }` — sans pile ni détail Mongo (§11). */
function normalize(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.badRequest(
      "Les données transmises sont invalides.",
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return ApiError.payloadTooLarge("Le fichier dépasse la taille maximale autorisée.");
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return ApiError.badRequest("Un seul fichier peut être déposé, dans le champ « file ».");
    }
    return ApiError.badRequest("Le dépôt du fichier a échoué.");
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest(
      "Les données transmises sont invalides.",
      Object.entries(error.errors).map(([path, issue]) => ({ path, message: issue.message })),
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest("Identifiant invalide.");
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    return ApiError.conflict("Cette valeur existe déjà.");
  }

  if (error instanceof SyntaxError && "body" in error) {
    return ApiError.badRequest("Le corps de la requête n'est pas un JSON valide.");
  }

  return new ApiError(500, "INTERNAL_ERROR", "Une erreur interne est survenue. Réessayez dans un instant.");
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const apiError = normalize(error);

  if (apiError.status >= 500) {
    logger.error({ err: error, requestId: req.id, path: req.originalUrl }, "Erreur non gérée");
  } else {
    logger.warn(
      { code: apiError.code, status: apiError.status, requestId: req.id, path: req.originalUrl },
      apiError.message,
    );
  }

  const body: ApiErrorBody = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  };
  res.status(apiError.status).json(body);
}
