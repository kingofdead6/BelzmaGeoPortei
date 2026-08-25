import type { Response } from "express";
import type { PageMeta } from "@belezma/shared";

/** Toute réponse de l'API suit l'enveloppe `{ data, meta? }` (§5). */
export function sendData<T, M = unknown>(res: Response, data: T, meta?: M, status = 200): void {
  if (meta === undefined) {
    res.status(status).json({ data });
    return;
  }
  res.status(status).json({ data, meta });
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, pageCount: Math.max(1, Math.ceil(total / limit)) };
}
