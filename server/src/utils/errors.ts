import type { ApiErrorCode } from "@belezma/shared";

/**
 * Erreur applicative destinée au client. Toute autre exception est convertie en
 * `INTERNAL_ERROR` par le gestionnaire centralisé : ni pile d'appels ni erreur
 * Mongo ne parviennent au client (§11).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly expose = true;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, "VALIDATION_ERROR", message, details);
  }

  static unauthenticated(message = "Connectez-vous pour effectuer cette action."): ApiError {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message = "Vous n'avez pas les droits nécessaires pour cette action."): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Ressource introuvable."): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, "CONFLICT", message, details);
  }

  static payloadTooLarge(message: string, details?: unknown): ApiError {
    return new ApiError(413, "PAYLOAD_TOO_LARGE", message, details);
  }

  static unsupportedMediaType(message: string, details?: unknown): ApiError {
    return new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", message, details);
  }

  static rateLimited(message: string): ApiError {
    return new ApiError(429, "RATE_LIMITED", message);
  }

  static upstream(message: string, details?: unknown): ApiError {
    return new ApiError(502, "UPSTREAM_ERROR", message, details);
  }
}
