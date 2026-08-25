import { z } from "zod";
import { PAGINATION } from "./constants.js";

/** Enveloppe de réponse — toute réponse est `{ data, meta? }` ou `{ error }`. */
export interface ApiSuccess<T, M = unknown> {
  data: T;
  meta?: M;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pageCount: number;
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Identifiant invalide.");

export const idParamSchema = z.object({ id: objectIdSchema });
